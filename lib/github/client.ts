// GitHub API client
// Uses Octokit for authenticated requests

import { Octokit } from 'octokit'
import type { GitHubRepo, GitHubContent, GitHubRateLimit } from './types'
import { logger } from '@/lib/logger'

const log = logger.github

// Create authenticated GitHub client
export function createGitHubClient(accessToken: string): Octokit {
  return new Octokit({
    auth: accessToken,
  })
}

// Fetch user's repositories (including organization repos)
export async function fetchUserRepos(accessToken: string): Promise<GitHubRepo[]> {
  const octokit = createGitHubClient(accessToken)

  // 1. Fetch user's own repos and collaborator repos
  const userRepos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    sort: 'pushed',
    direction: 'desc',
    per_page: 100,
    affiliation: 'owner,collaborator,organization_member',
  })

  log.debug('Fetched repos from listForAuthenticatedUser', { count: userRepos.length })

  // 2. Fetch organizations the user belongs to
  const orgs = await octokit.paginate(octokit.rest.orgs.listForAuthenticatedUser, {
    per_page: 100,
  })

  log.debug('User organizations', { count: orgs.length, orgs: orgs.map(o => o.login) })

  // 3. Fetch repos from each organization
  const orgReposPromises = orgs.map(async (org) => {
    try {
      const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
        org: org.login,
        sort: 'pushed',
        direction: 'desc',
        per_page: 100,
      })
      log.debug('Fetched repos from org', { org: org.login, count: repos.length })
      return repos
    } catch (error) {
      log.error('Error fetching repos from org', { org: org.login, error: error instanceof Error ? error.message : String(error) })
      return []
    }
  })

  const orgReposArrays = await Promise.all(orgReposPromises)
  const orgRepos = orgReposArrays.flat()

  // 4. Combine and deduplicate by repo ID
  const allRepos = [...userRepos, ...orgRepos]
  const uniqueReposMap = new Map<number, typeof allRepos[0]>()
  for (const repo of allRepos) {
    if (!uniqueReposMap.has(repo.id)) {
      uniqueReposMap.set(repo.id, repo)
    }
  }

  const uniqueRepos = Array.from(uniqueReposMap.values())
  log.info('Total unique repos fetched', { count: uniqueRepos.length })

  // Sort by pushed_at descending
  uniqueRepos.sort((a, b) => {
    const dateA = a.pushed_at ? new Date(a.pushed_at).getTime() : 0
    const dateB = b.pushed_at ? new Date(b.pushed_at).getTime() : 0
    return dateB - dateA
  })

  return uniqueRepos.map((repo) => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    private: repo.private,
    language: repo.language ?? null,
    default_branch: repo.default_branch ?? 'main',
    updated_at: repo.updated_at ?? '',
    pushed_at: repo.pushed_at ?? '',
    size: repo.size ?? 0,
    stargazers_count: repo.stargazers_count ?? 0,
  }))
}

// Fetch repository content
export async function fetchRepoContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string = ''
): Promise<GitHubContent[]> {
  const octokit = createGitHubClient(accessToken)

  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
  })

  // Handle single file response
  if (!Array.isArray(data)) {
    return [
      {
        name: data.name,
        path: data.path,
        sha: data.sha,
        size: data.size,
        type: data.type as GitHubContent['type'],
        content: 'content' in data ? data.content : undefined,
        encoding: 'encoding' in data ? data.encoding : undefined,
        download_url: data.download_url ?? undefined,
      },
    ]
  }

  return data.map((item) => ({
    name: item.name,
    path: item.path,
    sha: item.sha,
    size: item.size,
    type: item.type as GitHubContent['type'],
    download_url: item.download_url ?? undefined,
  }))
}

// Get rate limit status
export async function getRateLimit(accessToken: string): Promise<GitHubRateLimit> {
  const octokit = createGitHubClient(accessToken)

  const { data } = await octokit.rest.rateLimit.get()

  return {
    limit: data.rate.limit,
    remaining: data.rate.remaining,
    reset: data.rate.reset,
    used: data.rate.used,
  }
}

// Size threshold constant: 50MB (~500,000 lines of code)
export const REPO_SIZE_WARNING_THRESHOLD_KB = 50000

// Check if repository exceeds the MVP size limit
export function checkRepoSizeWarning(sizeKB: number): {
  exceedsLimit: boolean
  sizeKB: number
  thresholdKB: number
} {
  return {
    exceedsLimit: sizeKB > REPO_SIZE_WARNING_THRESHOLD_KB,
    sizeKB,
    thresholdKB: REPO_SIZE_WARNING_THRESHOLD_KB,
  }
}

// Fetch single repository details by owner/repo
export async function fetchRepoDetails(
  accessToken: string,
  owner: string,
  repo: string
): Promise<GitHubRepo> {
  const octokit = createGitHubClient(accessToken)

  const { data } = await octokit.rest.repos.get({
    owner,
    repo,
  })

  return {
    id: data.id,
    name: data.name,
    full_name: data.full_name,
    description: data.description,
    private: data.private,
    language: data.language,
    default_branch: data.default_branch,
    updated_at: data.updated_at ?? '',
    pushed_at: data.pushed_at ?? '',
    size: data.size ?? 0,
    stargazers_count: data.stargazers_count ?? 0,
  }
}

// Fetch repository languages (sorted by bytes, descending)
export async function fetchRepoLanguages(
  accessToken: string,
  owner: string,
  repo: string
): Promise<string[]> {
  const octokit = createGitHubClient(accessToken)

  const { data } = await octokit.rest.repos.listLanguages({
    owner,
    repo,
  })

  // Sort languages by bytes (descending) and return names
  return Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .map(([lang]) => lang)
}
