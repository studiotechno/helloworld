/**
 * Repository File Fetcher
 *
 * Fetches repository files using GitHub's Git Trees API for efficient
 * recursive file listing. Handles rate limiting, caching, and large repos.
 */

import { Octokit } from 'octokit'
import { kv } from '@vercel/kv'
import crypto from 'crypto'
import { createGitHubClient, getRateLimit } from './client'
import type { FileInfo } from '../parsing/file-filter'

// Cache TTL for file contents (5 minutes)
const FILE_CACHE_TTL = 300

// Rate limit threshold - pause when remaining < this
const RATE_LIMIT_THRESHOLD = 100

// Maximum files to fetch in a single operation
const MAX_FILES_TO_FETCH = 5000

// Batch size for fetching file contents
const CONTENT_BATCH_SIZE = 10

export interface RepositoryFile extends FileInfo {
  sha: string
  download_url?: string
  type: 'file' | 'dir' | 'symlink' | 'submodule'
}

export interface TreeEntry {
  path: string
  mode: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
  url?: string
}

export interface FetchFilesResult {
  files: RepositoryFile[]
  truncated: boolean
  totalCount: number
  fetchedCount: number
  rateLimitRemaining: number
  commitSha: string
}

export interface FetchFilesOptions {
  branch?: string
  maxFiles?: number
  includeContent?: boolean
  priorityPaths?: string[]
}

export interface FileContent {
  path: string
  content: string
  sha: string
  size: number
  encoding: 'utf-8' | 'base64'
}

/**
 * Fetch all files in a repository using the Git Trees API
 * This is more efficient than recursive getContent calls
 */
export async function fetchRepositoryFiles(
  accessToken: string,
  owner: string,
  repo: string,
  options: FetchFilesOptions = {}
): Promise<FetchFilesResult> {
  const {
    branch,
    maxFiles = MAX_FILES_TO_FETCH,
  } = options

  const octokit = createGitHubClient(accessToken)

  // Get the default branch if not specified
  const targetBranch = branch || await getDefaultBranch(octokit, owner, repo)

  // Get the tree SHA and commit SHA for the branch
  const { treeSha, commitSha } = await getBranchInfo(octokit, owner, repo, targetBranch)

  // Fetch the entire tree recursively
  const { data } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: 'true',
  })

  // Filter to only files (blobs)
  const fileEntries = data.tree.filter(
    (entry): entry is TreeEntry & { type: 'blob' } =>
      entry.type === 'blob' && entry.path !== undefined
  )

  // Check if truncated (GitHub limits to 100k entries)
  const truncated = data.truncated || fileEntries.length >= 100000

  // Limit files if needed
  const limitedEntries = fileEntries.slice(0, maxFiles)

  // Convert to RepositoryFile format
  const files: RepositoryFile[] = limitedEntries.map(entry => ({
    path: entry.path!,
    size: entry.size || 0,
    sha: entry.sha!,
    type: 'file' as const,
    download_url: `https://raw.githubusercontent.com/${owner}/${repo}/${targetBranch}/${entry.path}`,
  }))

  // Get current rate limit status
  const rateLimit = await getRateLimit(accessToken)

  return {
    files,
    truncated,
    totalCount: fileEntries.length,
    fetchedCount: files.length,
    rateLimitRemaining: rateLimit.remaining,
    commitSha,
  }
}

/**
 * Get the default branch for a repository
 */
async function getDefaultBranch(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string> {
  const { data } = await octokit.rest.repos.get({ owner, repo })
  return data.default_branch
}

/**
 * Get the tree SHA and commit SHA for a branch
 */
async function getBranchInfo(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<{ treeSha: string; commitSha: string }> {
  const { data } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  })

  const commitSha = data.object.sha

  // Get commit to get tree SHA
  const { data: commit } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  })

  return {
    treeSha: commit.tree.sha,
    commitSha,
  }
}

/**
 * Fetch content for a single file
 */
export async function fetchFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  sha?: string
): Promise<FileContent | null> {
  // Try cache first
  const cacheKey = `file:${owner}/${repo}:${sha || path}`
  try {
    const cached = await kv.get<FileContent>(cacheKey)
    if (cached) {
      return cached
    }
  } catch {
    // Cache miss or error, continue to fetch
  }

  const octokit = createGitHubClient(accessToken)

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    })

    // Handle only files, not directories
    if (Array.isArray(data) || data.type !== 'file') {
      return null
    }

    // Decode base64 content
    const content = data.content
      ? Buffer.from(data.content, 'base64').toString('utf-8')
      : ''

    const fileContent: FileContent = {
      path: data.path,
      content,
      sha: data.sha,
      size: data.size,
      encoding: 'utf-8',
    }

    // Cache the result
    try {
      await kv.set(cacheKey, fileContent, { ex: FILE_CACHE_TTL })
    } catch {
      // Caching failure shouldn't break the operation
    }

    return fileContent
  } catch (error) {
    // File might not exist or be a binary
    console.error(`[GitHub] Error fetching file ${path}:`, error)
    return null
  }
}

