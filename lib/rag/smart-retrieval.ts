/**
 * Smart Retrieval for RAG
 *
 * Combines multiple strategies:
 * 1. LLM-powered query expansion for intelligent term extraction
 * 2. Metadata-based retrieval for structured queries (endpoints, components, etc.)
 * 3. Hybrid search (vector + BM25 with RRF) for general queries
 * 4. Symbol search for function/class name lookups
 *
 * This provides exhaustive results for "list all X" queries while maintaining
 * semantic search quality for specific questions.
 */

import { prisma } from '../db/prisma'
import { classifyQuery, getMetadataFilter, type QueryType } from './query-classifier'
import { retrieveRelevantChunks, type RetrievedChunk } from './retriever'
import { hybridSearchV2, searchSymbols, toRetrievedChunks } from './hybrid-search'
import { rerankChunks, getRerankSummary, type RerankOptions } from './reranker'
import { expandQuery, toFilePathPatterns, toSearchQuery, getExpansionSummary, type ExpandedQuery } from './query-expander'
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
  forceStrategy?: 'vector' | 'metadata' | 'hybrid' | 'hybrid_v2' | 'symbol'
  /** Minimum confidence to use metadata strategy (default: 0.3) */
  minConfidence?: number
  /** Use optimized hybrid search v2 with RRF (default: true) */
  useHybridV2?: boolean
  /** RRF constant for hybrid search (default: 60) */
  rrfK?: number
  /** Enable reranking with Voyage AI (default: true) */
  useReranking?: boolean
  /** Rerank options */
  rerankOptions?: RerankOptions
  /** Enable LLM-powered query expansion (default: true) */
  useQueryExpansion?: boolean
}

export interface SmartRetrievalResult {
  chunks: RetrievedChunk[]
  strategy: 'vector' | 'metadata' | 'hybrid' | 'hybrid_v2' | 'symbol' | 'expanded'
  queryType: QueryType
  isListQuery: boolean
  totalFound: number
  /** Whether reranking was applied */
  reranked: boolean
  /** Number of chunks before reranking */
  chunksBeforeRerank?: number
  /** Query expansion result if used */
  expansion?: ExpandedQuery
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
 * Detect if a query looks like a symbol/identifier lookup
 */
function isSymbolQuery(query: string): boolean {
  const trimmed = query.trim()
  // Check for identifier pattern (camelCase, snake_case, PascalCase)
  const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  return identifierPattern.test(trimmed)
}

/**
 * Retrieve chunks using expanded query patterns
 */
async function retrieveByExpansion(
  repositoryId: string,
  expansion: ExpandedQuery,
  limit: number
): Promise<RetrievedChunk[]> {
  const filePatterns = toFilePathPatterns(expansion)
  if (filePatterns.length === 0) return []

  const chunks = await prisma.code_chunks.findMany({
    where: {
      repository_id: repositoryId,
      OR: filePatterns.map((pattern) => ({
        file_path: { contains: pattern.replace(/%/g, '') },
      })),
    },
    orderBy: [
      { file_path: 'asc' },
      { start_line: 'asc' },
    ],
    take: limit,
  })

  return chunks.map((chunk) => ({
    id: chunk.id,
    filePath: chunk.file_path,
    startLine: chunk.start_line,
    endLine: chunk.end_line,
    content: chunk.content,
    language: chunk.language,
    chunkType: chunk.chunk_type,
    symbolName: chunk.symbol_name,
    score: 0.9, // Slightly lower than exact metadata matches
  }))
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
    useHybridV2 = true, // Use optimized hybrid search by default
    rrfK = 60,
    useReranking = true, // Enable reranking by default
    rerankOptions = {},
    useQueryExpansion = true, // Enable LLM query expansion by default
  } = options

  // Classify the query using keyword matching
  const { type: queryType, isListQuery, confidence } = classifyQuery(query)

  // For GENERIC queries or low confidence, use LLM query expansion
  let expansion: ExpandedQuery | undefined
  const shouldExpand = useQueryExpansion && (queryType === 'GENERIC' || confidence < minConfidence)

  if (shouldExpand) {
    try {
      expansion = await expandQuery(query)
      console.log(getExpansionSummary(expansion))
    } catch (error) {
      console.error('[SmartRetrieval] Query expansion failed:', error)
    }
  }

  // Determine strategy
  let strategy: 'vector' | 'metadata' | 'hybrid' | 'hybrid_v2' | 'symbol' | 'expanded'

