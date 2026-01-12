import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rerankChunks, calculateRerankMetrics, getRerankSummary } from './reranker'
import type { RetrievedChunk } from './retriever'

// Mock the voyage-rerank module
vi.mock('../embeddings/voyage-rerank', () => ({
  rerankDocuments: vi.fn(),
}))

import { rerankDocuments } from '../embeddings/voyage-rerank'

const mockRerankDocuments = rerankDocuments as ReturnType<typeof vi.fn>

describe('reranker', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    process.env = { ...originalEnv, VOYAGE_API_KEY: 'test-api-key' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  const createMockChunk = (id: string, score: number): RetrievedChunk => ({
    id,
    filePath: `/src/${id}.ts`,
    startLine: 1,
    endLine: 10,
    content: `// Content of ${id}`,
    language: 'typescript',
    chunkType: 'function',
    symbolName: `func_${id}`,
    score,
  })

  describe('rerankChunks', () => {
    it('should rerank chunks using Voyage API', async () => {
      const chunks = [
        createMockChunk('a', 0.8),
        createMockChunk('b', 0.7),
        createMockChunk('c', 0.6),
        createMockChunk('d', 0.5),
      ]

      // Mock rerank API to reorder: c, a, d, b
      mockRerankDocuments.mockResolvedValueOnce({
        results: [
          { index: 2, relevanceScore: 0.95 }, // c moves to top
          { index: 0, relevanceScore: 0.85 }, // a stays near top
          { index: 3, relevanceScore: 0.75 }, // d moves up
          { index: 1, relevanceScore: 0.65 }, // b drops
        ],
        totalTokens: 500,
      })

      const result = await rerankChunks('authentication query', chunks)

      expect(result).toHaveLength(4)
      expect(result[0].id).toBe('c') // c is now first
      expect(result[0].rerankScore).toBe(0.95)
      expect(result[1].id).toBe('a')
      expect(result[2].id).toBe('d')
      expect(result[3].id).toBe('b')

      expect(mockRerankDocuments).toHaveBeenCalledWith(
        'authentication query',
        expect.any(Array),
        expect.objectContaining({ model: 'rerank-2.5' })
      )
    })

    it('should return empty array for empty chunks', async () => {
      const result = await rerankChunks('query', [])

      expect(result).toEqual([])
      expect(mockRerankDocuments).not.toHaveBeenCalled()
    })

    it('should skip reranking for 3 or fewer chunks', async () => {
      const chunks = [
        createMockChunk('a', 0.8),
        createMockChunk('b', 0.7),
        createMockChunk('c', 0.6),
      ]

      const result = await rerankChunks('query', chunks)

      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('a')
      expect(result[0].rerankScore).toBe(0.8)
      expect(mockRerankDocuments).not.toHaveBeenCalled()
    })

    it('should respect topK option', async () => {
      const chunks = [
        createMockChunk('a', 0.8),
        createMockChunk('b', 0.7),
        createMockChunk('c', 0.6),
        createMockChunk('d', 0.5),
        createMockChunk('e', 0.4),
      ]

      mockRerankDocuments.mockResolvedValueOnce({
        results: [
          { index: 2, relevanceScore: 0.95 },
          { index: 0, relevanceScore: 0.85 },
        ],
        totalTokens: 300,
      })

      const result = await rerankChunks('query', chunks, { topK: 2 })

      expect(result).toHaveLength(2)
      expect(mockRerankDocuments).toHaveBeenCalledWith(
        'query',
        expect.any(Array),
        expect.objectContaining({ topK: 2 })
      )
    })

    it('should filter by minScore', async () => {
      const chunks = [
        createMockChunk('a', 0.8),
        createMockChunk('b', 0.7),
        createMockChunk('c', 0.6),
        createMockChunk('d', 0.5),
      ]

      mockRerankDocuments.mockResolvedValueOnce({
        results: [
          { index: 2, relevanceScore: 0.95 },
          { index: 0, relevanceScore: 0.85 },
          { index: 3, relevanceScore: 0.45 }, // Below minScore
          { index: 1, relevanceScore: 0.35 }, // Below minScore
        ],
        totalTokens: 400,
      })

      const result = await rerankChunks('query', chunks, { minScore: 0.5 })

      expect(result).toHaveLength(2)
      expect(result.every((c) => c.rerankScore >= 0.5)).toBe(true)
    })

    it('should preserve original score when option is set', async () => {
      const chunks = [
        createMockChunk('a', 0.8),
        createMockChunk('b', 0.7),
        createMockChunk('c', 0.6),
        createMockChunk('d', 0.5),
      ]

      mockRerankDocuments.mockResolvedValueOnce({
        results: [
          { index: 2, relevanceScore: 0.95 },
          { index: 0, relevanceScore: 0.85 },
        ],
        totalTokens: 200,
      })

      const result = await rerankChunks('query', chunks, {
        topK: 2,
        preserveOriginalScore: true,
      })

      expect(result[0].originalScore).toBe(0.6) // c's original score
      expect(result[1].originalScore).toBe(0.8) // a's original score
    })

    it('should use rerank-2.5-lite when specified', async () => {
      const chunks = [
        createMockChunk('a', 0.8),
        createMockChunk('b', 0.7),
        createMockChunk('c', 0.6),
        createMockChunk('d', 0.5),
      ]

      mockRerankDocuments.mockResolvedValueOnce({
        results: [{ index: 0, relevanceScore: 0.9 }],
        totalTokens: 100,
      })

      await rerankChunks('query', chunks, { model: 'rerank-2.5-lite', topK: 1 })

      expect(mockRerankDocuments).toHaveBeenCalledWith(
        'query',
        expect.any(Array),
        expect.objectContaining({ model: 'rerank-2.5-lite' })
      )
    })

    it('should include file path and symbol in document for better context', async () => {
      const chunks = [
        createMockChunk('a', 0.8),
        createMockChunk('b', 0.7),
        createMockChunk('c', 0.6),
        createMockChunk('d', 0.5),
      ]

      mockRerankDocuments.mockResolvedValueOnce({
        results: [{ index: 0, relevanceScore: 0.9 }],
        totalTokens: 100,
      })

      await rerankChunks('query', chunks, { topK: 1 })

      const passedDocuments = mockRerankDocuments.mock.calls[0][1] as string[]
      expect(passedDocuments[0]).toContain('function: func_a')
      expect(passedDocuments[0]).toContain('File: /src/a.ts:1-10')
    })

    it('should fallback to original order on API error', async () => {
      const chunks = [
        createMockChunk('a', 0.8),
        createMockChunk('b', 0.7),
        createMockChunk('c', 0.6),
        createMockChunk('d', 0.5),
      ]

      mockRerankDocuments.mockRejectedValueOnce(new Error('API Error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await rerankChunks('query', chunks, { topK: 2 })

      // Should return first topK chunks in original order
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('a')
      expect(result[1].id).toBe('b')
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('calculateRerankMetrics', () => {
    it('should calculate position changes', () => {
      const original = [
        createMockChunk('a', 0.8),
        createMockChunk('b', 0.7),
        createMockChunk('c', 0.6),
        createMockChunk('d', 0.5),
      ]

      // c moved from 2 to 0, a stayed at 0→1, d moved 3→2, b moved 1→3
      const reranked = [
        { ...createMockChunk('c', 0.6), rerankScore: 0.95 },
        { ...createMockChunk('a', 0.8), rerankScore: 0.85 },
        { ...createMockChunk('d', 0.5), rerankScore: 0.75 },
        { ...createMockChunk('b', 0.7), rerankScore: 0.65 },
      ]

      const metrics = calculateRerankMetrics(original, reranked)

      expect(metrics.chunksReordered).toBe(4) // All moved
      expect(metrics.biggestRisers).toHaveLength(2) // c and d rose
      expect(metrics.biggestRisers[0].id).toBe('c') // c rose the most (2 → 0)
    })

    it('should handle no reordering', () => {
      const chunks = [
        createMockChunk('a', 0.8),
        createMockChunk('b', 0.7),
      ]

      const reranked = chunks.map((c) => ({ ...c, rerankScore: c.score }))

      const metrics = calculateRerankMetrics(chunks, reranked)

      expect(metrics.chunksReordered).toBe(0)
      expect(metrics.avgPositionChange).toBe(0)
      expect(metrics.biggestRisers).toHaveLength(0)
    })
  })

  describe('getRerankSummary', () => {
    it('should return summary string', () => {
      const reranked = [
        { ...createMockChunk('a', 0.8), rerankScore: 0.95 },
        { ...createMockChunk('b', 0.7), rerankScore: 0.85 },
      ]

      const summary = getRerankSummary(5, reranked)

      expect(summary).toContain('5 → 2 chunks')
      expect(summary).toContain('avg score: 0.900')
    })

    it('should handle empty chunks', () => {
      const summary = getRerankSummary(0, [])

      expect(summary).toBe('[Reranker] No chunks to rerank')
    })
  })
})