/**
 * Fetch contents for multiple files with rate limit handling
 */
export async function fetchMultipleFileContents(
  accessToken: string,
  owner: string,
  repo: string,
  files: RepositoryFile[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, FileContent>> {
  const results = new Map<string, FileContent>()
  let completed = 0

  // Process in batches to respect rate limits
  for (let i = 0; i < files.length; i += CONTENT_BATCH_SIZE) {
    // Check rate limit before each batch
    const rateLimit = await getRateLimit(accessToken)
    if (rateLimit.remaining < RATE_LIMIT_THRESHOLD) {
      // Wait until rate limit resets
      const waitTime = (rateLimit.reset * 1000) - Date.now() + 1000
      if (waitTime > 0) {
        console.log(`[GitHub] Rate limit low (${rateLimit.remaining}), waiting ${Math.ceil(waitTime / 1000)}s`)
        await sleep(waitTime)
      }
    }

    const batch = files.slice(i, i + CONTENT_BATCH_SIZE)

    // Fetch batch in parallel
    const batchResults = await Promise.all(
      batch.map(file =>
        fetchFileContent(accessToken, owner, repo, file.path, file.sha)
      )
    )

    // Store results
    for (let j = 0; j < batch.length; j++) {
      const content = batchResults[j]
      if (content) {
        results.set(batch[j].path, content)
      }
    }

    completed += batch.length
    onProgress?.(completed, files.length)
  }

  return results
}

/**
 * Calculate content hash for change detection
 */
export function calculateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Check if file has changed by comparing hashes
 */
export function hasFileChanged(
  newSha: string,
  existingSha: string
): boolean {
  return newSha !== existingSha
}

/**
 * Fetch only changed files by comparing with existing SHAs
 */
export async function fetchChangedFiles(
  accessToken: string,
  owner: string,
  repo: string,
  existingFiles: Map<string, string>, // path -> sha
  options: FetchFilesOptions = {}
): Promise<{
  added: RepositoryFile[]
  modified: RepositoryFile[]
  deleted: string[]
}> {
  const { files } = await fetchRepositoryFiles(accessToken, owner, repo, options)

  const added: RepositoryFile[] = []
  const modified: RepositoryFile[] = []
  const currentPaths = new Set<string>()

  for (const file of files) {
    currentPaths.add(file.path)
    const existingSha = existingFiles.get(file.path)

    if (!existingSha) {
      added.push(file)
    } else if (hasFileChanged(file.sha, existingSha)) {
      modified.push(file)
    }
  }

  // Find deleted files
  const deleted: string[] = []
  for (const path of existingFiles.keys()) {
    if (!currentPaths.has(path)) {
      deleted.push(path)
    }
  }

  return { added, modified, deleted }
}

/**
 * Get .gitignore content from repository
 */
export async function fetchGitignore(
  accessToken: string,
  owner: string,
  repo: string
): Promise<string | null> {
  const content = await fetchFileContent(accessToken, owner, repo, '.gitignore')
  return content?.content || null
}

/**
 * Estimate repository line count from file sizes
 */
export function estimateRepoLines(files: RepositoryFile[]): number {
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  // Rough estimate: ~40 chars per line for code
  return Math.ceil(totalSize / 40)
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch repository structure (files only, no content) with metadata
 */
export async function fetchRepositoryStructure(
  accessToken: string,
  owner: string,
  repo: string,
  branch?: string
): Promise<{
  files: RepositoryFile[]
  estimatedLines: number
  isLarge: boolean
  gitignore: string | null
  commitSha: string
}> {
  const result = await fetchRepositoryFiles(accessToken, owner, repo, { branch })

  // Fetch gitignore
  const gitignore = await fetchGitignore(accessToken, owner, repo)

  // Estimate size
  const estimatedLines = estimateRepoLines(result.files)
  const isLarge = estimatedLines > 50000

  return {
    files: result.files,
    estimatedLines,
    isLarge,
    gitignore,
    commitSha: result.commitSha,
  }
}

/**
 * Fetch only the latest commit SHA for a branch (lightweight)
 */
export async function fetchLatestCommitSha(
  accessToken: string,
  owner: string,
  repo: string,
  branch?: string
): Promise<string> {
  const octokit = createGitHubClient(accessToken)
  const targetBranch = branch || await getDefaultBranch(octokit, owner, repo)

  const { data } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${targetBranch}`,
  })

  return data.object.sha
}
