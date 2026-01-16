/**
 * Rate Limiting Module
 *
 * Provides rate limiting for API routes using either:
 * - Vercel KV (production) if KV_REST_API_URL is configured
 * - In-memory store (development) as fallback
 *
 * Usage:
 *   const limiter = createRateLimiter({ requests: 10, window: '1m' })
 *   const { success, remaining, reset } = await limiter.check(identifier)
 */

import { kv } from '@vercel/kv'

// Rate limit configuration presets
export const RATE_LIMITS = {
  // Chat endpoint - expensive AI calls
  chat: { requests: 20, window: 60 }, // 20 requests per minute
  // Indexation - resource intensive
  indexation: { requests: 5, window: 60 }, // 5 per minute
  // Stripe checkout - prevent abuse
  checkout: { requests: 10, window: 60 }, // 10 per minute
  // General API - default
  default: { requests: 60, window: 60 }, // 60 per minute
  // Strict - for sensitive operations
  strict: { requests: 5, window: 300 }, // 5 per 5 minutes
} as const

export type RateLimitPreset = keyof typeof RATE_LIMITS

export interface RateLimitConfig {
  requests: number // Max requests allowed
  window: number // Time window in seconds
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number // Unix timestamp when limit resets
  limit: number
}

// In-memory store for development (not suitable for production with multiple instances)
const inMemoryStore = new Map<string, { count: number; resetAt: number }>()

// Check if Vercel KV is configured
function isKVConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

/**
 * Rate limiter using Vercel KV (sliding window)
 */
async function checkWithKV(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowMs = config.window * 1000
  const windowStart = now - windowMs

  // Use a sorted set to track requests with timestamps
  const kvKey = `ratelimit:${key}`

  try {
    // Remove expired entries and add current request in a pipeline
    const pipeline = kv.pipeline()

    // Remove entries older than the window
    pipeline.zremrangebyscore(kvKey, 0, windowStart)

    // Add current request
    pipeline.zadd(kvKey, { score: now, member: `${now}-${Math.random()}` })

    // Count requests in window
    pipeline.zcard(kvKey)

    // Set expiry on the key
    pipeline.expire(kvKey, config.window + 1)

    const results = await pipeline.exec()
    const count = (results[2] as number) || 0

    const success = count <= config.requests
    const remaining = Math.max(0, config.requests - count)
    const reset = Math.ceil((now + windowMs) / 1000)

    return {
      success,
      remaining,
      reset,
      limit: config.requests,
    }
  } catch (error) {
    console.error('[RateLimit] KV error, falling back to allow:', error)
    // On error, allow the request but log it
    return {
      success: true,
      remaining: config.requests,
      reset: Math.ceil((now + windowMs) / 1000),
      limit: config.requests,
    }
  }
}

/**
 * Rate limiter using in-memory store (for development)
 */
function checkInMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const windowMs = config.window * 1000

  const stored = inMemoryStore.get(key)

  // Clean up expired entry or create new one
  if (!stored || stored.resetAt < now) {
    inMemoryStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })
    return {
      success: true,
      remaining: config.requests - 1,
      reset: Math.ceil((now + windowMs) / 1000),
      limit: config.requests,
    }
  }

  // Increment counter
  stored.count++
  const success = stored.count <= config.requests
  const remaining = Math.max(0, config.requests - stored.count)

  return {
    success,
    remaining,
    reset: Math.ceil(stored.resetAt / 1000),
    limit: config.requests,
  }
}

/**
 * Clean up old entries from in-memory store (call periodically)
 */
export function cleanupInMemoryStore(): void {
  const now = Date.now()
  for (const [key, value] of inMemoryStore.entries()) {
    if (value.resetAt < now) {
      inMemoryStore.delete(key)
    }
  }
}

// Run cleanup every 5 minutes in development
if (typeof setInterval !== 'undefined' && !isKVConfigured()) {
  setInterval(cleanupInMemoryStore, 5 * 60 * 1000)
}

/**
 * Check rate limit for a given identifier
 */
export async function checkRateLimit(
  identifier: string,
  preset: RateLimitPreset | RateLimitConfig = 'default'
): Promise<RateLimitResult> {
  const config = typeof preset === 'string' ? RATE_LIMITS[preset] : preset

  if (isKVConfigured()) {
    return checkWithKV(identifier, config)
  }

  return checkInMemory(identifier, config)
}

/**
 * Create a rate limiter instance for a specific configuration
 */
export function createRateLimiter(preset: RateLimitPreset | RateLimitConfig) {
  return {
    check: (identifier: string) => checkRateLimit(identifier, preset),
    config: typeof preset === 'string' ? RATE_LIMITS[preset] : preset,
  }
}

/**
 * Generate rate limit headers for response
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  }
}

/**
 * Create a rate limit exceeded response
 */
export function rateLimitExceededResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: 'RATE_LIMITED',
        message: 'Trop de requêtes. Veuillez réessayer plus tard.',
        retryAfter: result.reset - Math.floor(Date.now() / 1000),
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.reset - Math.floor(Date.now() / 1000)),
        ...rateLimitHeaders(result),
      },
    }
  )
}
