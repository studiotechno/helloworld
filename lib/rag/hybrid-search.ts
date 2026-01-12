/**
 * Optimized Hybrid Search Service
 *
 * Combines vector similarity search with BM25-style full-text search
 * using Reciprocal Rank Fusion (RRF) for optimal result blending.
 *
 * Uses persistent search_vector column with GIN index for fast full-text search.
 */

import { prisma } from '../db/prisma'
import { embedQuery } from '../embeddings/voyage-client'

// Default search parameters
const DEFAULT_MATCH_COUNT = 15
const DEFAULT_RRF_K = 60 // RRF constant (higher = smoother blending)
const DEFAULT_VECTOR_LIMIT = 50 // How many vector results to consider
const DEFAULT_TEXT_LIMIT = 50 // How many text results to consider

export interface HybridSearchOptions {
  /** Maximum results to return (default: 15) */
  limit?: number
  /** RRF constant - higher values = smoother blending (default: 60) */
  rrfK?: number
  /** How many vector results to consider before RRF (default: 50) */
  vectorLimit?: number
  /** How many text results to consider before RRF (default: 50) */
  textLimit?: number
}

export interface HybridSearchResult {
  id: string
  filePath: string
  startLine: number
  endLine: number
  content: string
  language: string
  chunkType: string
  symbolName: string | null
  context: string | null
  vectorScore: number
  textScore: number
  rrfScore: number
}

/**
 * Raw result from the optimized hybrid search function
 */
interface HybridSearchV2Row {
  id: string
  file_path: string
  start_line: number
  end_line: number
  content: string
  language: string
  chunk_type: string
  symbol_name: string | null
  context: string | null
  vector_score: number
  text_score: number
  rrf_score: number
}

/**
 * Perform optimized hybrid search using RRF fusion
 *
 * This function combines:
 * - Vector similarity search (semantic understanding)
 * - BM25-style full-text search (exact keyword matching)
 *
 * Results are fused using Reciprocal Rank Fusion (RRF):
 * score = 1/(k + rank_vector) + 1/(k + rank_text)
 *
 * @param query - The search query (natural language or code)
 * @param repositoryId - UUID of the repository to search
 * @param options - Search options
 * @returns Array of search results with individual and combined scores
 */
export async function hybridSearchV2(
  query: string,
  repositoryId: string,
  options: HybridSearchOptions = {}
): Promise<HybridSearchResult[]> {
  const {
    limit = DEFAULT_MATCH_COUNT,
    rrfK = DEFAULT_RRF_K,
    vectorLimit = DEFAULT_VECTOR_LIMIT,
    textLimit = DEFAULT_TEXT_LIMIT,
  } = options

  // Generate query embedding
  const queryEmbedding = await embedQuery(query)

  // Call the optimized hybrid search function
  const results = await prisma.$queryRaw<HybridSearchV2Row[]>`
    SELECT * FROM hybrid_search_code_chunks_v2(
      ${`[${queryEmbedding.join(',')}]`}::vector,
      ${query},
      ${repositoryId}::uuid,
      ${rrfK}::int,
      ${limit}::int,
      ${vectorLimit}::int,
      ${textLimit}::int
    )
  `

  return results.map(row => ({
    id: row.id,
    filePath: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    content: row.content,
    language: row.language,
    chunkType: row.chunk_type,
    symbolName: row.symbol_name,
    context: row.context,
    vectorScore: row.vector_score,
    textScore: row.text_score,
    rrfScore: row.rrf_score,
  }))
}

/**
 * Result from symbol search
 */
export interface SymbolSearchResult {
  id: string
  filePath: string
  startLine: number
  endLine: number
  content: string
  language: string
  chunkType: string
  symbolName: string
  context: string | null
  similarity: number
}

/**
 * Raw result from symbol search function
 */
interface SymbolSearchRow {
  id: string
  file_path: string
  start_line: number
  end_line: number
  content: string
  language: string
  chunk_type: string
  symbol_name: string
  context: string | null
  similarity: number
}

