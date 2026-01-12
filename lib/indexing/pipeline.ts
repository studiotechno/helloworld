/**
 * Main Indexation Pipeline
 *
 * Orchestrates the full code indexation flow:
 * 1. Fetch repository files from GitHub
 * 2. Filter files (gitignore, binary, priority)
 * 3. Chunk code into semantic units
 * 4. Generate embeddings with Voyage AI
 * 5. Store in database with pgvector
 */

import { prisma } from '../db/prisma'
import {
  fetchRepositoryStructure,
  fetchFileContent,
} from '../github/fetch-repository-files'
import {
  filterFiles,
} from '../parsing/file-filter'
import {
  chunkFileAST,
  calculateFileHash,
  type CodeChunk,
  initTreeSitter,
} from '../parsing'
import { embedCode } from '../embeddings/voyage-client'
import {
  markJobStarted,
  markJobCompleted,
  markJobFailed,
  updateJobProgress,
  updateJobStatus,
  type JobPhase,
} from './job-manager'
import {
  generateContextsBatch,
  buildContextualContent,
  type ChunkForContext,
} from './contextual-generator'

// Batch sizes for different operations
const FILE_FETCH_BATCH_SIZE = 10
const CHUNK_BATCH_SIZE = 50 // For embedding - Voyage allows 2000 RPM so 50 chunks/batch is fine
const DB_INSERT_BATCH_SIZE = 100
const EMBEDDING_BATCH_DELAY_MS = 100 // Small delay between batches (10 req/s, well under 2000 RPM limit)

export interface PipelineOptions {
  accessToken: string
  repositoryId: string
  owner: string
  repo: string
  branch?: string
  jobId: string
  onProgress?: (phase: JobPhase, progress: number, message: string) => void
  /** Generate contextual descriptions for chunks using Haiku (default: true) */
  useContextualRetrieval?: boolean
}

export interface PipelineResult {
  success: boolean
  chunksCreated: number
  filesProcessed: number
  filesTotal: number
  commitSha?: string
  error?: string
}

export interface ChunkWithEmbedding extends CodeChunk {
  embedding: number[]
  file_hash: string
  context?: string // Contextual description from LLM
}

/**
 * Run the full indexation pipeline
 */
