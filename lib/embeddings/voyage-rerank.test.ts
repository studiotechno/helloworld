import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  rerankDocuments,
  rerankAndSelect,
  getAvailableRerankModels,
  getDefaultRerankModel,
  VoyageRerankError,
} from './voyage-rerank'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('voyage-rerank', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    process.env = { ...originalEnv, VOYAGE_API_KEY: 'test-api-key' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('rerankDocuments', () => {
    it('should rerank documents successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            { index: 2, relevance_score: 0.95 },
            { index: 0, relevance_score: 0.85 },
            { index: 1, relevance_score: 0.65 },
          ],
          model: 'rerank-2.5',
          usage: { total_tokens: 150 },
        }),
      })

      const result = await rerankDocuments(
        'How does authentication work?',
        ['Auth module...', 'Database schema...', 'JWT validation...']
      )

      expect(result.results).toHaveLength(3)
      expect(result.results[0]).toEqual({ index: 2, relevanceScore: 0.95 })
      expect(result.results[1]).toEqual({ index: 0, relevanceScore: 0.85 })
      expect(result.results[2]).toEqual({ index: 1, relevanceScore: 0.65 })
      expect(result.totalTokens).toBe(150)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.voyageai.com/v1/rerank',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          },
        })
      )

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.query).toBe('How does authentication work?')
      expect(callBody.documents).toHaveLength(3)
      expect(callBody.model).toBe('rerank-2.5')
      expect(callBody.truncation).toBe(true)
    })

    it('should respect topK option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            { index: 1, relevance_score: 0.95 },
            { index: 0, relevance_score: 0.85 },
          ],
          model: 'rerank-2.5',
          usage: { total_tokens: 100 },
        }),
      })

      const result = await rerankDocuments(
        'query',
        ['doc1', 'doc2', 'doc3'],
        { topK: 2 }
      )

      expect(result.results).toHaveLength(2)

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.top_k).toBe(2)
    })

    it('should use rerank-2.5-lite model when specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ index: 0, relevance_score: 0.9 }],
          model: 'rerank-2.5-lite',
          usage: { total_tokens: 50 },
        }),
      })

      await rerankDocuments('query', ['doc'], { model: 'rerank-2.5-lite' })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.model).toBe('rerank-2.5-lite')
    })

    it('should return empty results for empty documents array', async () => {
      const result = await rerankDocuments('query', [])

      expect(result.results).toEqual([])
      expect(result.totalTokens).toBe(0)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should filter out empty documents and map indices correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            { index: 1, relevance_score: 0.95 }, // corresponds to 'doc3' (original index 2)
            { index: 0, relevance_score: 0.85 }, // corresponds to 'doc1' (original index 0)
          ],
          model: 'rerank-2.5',
          usage: { total_tokens: 100 },
        }),
      })

      const result = await rerankDocuments('query', ['doc1', '', 'doc3', '   '])

      // Should have mapped back to original indices
      expect(result.results).toHaveLength(2)
      expect(result.results[0].index).toBe(2) // doc3's original index
      expect(result.results[1].index).toBe(0) // doc1's original index
    })

    it('should return empty results when all documents are empty', async () => {
      const result = await rerankDocuments('query', ['', '   ', ''])

      expect(result.results).toEqual([])
      expect(result.totalTokens).toBe(0)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should throw error for empty query', async () => {
      await expect(rerankDocuments('', ['doc'])).rejects.toThrow(
        'Query cannot be empty'
      )
    })

    it('should throw error for whitespace-only query', async () => {
      await expect(rerankDocuments('   ', ['doc'])).rejects.toThrow(
        'Query cannot be empty'
      )
    })

    it('should throw error when API key is missing', async () => {
      delete process.env.VOYAGE_API_KEY

      await expect(rerankDocuments('query', ['doc'])).rejects.toThrow(
        'VOYAGE_API_KEY environment variable is not set'
      )
    }, 10000)

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          error: { message: 'Server error', type: 'server_error' },
        }),
      })

      await expect(rerankDocuments('query', ['doc'])).rejects.toThrow(
        VoyageRerankError
      )
    }, 30000) // Longer timeout due to retries

    it('should not retry on auth errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: { message: 'Invalid API key', type: 'authentication_error' },
        }),
      })

      await expect(rerankDocuments('query', ['doc'])).rejects.toThrow(
        'Invalid API key'
      )
      expect(mockFetch).toHaveBeenCalledTimes(1) // No retries
    })

    it('should retry on transient errors', async () => {
      // First call fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({}),
      })

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ index: 0, relevance_score: 0.9 }],
          model: 'rerank-2.5',
          usage: { total_tokens: 50 },
        }),
      })

      const result = await rerankDocuments('query', ['doc'])

      expect(result.results).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    }, 15000) // Longer timeout due to retry delay
  })

  describe('rerankAndSelect', () => {
    it('should rerank and return items with scores', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            { index: 1, relevance_score: 0.95 },
            { index: 0, relevance_score: 0.85 },
          ],
          model: 'rerank-2.5',
          usage: { total_tokens: 100 },
        }),
      })

      const items = [
        { id: 1, content: 'First document' },
        { id: 2, content: 'Second document' },
      ]

      const result = await rerankAndSelect('query', items, 2)

      expect(result).toHaveLength(2)
      expect(result[0].item.id).toBe(2) // Second doc ranked first
      expect(result[0].relevanceScore).toBe(0.95)
      expect(result[1].item.id).toBe(1)
      expect(result[1].relevanceScore).toBe(0.85)
    })

    it('should return empty array for empty items', async () => {
      const result = await rerankAndSelect('query', [])

      expect(result).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should respect topK parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            { index: 2, relevance_score: 0.95 },
            { index: 0, relevance_score: 0.85 },
            { index: 1, relevance_score: 0.75 },
          ],
          model: 'rerank-2.5',
          usage: { total_tokens: 100 },
        }),
      })

      const items = [
        { content: 'doc1' },
        { content: 'doc2' },
        { content: 'doc3' },
      ]

      const result = await rerankAndSelect('query', items, 3)

      expect(result).toHaveLength(3)

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.top_k).toBe(3)
    })

    it('should use model option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ index: 0, relevance_score: 0.9 }],
          model: 'rerank-2.5-lite',
          usage: { total_tokens: 50 },
        }),
      })

      await rerankAndSelect('query', [{ content: 'doc' }], 1, { model: 'rerank-2.5-lite' })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.model).toBe('rerank-2.5-lite')
    })
  })

  describe('getAvailableRerankModels', () => {
    it('should return available models', () => {
      const models = getAvailableRerankModels()

      expect(models).toContain('rerank-2.5')
      expect(models).toContain('rerank-2.5-lite')
      expect(models).toHaveLength(2)
    })
  })

  describe('getDefaultRerankModel', () => {
    it('should return rerank-2.5', () => {
      expect(getDefaultRerankModel()).toBe('rerank-2.5')
    })
  })
})
