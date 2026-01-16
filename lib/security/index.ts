/**
 * Security Module
 *
 * Provides security utilities for the application:
 * - Rate limiting
 * - Secure API handlers
 * - Encryption for sensitive data
 */

export {
  checkRateLimit,
  createRateLimiter,
  rateLimitHeaders,
  rateLimitExceededResponse,
  RATE_LIMITS,
  type RateLimitPreset,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limit'

export {
  createSecureHandler,
  createPublicHandler,
  withParams,
  type HandlerContext,
  type PublicHandlerContext,
  type SecureHandlerOptions,
  type PublicHandlerOptions,
} from './api-handler'

export {
  encrypt,
  decrypt,
  encryptToken,
  decryptToken,
  isEncrypted,
} from './encryption'
