/**
 * Code Retriever for RAG
 *
 * Retrieves relevant code chunks using hybrid search:
 * - Vector similarity search via pgvector (semantic matching)
 * - Full-text search for exact matches
 * - Combined scoring with configurable weights
 */

import { prisma } from '../db/prisma'
import { embedQuery } from '../embeddings/voyage-client'

// Default search parameters
const DEFAULT_MATCH_COUNT = 15
const DEFAULT_VECTOR_WEIGHT = 0.7
const DEFAULT_TEXT_WEIGHT = 0.3
const DEFAULT_SIMILARITY_THRESHOLD = 0.5

export interface RetrievedChunk {
  id: string
  filePath: string
  startLine: number
  endLine: number
  content: string
  language: string
  chunkType: string
  symbolName: string | null
  score: number
}

export interface SearchOptions {
  limit?: number
  vectorWeight?: number
  textWeight?: number
  similarityThreshold?: number
}

export type SearchMode = 'hybrid' | 'vector' | 'text'

/**
 * Raw result from pgvector similarity search
 */
interface VectorSearchRow {
  id: string
  file_path: string
  start_line: number
  end_line: number
  content: string
  language: string
  chunk_type: string
  symbol_name: string | null
  similarity: number
}

/**
 * Raw result from hybrid search
 */
interface HybridSearchRow {
  id: string
  file_path: string
  start_line: number
  end_line: number
  content: string
  language: string
  chunk_type: string
  symbol_name: string | null
  combined_score: number
}

/**
 * Transform raw database row to RetrievedChunk
 */
function toRetrievedChunk(
  row: VectorSearchRow | HybridSearchRow,
  scoreField: 'similarity' | 'combined_score'
): RetrievedChunk {
  return {
    id: row.id,
    filePath: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    content: row.content,
    language: row.language,
    chunkType: row.chunk_type,
    symbolName: row.symbol_name,
    score: scoreField === 'similarity'
      ? (row as VectorSearchRow).similarity
      : (row as HybridSearchRow).combined_score,
  }
}

/**
 * Retrieve relevant code chunks using hybrid search (default)
 *
 * Combines vector similarity with full-text search for best results.
 *
 * @param query - The search query (natural language or code)
 * @param repositoryId - UUID of the repository to search
 * @param options - Search options (limit, weights, threshold)
 * @returns Array of relevant code chunks with scores
 */
export async function retrieveRelevantChunks(
  query: string,
  repositoryId: string,
  options: SearchOptions = {}
): Promise<RetrievedChunk[]> {
  const {
    limit = DEFAULT_MATCH_COUNT,
    vectorWeight = DEFAULT_VECTOR_WEIGHT,
    textWeight = DEFAULT_TEXT_WEIGHT,
  } = options

  // Generate query embedding
  const queryEmbedding = await embedQuery(query)

  // Use hybrid search SQL function
  // Note: explicit casts needed because Prisma sends numeric/bigint instead of float/int
  const results = await prisma.$queryRaw<HybridSearchRow[]>`
    SELECT * FROM hybrid_search_code_chunks(
      ${`[${queryEmbedding.join(',')}]`}::vector,
      ${query},
      ${repositoryId}::uuid,
      ${vectorWeight}::float,
      ${textWeight}::float,
      ${limit}::int
    )
  `

  return results.map(row => toRetrievedChunk(row, 'combined_score'))
}

/**
 * Vector-only similarity search
 *
 * Uses pgvector cosine distance for semantic matching.
 * Best for natural language queries.
 *
 * @param query - The search query
 * @param repositoryId - UUID of the repository to search
 * @param options - Search options
 * @returns Array of relevant code chunks with similarity scores
 */
export async function vectorSearch(
  query: string,
  repositoryId: string,
  options: SearchOptions = {}
): Promise<RetrievedChunk[]> {
  const {
    limit = DEFAULT_MATCH_COUNT,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
  } = options

  // Generate query embedding
  const queryEmbedding = await embedQuery(query)

  // Use vector search SQL function
  // Note: explicit casts needed because Prisma sends numeric/bigint instead of float/int
  const results = await prisma.$queryRaw<VectorSearchRow[]>`
    SELECT * FROM match_code_chunks(
      ${`[${queryEmbedding.join(',')}]`}::vector,
      ${repositoryId}::uuid,
      ${similarityThreshold}::float,
      ${limit}::int
    )
  `

  return results.map(row => toRetrievedChunk(row, 'similarity'))
}

/**
 * Full-text search only
 *
 * Uses PostgreSQL full-text search for exact/partial text matches.
 * Best for searching specific function names, variable names, etc.
 *
 * @param query - The search query
 * @param repositoryId - UUID of the repository to search
 * @param options - Search options
 * @returns Array of relevant code chunks with text relevance scores
 */
