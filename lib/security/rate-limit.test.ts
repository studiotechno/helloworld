import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkRateLimit,
  createRateLimiter,
  rateLimitHeaders,
  rateLimitExceededResponse,
  RATE_LIMITS,
  cleanupInMemoryStore,
} from './rate-limit'

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clean up in-memory store between tests
    cleanupInMemoryStore()
  })

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      const result = await checkRateLimit('test-user-1', 'default')

      expect(result.success).toBe(true)
      expect(result.remaining).toBe(RATE_LIMITS.default.requests - 1)
      expect(result.limit).toBe(RATE_LIMITS.default.requests)
    })

    it('should track requests correctly', async () => {
      const identifier = 'test-user-2'

      // First request
      const result1 = await checkRateLimit(identifier, { requests: 3, window: 60 })
      expect(result1.success).toBe(true)
      expect(result1.remaining).toBe(2)

      // Second request
      const result2 = await checkRateLimit(identifier, { requests: 3, window: 60 })
      expect(result2.success).toBe(true)
      expect(result2.remaining).toBe(1)

      // Third request
      const result3 = await checkRateLimit(identifier, { requests: 3, window: 60 })
      expect(result3.success).toBe(true)
      expect(result3.remaining).toBe(0)

      // Fourth request - should be rate limited
      const result4 = await checkRateLimit(identifier, { requests: 3, window: 60 })
      expect(result4.success).toBe(false)
      expect(result4.remaining).toBe(0)
    })

    it('should use preset configurations', async () => {
      const chatResult = await checkRateLimit('chat-user', 'chat')
      expect(chatResult.limit).toBe(RATE_LIMITS.chat.requests)

      const indexResult = await checkRateLimit('index-user', 'indexation')
      expect(indexResult.limit).toBe(RATE_LIMITS.indexation.requests)
    })

    it('should isolate different identifiers', async () => {
      const result1 = await checkRateLimit('user-a', { requests: 1, window: 60 })
      expect(result1.success).toBe(true)

      // Different user should have their own limit
      const result2 = await checkRateLimit('user-b', { requests: 1, window: 60 })
      expect(result2.success).toBe(true)

      // First user is now rate limited
      const result3 = await checkRateLimit('user-a', { requests: 1, window: 60 })
      expect(result3.success).toBe(false)
    })
  })

  describe('createRateLimiter', () => {
    it('should create a reusable limiter instance', async () => {
      const limiter = createRateLimiter('strict')

      expect(limiter.config).toEqual(RATE_LIMITS.strict)

      const result = await limiter.check('limiter-test')
      expect(result.success).toBe(true)
    })
  })

  describe('rateLimitHeaders', () => {
    it('should generate correct headers', () => {
      const result = {
        success: true,
        remaining: 5,
        reset: 1234567890,
        limit: 10,
      }

      const headers = rateLimitHeaders(result)

      expect(headers).toEqual({
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '5',
        'X-RateLimit-Reset': '1234567890',
      })
    })
  })

  describe('rateLimitExceededResponse', () => {
    it('should create a 429 response', async () => {
      const result = {
        success: false,
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 60,
        limit: 10,
      }

      const response = rateLimitExceededResponse(result)

      expect(response.status).toBe(429)

      const body = await response.json()
      expect(body.error.code).toBe('RATE_LIMITED')
      expect(body.error.retryAfter).toBeGreaterThan(0)
    })
  })
})