/**
 * Search for code symbols by name pattern
 *
 * Uses trigram similarity for fuzzy matching of function, class,
 * and type names. Useful for finding symbols even with typos.
 *
 * @param symbolPattern - The symbol name pattern to search for
 * @param repositoryId - UUID of the repository to search
 * @param chunkType - Optional: filter by chunk type (function, class, etc.)
 * @param limit - Maximum results to return (default: 20)
 * @returns Array of matching symbols sorted by similarity
 */
export async function searchSymbols(
  symbolPattern: string,
  repositoryId: string,
  chunkType?: string,
  limit = 20
): Promise<SymbolSearchResult[]> {
  const results = await prisma.$queryRaw<SymbolSearchRow[]>`
    SELECT * FROM search_code_symbols(
      ${symbolPattern},
      ${repositoryId}::uuid,
      ${chunkType || null},
      ${limit}::int
    )
  `

  return results.map(row => ({
    id: row.id,
    filePath: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    content: row.content,
    language: row.language,
    chunkType: row.chunk_type,
    symbolName: row.symbol_name,
    context: row.context,
    similarity: row.similarity,
  }))
}

/**
 * Result from file search
 */
export interface FileSearchResult {
  filePath: string
  chunkCount: number
}

/**
 * Raw result from file search function
 */
interface FileSearchRow {
  file_path: string
  chunk_count: bigint
}

/**
 * Search for files by path pattern
 *
 * Uses trigram similarity for fuzzy matching of file paths.
 * Returns files with the number of code chunks in each.
 *
 * @param filePattern - The file path pattern to search for
 * @param repositoryId - UUID of the repository to search
 * @param limit - Maximum results to return (default: 20)
 * @returns Array of matching file paths sorted by similarity
 */
export async function searchFiles(
  filePattern: string,
  repositoryId: string,
  limit = 20
): Promise<FileSearchResult[]> {
  const results = await prisma.$queryRaw<FileSearchRow[]>`
    SELECT * FROM search_code_files(
      ${filePattern},
      ${repositoryId}::uuid,
      ${limit}::int
    )
  `

  return results.map(row => ({
    filePath: row.file_path,
    chunkCount: Number(row.chunk_count),
  }))
}

/**
 * Analyze search results to understand the contribution of each search type
 */
export function analyzeSearchResults(results: HybridSearchResult[]): {
  totalResults: number
  avgVectorScore: number
  avgTextScore: number
  avgRrfScore: number
  vectorOnlyCount: number
  textOnlyCount: number
  bothCount: number
} {
  if (results.length === 0) {
    return {
      totalResults: 0,
      avgVectorScore: 0,
      avgTextScore: 0,
      avgRrfScore: 0,
      vectorOnlyCount: 0,
      textOnlyCount: 0,
      bothCount: 0,
    }
  }

  let totalVectorScore = 0
  let totalTextScore = 0
  let totalRrfScore = 0
  let vectorOnlyCount = 0
  let textOnlyCount = 0
  let bothCount = 0

  for (const result of results) {
    totalVectorScore += result.vectorScore
    totalTextScore += result.textScore
    totalRrfScore += result.rrfScore

    if (result.vectorScore > 0 && result.textScore > 0) {
      bothCount++
    } else if (result.vectorScore > 0) {
      vectorOnlyCount++
    } else if (result.textScore > 0) {
      textOnlyCount++
    }
  }

  return {
    totalResults: results.length,
    avgVectorScore: totalVectorScore / results.length,
    avgTextScore: totalTextScore / results.length,
    avgRrfScore: totalRrfScore / results.length,
    vectorOnlyCount,
    textOnlyCount,
    bothCount,
  }
}

/**
 * Convert hybrid search results to the standard RetrievedChunk format
 * for compatibility with existing code
 */
export function toRetrievedChunks(results: HybridSearchResult[]): {
  id: string
  filePath: string
  startLine: number
  endLine: number
  content: string
  language: string
  chunkType: string
  symbolName: string | null
  context: string | null
  score: number
}[] {
  return results.map(r => ({
    id: r.id,
    filePath: r.filePath,
    startLine: r.startLine,
    endLine: r.endLine,
    content: r.content,
    language: r.language,
    chunkType: r.chunkType,
    symbolName: r.symbolName,
    context: r.context,
    score: r.rrfScore, // Use RRF score as the primary score
  }))
}
