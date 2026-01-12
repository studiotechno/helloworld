/**
 * Smart Retrieval for RAG
 *
 * Combines two strategies:
 * 1. Metadata-based retrieval for structured queries (endpoints, components, etc.)
 * 2. Vector search for open-ended queries
 *
 * This provides exhaustive results for "list all X" queries while maintaining
 * semantic search quality for specific questions.
 */

import { prisma } from '../db/prisma'
import { classifyQuery, getMetadataFilter, type QueryType } from './query-classifier'
import { retrieveRelevantChunks, type RetrievedChunk, type SearchOptions } from './retriever'
import { Prisma } from '@prisma/client'

// Increased limit for better coverage on generic queries
const DEFAULT_VECTOR_LIMIT = 30

// Maximum chunks to retrieve via metadata (to avoid context overflow)
const MAX_METADATA_CHUNKS = 100

export interface SmartRetrievalOptions {
  /** Maximum chunks for vector search (default: 30) */
  vectorLimit?: number
  /** Maximum chunks for metadata search (default: 100) */
  metadataLimit?: number
  /** Force a specific retrieval strategy */
  forceStrategy?: 'vector' | 'metadata' | 'hybrid'
  /** Minimum confidence to use metadata strategy (default: 0.3) */
  minConfidence?: number
}

export interface SmartRetrievalResult {
  chunks: RetrievedChunk[]
  strategy: 'vector' | 'metadata' | 'hybrid'
  queryType: QueryType
  isListQuery: boolean
  totalFound: number
}

/**
 * Retrieve chunks by metadata filters (file path patterns, chunk types)
 */
async function retrieveByMetadata(
  repositoryId: string,
  queryType: QueryType,
  limit: number
): Promise<RetrievedChunk[]> {
  const filter = getMetadataFilter(queryType)
  if (!filter) return []

  // Build WHERE conditions
  const conditions: Prisma.code_chunksWhereInput[] = [
    { repository_id: repositoryId },
  ]

  // File path patterns (OR)
  if (filter.filePathPatterns && filter.filePathPatterns.length > 0) {
    conditions.push({
      OR: filter.filePathPatterns.map((pattern) => ({
        file_path: { contains: pattern.replace(/%/g, '') },
      })),
    })
  }

  // Chunk types (OR)
  if (filter.chunkTypes && filter.chunkTypes.length > 0) {
    conditions.push({
      chunk_type: { in: filter.chunkTypes },
    })
  }

  // Symbol pattern
  if (filter.symbolPattern) {
    conditions.push({
      symbol_name: { startsWith: filter.symbolPattern.replace(/%/g, '') },
    })
  }

  const chunks = await prisma.code_chunks.findMany({
    where: { AND: conditions },
    orderBy: [
      { file_path: 'asc' },
      { start_line: 'asc' },
    ],
    take: limit,
  })

  // Transform to RetrievedChunk format
  return chunks.map((chunk) => ({
    id: chunk.id,
    filePath: chunk.file_path,
    startLine: chunk.start_line,
    endLine: chunk.end_line,
    content: chunk.content,
    language: chunk.language,
    chunkType: chunk.chunk_type,
    symbolName: chunk.symbol_name,
    score: 1, // Metadata matches are considered highly relevant
  }))
}

/**
 * Deduplicate chunks by ID, keeping the one with highest score
 */
function deduplicateChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Map<string, RetrievedChunk>()

  for (const chunk of chunks) {
    const existing = seen.get(chunk.id)
    if (!existing || chunk.score > existing.score) {
      seen.set(chunk.id, chunk)
    }
  }

  return Array.from(seen.values())
}

/**
 * Smart retrieval that automatically chooses the best strategy
 */
export async function smartRetrieve(
  query: string,
  repositoryId: string,
  options: SmartRetrievalOptions = {}
): Promise<SmartRetrievalResult> {
  const {
    vectorLimit = DEFAULT_VECTOR_LIMIT,
    metadataLimit = MAX_METADATA_CHUNKS,
    forceStrategy,
    minConfidence = 0.3,
  } = options

  // Classify the query
  const { type: queryType, isListQuery, confidence } = classifyQuery(query)

  // Determine strategy
  let strategy: 'vector' | 'metadata' | 'hybrid'

  if (forceStrategy) {
    strategy = forceStrategy
  } else if (queryType !== 'GENERIC' && isListQuery && confidence >= minConfidence) {
    // List query with detected type → metadata-based
    strategy = 'metadata'
  } else if (queryType !== 'GENERIC' && confidence >= minConfidence) {
    // Specific type detected but not a list query → hybrid
    strategy = 'hybrid'
  } else {
    // Generic query → vector search
    strategy = 'vector'
  }

  let chunks: RetrievedChunk[] = []

  switch (strategy) {
    case 'metadata':
      // Pure metadata-based retrieval
      chunks = await retrieveByMetadata(repositoryId, queryType, metadataLimit)
      break

    case 'hybrid':
      // Combine metadata and vector search
      const [metadataChunks, vectorChunks] = await Promise.all([
        retrieveByMetadata(repositoryId, queryType, Math.floor(metadataLimit / 2)),
        retrieveRelevantChunks(query, repositoryId, { limit: Math.floor(vectorLimit / 2) }),
      ])

      // Merge and deduplicate, prioritizing higher scores
      chunks = deduplicateChunks([...metadataChunks, ...vectorChunks])
      // Sort by score descending
      chunks.sort((a, b) => b.score - a.score)
      break

    case 'vector':
    default:
      // Pure vector search with increased limit
      chunks = await retrieveRelevantChunks(query, repositoryId, { limit: vectorLimit })
      break
  }

  return {
    chunks,
    strategy,
    queryType,
    isListQuery,
    totalFound: chunks.length,
  }
}

/**
 * Get a summary of what was retrieved for logging/debugging
 */
export function getRetrievalSummary(result: SmartRetrievalResult): string {
  const { strategy, queryType, isListQuery, totalFound, chunks } = result

  const uniqueFiles = new Set(chunks.map((c) => c.filePath)).size

  return `[SmartRetrieval] Strategy: ${strategy}, Type: ${queryType}, ListQuery: ${isListQuery}, Found: ${totalFound} chunks across ${uniqueFiles} files`
}