  if (forceStrategy) {
    strategy = forceStrategy as typeof strategy
  } else if (isSymbolQuery(query)) {
    // Query looks like a symbol/identifier → try symbol search first
    strategy = 'symbol'
  } else if (expansion && expansion.filePatterns.length > 0) {
    // We have expanded patterns → use expansion-guided retrieval
    strategy = 'expanded'
  } else if (queryType !== 'GENERIC' && isListQuery && confidence >= minConfidence) {
    // List query with detected type → metadata-based
    strategy = 'metadata'
  } else if (useHybridV2) {
    // Use optimized hybrid search with RRF by default
    strategy = 'hybrid_v2'
  } else if (queryType !== 'GENERIC' && confidence >= minConfidence) {
    // Specific type detected but not a list query → legacy hybrid
    strategy = 'hybrid'
  } else {
    // Generic query → vector search
    strategy = 'vector'
  }

  let chunks: RetrievedChunk[] = []

  switch (strategy) {
    case 'expanded':
      // LLM-guided retrieval: combine expansion patterns with hybrid search
      if (expansion) {
        // Get the expanded search query (keywords + concepts)
        const expandedSearchQuery = toSearchQuery(expansion)

        // Run both expansion-based metadata search and hybrid search in parallel
        const [expansionChunks, hybridChunks] = await Promise.all([
          retrieveByExpansion(repositoryId, expansion, Math.floor(metadataLimit / 2)),
          hybridSearchV2(expandedSearchQuery || query, repositoryId, {
            limit: vectorLimit,
            rrfK,
          }).then(toRetrievedChunks),
        ])

        // Merge and deduplicate, prioritizing higher scores
        chunks = deduplicateChunks([...expansionChunks, ...hybridChunks])
        chunks.sort((a, b) => b.score - a.score)
      }
      break

    case 'metadata':
      // Pure metadata-based retrieval
      chunks = await retrieveByMetadata(repositoryId, queryType, metadataLimit)
      break

    case 'symbol':
      // Symbol search with fallback to hybrid
      const symbolResults = await searchSymbols(query, repositoryId)
      if (symbolResults.length > 0) {
        chunks = symbolResults.map(r => ({
          id: r.id,
          filePath: r.filePath,
          startLine: r.startLine,
          endLine: r.endLine,
          content: r.content,
          language: r.language,
          chunkType: r.chunkType,
          symbolName: r.symbolName,
          context: r.context,
          score: r.similarity,
        }))
      } else {
        // Fallback to hybrid_v2 if no symbols found
        const hybridResults = await hybridSearchV2(query, repositoryId, {
          limit: vectorLimit,
          rrfK,
        })
        chunks = toRetrievedChunks(hybridResults)
        strategy = 'hybrid_v2' // Update strategy to reflect actual method used
      }
      break

    case 'hybrid_v2':
      // Optimized hybrid search with RRF fusion
      const v2Results = await hybridSearchV2(query, repositoryId, {
        limit: vectorLimit,
        rrfK,
      })
      chunks = toRetrievedChunks(v2Results)
      break

    case 'hybrid':
      // Legacy: Combine metadata and vector search
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

  // Apply reranking if enabled and we have enough chunks
  const chunksBeforeRerank = chunks.length
  let reranked = false

  if (useReranking && chunks.length > 3) {
    try {
      const rerankedChunks = await rerankChunks(query, chunks, {
        topK: rerankOptions.topK ?? 10,
        minScore: rerankOptions.minScore ?? 0,
        model: rerankOptions.model ?? 'rerank-2.5',
      })
      chunks = rerankedChunks
      reranked = true

      // Log rerank summary
      console.log(getRerankSummary(chunksBeforeRerank, rerankedChunks))
    } catch (error) {
      // Log but don't fail - use original chunks
      console.error('[SmartRetrieval] Reranking failed, using original order:', error)
    }
  }

  return {
    chunks,
    strategy,
    queryType,
    isListQuery,
    totalFound: chunks.length,
    reranked,
    chunksBeforeRerank: reranked ? chunksBeforeRerank : undefined,
    expansion,
  }
}

/**
 * Get a summary of what was retrieved for logging/debugging
 */
export function getRetrievalSummary(result: SmartRetrievalResult): string {
  const { strategy, queryType, isListQuery, totalFound, chunks, reranked, chunksBeforeRerank, expansion } = result

  const uniqueFiles = new Set(chunks.map((c) => c.filePath)).size
  const rerankInfo = reranked ? `, Reranked: ${chunksBeforeRerank} → ${totalFound}` : ''
  const expansionInfo = expansion ? `, Expanded: [${expansion.filePatterns.slice(0, 3).join(', ')}${expansion.filePatterns.length > 3 ? '...' : ''}]` : ''

  return `[SmartRetrieval] Strategy: ${strategy}, Type: ${queryType}, ListQuery: ${isListQuery}, Found: ${totalFound} chunks across ${uniqueFiles} files${rerankInfo}${expansionInfo}`
}
