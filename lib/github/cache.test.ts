import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCachedRepos, setCachedRepos, invalidateCachedRepos } from './cache'
import type { GitHubRepo } from './types'

// Mock @vercel/kv
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}))

import { kv } from '@vercel/kv'

const mockKv = kv as unknown as {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
}

describe('GitHub Cache', () => {
  const mockRepos: GitHubRepo[] = [
    {
      id: 1,
      name: 'repo-1',
      full_name: 'user/repo-1',
      description: 'Test repo',
      private: false,
      language: 'TypeScript',
      default_branch: 'main',
      updated_at: '2026-01-09T10:00:00Z',
      pushed_at: '2026-01-09T10:00:00Z',
      size: 1024,
      stargazers_count: 5,
    },
  ]

  const userId = 'test-user-id'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCachedRepos', () => {
    it('should return cached repos when available', async () => {
      mockKv.get.mockResolvedValue(mockRepos)

      const result = await getCachedRepos(userId)

      expect(mockKv.get).toHaveBeenCalledWith(`repos:${userId}`)
      expect(result).toEqual(mockRepos)
    })

    it('should return null on cache miss', async () => {
      mockKv.get.mockResolvedValue(null)

      const result = await getCachedRepos(userId)

      expect(result).toBeNull()
    })

    it('should return null and log error on cache failure', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockKv.get.mockRejectedValue(new Error('KV connection failed'))

      const result = await getCachedRepos(userId)

      expect(result).toBeNull()
      expect(consoleError).toHaveBeenCalledWith(
        '[Cache] Error getting cached repos:',
        expect.any(Error)
      )
      consoleError.mockRestore()
    })
  })

  describe('setCachedRepos', () => {
    it('should cache repos with 5-minute TTL', async () => {
      mockKv.set.mockResolvedValue('OK')

      await setCachedRepos(userId, mockRepos)

      expect(mockKv.set).toHaveBeenCalledWith(
        `repos:${userId}`,
        mockRepos,
        { ex: 300 } // 5 minutes in seconds
      )
    })

    it('should not throw on cache failure', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockKv.set.mockRejectedValue(new Error('KV write failed'))

      // Should not throw
      await expect(setCachedRepos(userId, mockRepos)).resolves.toBeUndefined()

      expect(consoleError).toHaveBeenCalledWith(
        '[Cache] Error caching repos:',
        expect.any(Error)
      )
      consoleError.mockRestore()
    })
  })

  describe('invalidateCachedRepos', () => {
    it('should delete cached repos for user', async () => {
      mockKv.del.mockResolvedValue(1)

      await invalidateCachedRepos(userId)

      expect(mockKv.del).toHaveBeenCalledWith(`repos:${userId}`)
    })

    it('should not throw on delete failure', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockKv.del.mockRejectedValue(new Error('KV delete failed'))

      await expect(invalidateCachedRepos(userId)).resolves.toBeUndefined()

      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })
})