export async function runIndexationPipeline(
  options: PipelineOptions
): Promise<PipelineResult> {
  const {
    accessToken,
    repositoryId,
    owner,
    repo,
    branch,
    jobId,
    onProgress,
    useContextualRetrieval = true, // Enable by default
  } = options

  let filesProcessed = 0
  let filesTotal = 0
  let chunksCreated = 0
  let commitSha = ''

  try {
    // Initialize Tree-sitter for AST-based chunking
    await initTreeSitter()

    // Phase 1: Fetch repository structure
    onProgress?.('Fetching files', 0, 'Analyzing repository structure...')

    const structure = await fetchRepositoryStructure(accessToken, owner, repo, branch)
    filesTotal = structure.files.length
    commitSha = structure.commitSha

    // Update job with total files
    await markJobStarted(jobId, filesTotal)

    if (structure.files.length === 0) {
      await markJobCompleted(jobId, 0, commitSha)
      return {
        success: true,
        chunksCreated: 0,
        filesProcessed: 0,
        filesTotal: 0,
        commitSha,
      }
    }

    onProgress?.('Fetching files', 5, `Found ${filesTotal} files in repository`)

    // Phase 2: Filter files
    onProgress?.('Fetching files', 8, 'Filtering files...')

    const filterResult = filterFiles(
      structure.files.map(f => ({ path: f.path, size: f.size })),
      {
        gitignoreContent: structure.gitignore || '',
        respectGitignore: true,
      }
    )

    if (filterResult.isEmpty) {
      await markJobCompleted(jobId, 0, commitSha)
      return {
        success: true,
        chunksCreated: 0,
        filesProcessed: 0,
        filesTotal: filesTotal,
        commitSha,
      }
    }

    const filesToProcess = filterResult.included
    onProgress?.('Fetching files', 10, `${filesToProcess.length} files to index after filtering`)

    // Update job status to fetching
    await updateJobStatus(jobId, 'fetching', { phase: 'Fetching files' })

    // Phase 3: Fetch file contents and chunk
    onProgress?.('Parsing code', 10, 'Fetching and parsing files...')
    await updateJobStatus(jobId, 'parsing', { phase: 'Parsing code' })

    // Map filtered files back to RepositoryFile for content fetching
    const repoFilesMap = new Map(structure.files.map(f => [f.path, f]))
    const allChunks: ChunkWithEmbedding[] = []

    // Process files in batches
    for (let i = 0; i < filesToProcess.length; i += FILE_FETCH_BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + FILE_FETCH_BATCH_SIZE)

      // Fetch content for batch
      const contentPromises = batch.map(async (fileInfo) => {
        const repoFile = repoFilesMap.get(fileInfo.path)
        if (!repoFile) return null

        const content = await fetchFileContent(
          accessToken,
          owner,
          repo,
          fileInfo.path,
          repoFile.sha
        )

        return content
      })

      const contents = await Promise.all(contentPromises)

      // Chunk each file (using AST-based chunker)
      for (let j = 0; j < batch.length; j++) {
        const content = contents[j]
        if (!content) continue

        const fileHash = calculateFileHash(content.content)
        const chunks = await chunkFileAST(content.content, content.path)

        // Add file hash to each chunk (embedding will be added later)
        for (const chunk of chunks) {
          allChunks.push({
            ...chunk,
            file_hash: fileHash,
            embedding: [], // Will be filled in embedding phase
          })
        }

        filesProcessed++
      }

      // Update progress
      const parseProgress = 10 + Math.round((filesProcessed / filesToProcess.length) * 40)
      await updateJobProgress(jobId, {
        filesProcessed,
        progress: parseProgress,
        currentPhase: 'Parsing code',
      })
      onProgress?.(
        'Parsing code',
        parseProgress,
        `Parsed ${filesProcessed}/${filesToProcess.length} files (${allChunks.length} chunks)`
      )
    }

    if (allChunks.length === 0) {
      await markJobCompleted(jobId, 0, commitSha)
      return {
        success: true,
        chunksCreated: 0,
        filesProcessed,
        filesTotal,
        commitSha,
      }
    }

    // Phase 3.5: Generate contextual descriptions (optional)
    if (useContextualRetrieval) {
      onProgress?.('Generating context', 50, `Generating contextual descriptions for ${allChunks.length} chunks...`)

      // Convert chunks to context format
      const chunksForContext: ChunkForContext[] = allChunks.map(chunk => ({
        content: chunk.content,
        filePath: chunk.file_path,
        startLine: chunk.start_line,
        endLine: chunk.end_line,
        chunkType: chunk.chunk_type,
        symbolName: chunk.symbol_name,
        language: chunk.language,
      }))

      // Generate contexts in batch with progress callback
      const contexts = await generateContextsBatch(
        chunksForContext,
        undefined, // No file context for now (would need to refactor to keep file contents)
        (completed, total) => {
          const contextProgress = 50 + Math.round((completed / total) * 10)
          onProgress?.(
            'Generating context',
            contextProgress,
            `Generated context for ${completed}/${total} chunks`
          )
        }
      )

      // Attach contexts to chunks
      for (let i = 0; i < allChunks.length; i++) {
        allChunks[i].context = contexts[i] || undefined
      }

      onProgress?.('Generating context', 60, `Context generation complete for ${allChunks.length} chunks`)
    }

    // Phase 4: Generate embeddings
    const embeddingStartProgress = useContextualRetrieval ? 60 : 50
    onProgress?.('Generating embeddings', embeddingStartProgress, `Generating embeddings for ${allChunks.length} chunks...`)
    await updateJobStatus(jobId, 'embedding', { phase: 'Generating embeddings' })

    // Process embeddings in batches with delay to avoid rate limiting
    for (let i = 0; i < allChunks.length; i += CHUNK_BATCH_SIZE) {
      const batch = allChunks.slice(i, i + CHUNK_BATCH_SIZE)

      // Build content with context prepended (if available)
      const contents = batch.map(chunk =>
        buildContextualContent(chunk.content, chunk.context)
      )

      // Generate embeddings
      const embeddings = await embedCode(contents)

      // Attach embeddings to chunks
      for (let j = 0; j < batch.length; j++) {
        batch[j].embedding = embeddings[j]
      }

      // Update progress (start from 60 if context was generated, 50 otherwise)
      const embeddingProgressRange = useContextualRetrieval ? 35 : 45 // 60-95 or 50-95
      const embeddingProgress = embeddingStartProgress + Math.round(((i + batch.length) / allChunks.length) * embeddingProgressRange)
      await updateJobProgress(jobId, {
        progress: embeddingProgress,
        currentPhase: 'Generating embeddings',
      })
      onProgress?.(
        'Generating embeddings',
        embeddingProgress,
        `Generated embeddings for ${i + batch.length}/${allChunks.length} chunks`
      )

      // Add delay between batches to avoid rate limiting (except for last batch)
      if (i + CHUNK_BATCH_SIZE < allChunks.length) {
        await new Promise(resolve => setTimeout(resolve, EMBEDDING_BATCH_DELAY_MS))
      }
    }

    // Phase 5: Store in database
    onProgress?.('Finalizing', 95, 'Storing chunks in database...')

    // First, delete existing chunks for this repository
    await prisma.code_chunks.deleteMany({
      where: { repository_id: repositoryId },
    })

    // Insert new chunks in batches
    for (let i = 0; i < allChunks.length; i += DB_INSERT_BATCH_SIZE) {
      const batch = allChunks.slice(i, i + DB_INSERT_BATCH_SIZE)

      await prisma.$transaction(
        batch.map(chunk =>
          prisma.$executeRaw`
            INSERT INTO code_chunks (
              id, repository_id, file_path, start_line, end_line,
              content, language, chunk_type, symbol_name, dependencies,
              context, file_hash, embedding, created_at
            ) VALUES (
              gen_random_uuid(),
              ${repositoryId}::uuid,
              ${chunk.file_path},
              ${chunk.start_line},
              ${chunk.end_line},
              ${chunk.content},
              ${chunk.language},
              ${chunk.chunk_type},
              ${chunk.symbol_name || null},
              ${chunk.dependencies},
              ${chunk.context || null},
              ${chunk.file_hash},
              ${`[${chunk.embedding.join(',')}]`}::vector,
              NOW()
            )
          `
        )
      )

      chunksCreated += batch.length
    }

    // Mark job as completed
    await markJobCompleted(jobId, chunksCreated, commitSha)
    onProgress?.('Finalizing', 100, `Indexation complete: ${chunksCreated} chunks created`)

    return {
      success: true,
      chunksCreated,
      filesProcessed,
      filesTotal,
      commitSha,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await markJobFailed(jobId, errorMessage)
    onProgress?.('Finalizing', 0, `Error: ${errorMessage}`)

    return {
      success: false,
      chunksCreated,
      filesProcessed,
      filesTotal,
      commitSha: commitSha || undefined,
      error: errorMessage,
    }
  }
}