export async function textSearch(
  query: string,
  repositoryId: string,
  options: SearchOptions = {}
): Promise<RetrievedChunk[]> {
  const { limit = DEFAULT_MATCH_COUNT } = options

  // Sanitize query for full-text search
  const sanitizedQuery = query.replace(/[^\w\s]/g, ' ').trim()

  if (!sanitizedQuery) {
    return []
  }

  const results = await prisma.$queryRaw<(VectorSearchRow & { rank: number })[]>`
    SELECT
      cc.id,
      cc.file_path,
      cc.start_line,
      cc.end_line,
      cc.content,
      cc.language,
      cc.chunk_type,
      cc.symbol_name,
      ts_rank(
        to_tsvector('english', cc.content || ' ' || COALESCE(cc.symbol_name, '')),
        plainto_tsquery('english', ${sanitizedQuery})
      ) AS similarity
    FROM code_chunks cc
    WHERE cc.repository_id = ${repositoryId}::uuid
      AND to_tsvector('english', cc.content || ' ' || COALESCE(cc.symbol_name, ''))
          @@ plainto_tsquery('english', ${sanitizedQuery})
    ORDER BY similarity DESC
    LIMIT ${limit}
  `

  return results.map(row => toRetrievedChunk(row, 'similarity'))
}

/**
 * Smart search that chooses the best strategy based on query
 *
 * - If query looks like code (symbols, operators), uses hybrid search
 * - If query is natural language, uses vector search
 * - If query is a specific identifier, adds text search emphasis
 *
 * @param query - The search query
 * @param repositoryId - UUID of the repository to search
 * @param options - Search options
 * @returns Array of relevant code chunks
 */
export async function smartSearch(
  query: string,
  repositoryId: string,
  options: SearchOptions = {}
): Promise<RetrievedChunk[]> {
  const queryType = detectQueryType(query)

  switch (queryType) {
    case 'identifier':
      // For specific identifiers, boost text search weight
      return retrieveRelevantChunks(query, repositoryId, {
        ...options,
        vectorWeight: 0.4,
        textWeight: 0.6,
      })

    case 'natural_language':
      // For natural language, use default hybrid weights
      return retrieveRelevantChunks(query, repositoryId, options)

    case 'code':
      // For code-like queries, boost vector search
      return retrieveRelevantChunks(query, repositoryId, {
        ...options,
        vectorWeight: 0.8,
        textWeight: 0.2,
      })

    default:
      return retrieveRelevantChunks(query, repositoryId, options)
  }
}

/**
 * Detect the type of query for search optimization
 */
function detectQueryType(query: string): 'identifier' | 'natural_language' | 'code' {
  const trimmed = query.trim()

  // Check for identifier pattern (camelCase, snake_case, PascalCase)
  const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  if (identifierPattern.test(trimmed)) {
    return 'identifier'
  }

  // Check for code-like patterns
  const codePatterns = [
    /[{}()\[\]<>]/, // Brackets
    /[=!<>]+/, // Operators
    /\b(function|class|const|let|var|def|fn|impl)\b/, // Keywords
    /\w+\.\w+/, // Method calls
    /\w+\([^)]*\)/, // Function calls
  ]

  for (const pattern of codePatterns) {
    if (pattern.test(trimmed)) {
      return 'code'
    }
  }

  // Default to natural language
  return 'natural_language'
}

/**
 * Search by file path
 *
 * Retrieves all chunks from a specific file.
 *
 * @param filePath - The file path to search
 * @param repositoryId - UUID of the repository
 * @returns Array of chunks from the file, ordered by line number
 */
export async function searchByFile(
  filePath: string,
  repositoryId: string
): Promise<RetrievedChunk[]> {
  const results = await prisma.code_chunks.findMany({
    where: {
      repository_id: repositoryId,
      file_path: filePath,
    },
    orderBy: {
      start_line: 'asc',
    },
  })

  return results.map(row => ({
    id: row.id,
    filePath: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    content: row.content,
    language: row.language,
    chunkType: row.chunk_type,
    symbolName: row.symbol_name,
    score: 1.0, // Direct file match
  }))
}

/**
 * Search by symbol name
 *
 * Finds chunks that define a specific function, class, or type.
 *
 * @param symbolName - The symbol name to search for
 * @param repositoryId - UUID of the repository
 * @returns Array of chunks that define the symbol
 */
export async function searchBySymbol(
  symbolName: string,
  repositoryId: string
): Promise<RetrievedChunk[]> {
  const results = await prisma.code_chunks.findMany({
    where: {
      repository_id: repositoryId,
      symbol_name: {
        contains: symbolName,
        mode: 'insensitive',
      },
    },
    orderBy: {
      file_path: 'asc',
    },
  })

  return results.map(row => ({
    id: row.id,
    filePath: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    content: row.content,
    language: row.language,
    chunkType: row.chunk_type,
    symbolName: row.symbol_name,
    score: 1.0, // Direct symbol match
  }))
}

/**
 * Search by chunk type
 *
 * Finds all chunks of a specific type (function, class, interface, etc.)
 *
 * @param chunkType - The chunk type to filter by
 * @param repositoryId - UUID of the repository
 * @param limit - Maximum results to return
 * @returns Array of chunks of the specified type
 */
export async function searchByType(
  chunkType: string,
  repositoryId: string,
  limit = 50
): Promise<RetrievedChunk[]> {
  const results = await prisma.code_chunks.findMany({
    where: {
      repository_id: repositoryId,
      chunk_type: chunkType,
    },
    orderBy: {
      file_path: 'asc',
    },
    take: limit,
  })

  return results.map(row => ({
    id: row.id,
    filePath: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    content: row.content,
    language: row.language,
    chunkType: row.chunk_type,
    symbolName: row.symbol_name,
    score: 1.0,
  }))
}

/**
 * Get repository statistics for context
 */
export async function getRepositoryContext(repositoryId: string): Promise<{
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
