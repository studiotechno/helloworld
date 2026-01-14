import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  embedCode,
  embedQuery,
  cosineSimilarity,
  getEmbeddingDimensions,
  getModelName,
  VoyageClientError,
} from './voyage-client'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('voyage-client', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    process.env = { ...originalEnv, VOYAGE_API_KEY: 'test-api-key' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('embedCode', () => {
    it('should embed a single code chunk', async () => {
      const mockEmbedding = new Array(1024).fill(0.1)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
          model: 'voyage-code-3',
          usage: { total_tokens: 100 },
        }),
      })

      const result = await embedCode(['function hello() { return "world"; }'])

      expect(result.embeddings).toHaveLength(1)
      expect(result.embeddings[0]).toHaveLength(1024)
      expect(result.totalTokens).toBe(100)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.voyageai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          },
        })
      )
    })

    it('should handle multiple chunks', async () => {
      const mockEmbedding1 = new Array(1024).fill(0.1)
      const mockEmbedding2 = new Array(1024).fill(0.2)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            { object: 'embedding', embedding: mockEmbedding1, index: 0 },
            { object: 'embedding', embedding: mockEmbedding2, index: 1 },
          ],
          model: 'voyage-code-3',
          usage: { total_tokens: 200 },
        }),
      })

      const result = await embedCode(['chunk1', 'chunk2'])

      expect(result.embeddings).toHaveLength(2)
      expect(result.embeddings[0]).toEqual(mockEmbedding1)
      expect(result.embeddings[1]).toEqual(mockEmbedding2)
      expect(result.totalTokens).toBe(200)
    })

    it('should return empty array for empty input', async () => {
      const result = await embedCode([])
      expect(result.embeddings).toEqual([])
      expect(result.totalTokens).toBe(0)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle empty strings with zero vectors', async () => {
      const mockEmbedding = new Array(1024).fill(0.1)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
          model: 'voyage-code-3',
          usage: { total_tokens: 100 },
        }),
      })

      const result = await embedCode(['valid code', '', '   '])

      expect(result.embeddings).toHaveLength(3)
      expect(result.embeddings[0]).toEqual(mockEmbedding)
      expect(result.embeddings[1]).toEqual(new Array(1024).fill(0)) // Empty string
      expect(result.embeddings[2]).toEqual(new Array(1024).fill(0)) // Whitespace only
      expect(result.totalTokens).toBe(100)
    })

    it('should batch large inputs', async () => {
      const mockEmbedding = new Array(1024).fill(0.1)
      const chunks = new Array(150).fill('code chunk')

      // First batch (128 chunks)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: new Array(128).fill({
            object: 'embedding',
            embedding: mockEmbedding,
            index: 0,
          }),
          model: 'voyage-code-3',
          usage: { total_tokens: 1000 },
        }),
      })

      // Second batch (22 chunks)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: new Array(22).fill({
            object: 'embedding',
            embedding: mockEmbedding,
            index: 0,
          }),
          model: 'voyage-code-3',
          usage: { total_tokens: 200 },
        }),
      })

      const result = await embedCode(chunks)

      expect(result.embeddings).toHaveLength(150)
      expect(result.totalTokens).toBe(1200) // 1000 + 200
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should throw error when API key is missing', async () => {
      delete process.env.VOYAGE_API_KEY

      await expect(embedCode(['code'])).rejects.toThrow(
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

      await expect(embedCode(['code'])).rejects.toThrow(VoyageClientError)
    }, 30000) // Longer timeout due to retries

    it('should retry on transient errors', async () => {
      const mockEmbedding = new Array(1024).fill(0.1)

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
          data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
          model: 'voyage-code-3',
          usage: { total_tokens: 100 },
        }),
      })

      const result = await embedCode(['code'])

      expect(result.embeddings).toHaveLength(1)
      expect(result.totalTokens).toBe(100)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    }, 15000) // Longer timeout due to retry delay
  })

  describe('embedQuery', () => {
    it('should embed a query', async () => {
      const mockEmbedding = new Array(1024).fill(0.5)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          object: 'list',
          data: [{ object: 'embedding', embedding: mockEmbedding, index: 0 }],
          model: 'voyage-code-3',
          usage: { total_tokens: 50 },
        }),
      })

      const result = await embedQuery('What does this function do?')

      expect(result).toHaveLength(1024)
      expect(result).toEqual(mockEmbedding)

      // Verify input_type is 'query'
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.input_type).toBe('query')
    })

    it('should throw error for empty query', async () => {
      await expect(embedQuery('')).rejects.toThrow(VoyageClientError)
      await expect(embedQuery('')).rejects.toThrow('Query cannot be empty')
    })

    it('should throw error for whitespace-only query', async () => {
      await expect(embedQuery('   ')).rejects.toThrow('Query cannot be empty')
    })
  })

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vector = [0.1, 0.2, 0.3, 0.4, 0.5]
      expect(cosineSimilarity(vector, vector)).toBeCloseTo(1)
    })

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0]
      const b = [0, 1, 0]
      expect(cosineSimilarity(a, b)).toBeCloseTo(0)
    })

    it('should return -1 for opposite vectors', () => {
      const a = [1, 0, 0]
      const b = [-1, 0, 0]
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1)
    })

    it('should handle zero vectors', () => {
      const a = [0, 0, 0]
      const b = [1, 2, 3]
      expect(cosineSimilarity(a, b)).toBe(0)
    })

    it('should throw error for different length vectors', () => {
      expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(
        'Vectors must have the same length'
      )
    })
  })

  describe('getEmbeddingDimensions', () => {
    it('should return 1024', () => {
      expect(getEmbeddingDimensions()).toBe(1024)
    })
  })

  describe('getModelName', () => {
    it('should return voyage-code-3', () => {
      expect(getModelName()).toBe('voyage-code-3')
    })
  })
})