/**
 * Run incremental indexation (only changed files)
 */
export async function runIncrementalIndexation(
  options: PipelineOptions
): Promise<PipelineResult> {
  const { accessToken, repositoryId, owner, repo, branch, jobId, onProgress } = options

  try {
    // Get existing chunks to compare
    const existingChunks = await prisma.code_chunks.findMany({
      where: { repository_id: repositoryId },
      select: { file_path: true, file_hash: true },
    })

    // Reserved for future incremental indexation implementation
    const _existingHashes = new Map(
      existingChunks.map(c => [c.file_path, c.file_hash])
    )

    // Fetch current repository structure
    onProgress?.('Fetching files', 0, 'Checking for changes...')
    const structure = await fetchRepositoryStructure(accessToken, owner, repo, branch)

    // Filter files
    const filterResult = filterFiles(
      structure.files.map(f => ({ path: f.path, size: f.size })),
      {
        gitignoreContent: structure.gitignore || '',
        respectGitignore: true,
      }
    )

    if (filterResult.isEmpty) {
      await markJobCompleted(jobId, 0)
      return {
        success: true,
        chunksCreated: 0,
        filesProcessed: 0,
        filesTotal: 0,
      }
    }

    // For incremental, we'd need to fetch content and compare hashes
    // For MVP, just run full indexation
    // TODO: Implement true incremental indexation
    return runIndexationPipeline(options)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await markJobFailed(jobId, errorMessage)

    return {
      success: false,
      chunksCreated: 0,
      filesProcessed: 0,
      filesTotal: 0,
      error: errorMessage,
    }
  }
}

/**
 * Delete all chunks for a repository
 */
export async function deleteRepositoryChunks(repositoryId: string): Promise<number> {
  const result = await prisma.code_chunks.deleteMany({
    where: { repository_id: repositoryId },
  })

  return result.count
}

/**
 * Get indexation statistics for a repository
 */
export async function getRepositoryIndexStats(repositoryId: string): Promise<{
  totalChunks: number
  totalFiles: number
  languages: Record<string, number>
  chunkTypes: Record<string, number>
}> {
  const chunks = await prisma.code_chunks.findMany({
    where: { repository_id: repositoryId },
    select: {
      file_path: true,
      language: true,
      chunk_type: true,
    },
  })

  const files = new Set(chunks.map(c => c.file_path))
  const languages: Record<string, number> = {}
  const chunkTypes: Record<string, number> = {}

  for (const chunk of chunks) {
    languages[chunk.language] = (languages[chunk.language] || 0) + 1
    chunkTypes[chunk.chunk_type] = (chunkTypes[chunk.chunk_type] || 0) + 1
  }

  return {
    totalChunks: chunks.length,
    totalFiles: files.size,
    languages,
    chunkTypes,
  }
}

/**
 * Check if a repository has been indexed
 */
export async function isRepositoryIndexed(repositoryId: string): Promise<boolean> {
  const count = await prisma.code_chunks.count({
    where: { repository_id: repositoryId },
  })

  return count > 0
}
