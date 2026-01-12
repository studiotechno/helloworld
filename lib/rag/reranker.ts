/**
 * RAG Reranker Module
 *
 * Uses Voyage AI's rerank-2.5 model to improve retrieval quality
 * by re-scoring chunks based on semantic relevance to the query.
 *
 * Reranking is applied after initial retrieval (vector/hybrid search)
 * to promote the most relevant chunks to the top.
 */

import { rerankDocuments, type RerankModel } from '../embeddings/voyage-rerank'
import type { RetrievedChunk } from './retriever'

export interface RerankOptions {
  /** Maximum chunks to keep after reranking (default: 15) */
  topK?: number
  /** Minimum relevance score to include (default: 0) */
  minScore?: number
  /** Rerank model to use (default: rerank-2.5) */
  model?: RerankModel
  /** Whether to include original score info (default: false) */
  preserveOriginalScore?: boolean
}

export interface RerankedChunk extends RetrievedChunk {
  /** Original retrieval score (vector/RRF) */
  originalScore?: number
  /** Rerank relevance score from Voyage */
  rerankScore: number
}

/**
 * Rerank retrieved chunks using Voyage AI
 *
 * Takes the initial retrieval results and re-scores them based on
 * semantic relevance to the query using Voyage's rerank-2.5 model.
 *
 * @param query - The search query
 * @param chunks - Retrieved chunks from vector/hybrid search
 * @param options - Rerank options
 * @returns Reranked chunks sorted by relevance score
 *
 * @example
 * ```typescript
 * // After initial retrieval
 * const chunks = await smartRetrieve(query, repoId)
 *
 * // Apply reranking to improve order
 * const reranked = await rerankChunks(query, chunks.chunks, { topK: 10 })
 * ```
 */
export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[],
  options: RerankOptions = {}
): Promise<RerankedChunk[]> {
  const {
    topK = 15,
    minScore = 0,
    model = 'rerank-2.5',
    preserveOriginalScore = false,
  } = options

  if (chunks.length === 0) {
    return []
  }

  // Skip reranking if we only have a few chunks
  if (chunks.length <= 3) {
    return chunks.map((chunk) => ({
      ...chunk,
      originalScore: preserveOriginalScore ? chunk.score : undefined,
      rerankScore: chunk.score, // Use original score as rerank score
    }))
  }

  // Prepare documents for reranking
  // Include file path and symbol name for better context
  const documents = chunks.map((chunk) => {
    let doc = ''

    // Add metadata prefix for better context
    if (chunk.symbolName) {
      doc += `${chunk.chunkType}: ${chunk.symbolName}\n`
    }
    doc += `File: ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}\n\n`
    doc += chunk.content

    return doc
  })

  try {
    // Call Voyage rerank API
    const result = await rerankDocuments(query, documents, {
      model,
      topK: Math.min(topK, chunks.length),
    })

    // Map back to chunks with rerank scores
    const rerankedChunks: RerankedChunk[] = result.results
      .filter((r) => r.relevanceScore >= minScore)
      .map((r) => ({
        ...chunks[r.index],
        originalScore: preserveOriginalScore ? chunks[r.index].score : undefined,
        rerankScore: r.relevanceScore,
        score: r.relevanceScore, // Update main score for downstream consumers
      }))

    return rerankedChunks
  } catch (error) {
    // Log error but don't fail - return original chunks as fallback
    console.error('[Reranker] Error during reranking, using original order:', error)

    return chunks.slice(0, topK).map((chunk) => ({
      ...chunk,
      originalScore: preserveOriginalScore ? chunk.score : undefined,
      rerankScore: chunk.score,
    }))
  }
}

/**
 * Calculate rerank improvement metrics
 *
 * Useful for debugging and monitoring rerank quality.
 */
export function calculateRerankMetrics(
  originalChunks: RetrievedChunk[],
  rerankedChunks: RerankedChunk[]
): {
  /** Average position change (negative = moved up) */
  avgPositionChange: number
  /** How many chunks changed position */
  chunksReordered: number
  /** Top 3 chunks that moved up the most */
  biggestRisers: { id: string; from: number; to: number }[]
} {
  const originalPositions = new Map<string, number>()
  originalChunks.forEach((chunk, i) => originalPositions.set(chunk.id, i))

  let totalChange = 0
  let reordered = 0
  const risers: { id: string; from: number; to: number }[] = []

  rerankedChunks.forEach((chunk, newPos) => {
    const oldPos = originalPositions.get(chunk.id)
    if (oldPos !== undefined) {
      const change = newPos - oldPos
      totalChange += change
      if (change !== 0) reordered++

      if (change < 0) {
        risers.push({ id: chunk.id, from: oldPos, to: newPos })
      }
    }
  })

  // Sort by how much they rose (higher = bigger rise), descending
  risers.sort((a, b) => (b.from - b.to) - (a.from - a.to))

  return {
    avgPositionChange: rerankedChunks.length > 0 ? totalChange / rerankedChunks.length : 0,
    chunksReordered: reordered,
    biggestRisers: risers.slice(0, 3),
  }
}

/**
 * Get a summary string for logging rerank results
 */
export function getRerankSummary(
  originalCount: number,
  rerankedChunks: RerankedChunk[]
): string {
  if (rerankedChunks.length === 0) {
    return '[Reranker] No chunks to rerank'
  }

  const avgScore =
    rerankedChunks.reduce((sum, c) => sum + c.rerankScore, 0) / rerankedChunks.length

  return `[Reranker] ${originalCount} → ${rerankedChunks.length} chunks, avg score: ${avgScore.toFixed(3)}`
}
