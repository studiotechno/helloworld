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
import { logger } from '../logger'
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

const log = logger.indexing

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
  /** User ID for token usage tracking */
  userId: string
  onProgress?: (phase: JobPhase, progress: number, message: string) => void
  /** Generate contextual descriptions for chunks using Devstral (default: true - Mistral Scale is fast) */
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
    userId,
    onProgress,
    useContextualRetrieval = true, // Enabled by default - Groq is fast enough
  } = options

  let filesProcessed = 0
  let filesTotal = 0
  let chunksCreated = 0
  let commitSha = ''

  // Token usage tracking
  let contextInputTokens = 0
  let contextOutputTokens = 0
  let embeddingTokens = 0

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
      const contextResult = await generateContextsBatch(
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

      // Track token usage
      contextInputTokens = contextResult.inputTokens
      contextOutputTokens = contextResult.outputTokens

      // Attach contexts to chunks
      for (let i = 0; i < allChunks.length; i++) {
        allChunks[i].context = contextResult.contexts[i] || undefined
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
      const embeddingResult = await embedCode(contents)
      embeddingTokens += embeddingResult.totalTokens

      // Attach embeddings to chunks
      for (let j = 0; j < batch.length; j++) {
        batch[j].embedding = embeddingResult.embeddings[j]
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

    // Phase 5: Store in database (atomic operation)
    // We use a two-phase approach to avoid data loss:
    // 1. Insert all new chunks first (they won't conflict due to UUID PKs)
    // 2. Delete old chunks only after successful insert
    // This ensures we never lose data if the process crashes
    onProgress?.('Finalizing', 95, 'Storing chunks in database...')

    // Generate UUIDs for all new chunks upfront (for tracking)
    const newChunkIds: string[] = []

    // Insert new chunks in batches (without deleting old ones first)
    for (let i = 0; i < allChunks.length; i += DB_INSERT_BATCH_SIZE) {
      const batch = allChunks.slice(i, i + DB_INSERT_BATCH_SIZE)

      // Generate UUIDs for this batch
      const batchIds = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT gen_random_uuid()::text as id FROM generate_series(1, ${batch.length})
      `

      await prisma.$transaction(
        batch.map((chunk, idx) => {
          const chunkId = batchIds[idx].id
          newChunkIds.push(chunkId)
          return prisma.$executeRaw`
            INSERT INTO code_chunks (
              id, repository_id, file_path, start_line, end_line,
              content, language, chunk_type, symbol_name, dependencies,
              context, file_hash, embedding, created_at
            ) VALUES (
              ${chunkId}::uuid,
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
        })
      )

      chunksCreated += batch.length
    }

    // Now safely delete old chunks (those not in our new batch)
    // This is safe because we've already inserted all new data
    if (newChunkIds.length > 0) {
      await prisma.$executeRaw`
        DELETE FROM code_chunks
        WHERE repository_id = ${repositoryId}::uuid
        AND id NOT IN (SELECT unnest(${newChunkIds}::uuid[]))
      `
    } else {
      // No new chunks - just delete all existing
      await prisma.code_chunks.deleteMany({
        where: { repository_id: repositoryId },
      })
    }

    // Mark job as completed
    await markJobCompleted(jobId, chunksCreated, commitSha)
    onProgress?.('Finalizing', 100, `Indexation complete: ${chunksCreated} chunks created`)

    // Record token usage for billing
    try {
      // Record context generation tokens (Devstral)
      if (contextInputTokens > 0 || contextOutputTokens > 0) {
        await prisma.token_usage.create({
          data: {
            user_id: userId,
            type: 'indexing_context',
            model: 'devstral',
            input_tokens: contextInputTokens,
            output_tokens: contextOutputTokens,
          },
        })
      }

      // Record embedding tokens (Voyage)
      if (embeddingTokens > 0) {
        await prisma.token_usage.create({
          data: {
            user_id: userId,
            type: 'indexing_embedding',
            model: 'voyage-code-3',
            input_tokens: embeddingTokens,
            output_tokens: 0, // Embeddings have no output tokens
          },
        })
      }

      log.info('Token usage recorded', {
        contextTokens: { input: contextInputTokens, output: contextOutputTokens },
        embeddingTokens,
      })
    } catch (tokenError) {
      // Don't fail the indexation if token tracking fails
      log.error('Failed to record token usage', { error: tokenError })
    }

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
 *
 * NOTE: True incremental indexation is not yet implemented.
 * This function currently performs a full re-indexation.
 * The file_hash column in code_chunks is prepared for future incremental support.
 *
 * TODO: Implement true incremental indexation:
 * 1. Fetch current file SHAs from GitHub
 * 2. Compare with stored file_hash values
 * 3. Only re-process files where SHA differs
 * 4. Delete chunks for removed files
 */
export async function runIncrementalIndexation(
  options: PipelineOptions
): Promise<PipelineResult> {
  // For now, incremental indexation falls back to full indexation
  // This is intentional until we implement proper change detection
  log.info('Incremental indexation not yet implemented, running full indexation')
  return runIndexationPipeline(options)
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
