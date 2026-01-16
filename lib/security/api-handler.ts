/**
 * Secure API Handler Wrapper
 *
 * Provides a unified wrapper for API routes that handles:
 * - Authentication (required by default)
 * - Rate limiting (configurable)
 * - Error handling
 * - Security headers
 *
 * Usage:
 *   export const POST = createSecureHandler({
 *     rateLimit: 'chat',
 *     handler: async (req, { user }) => {
 *       // Your handler logic
 *       return NextResponse.json({ data })
 *     }
 *   })
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/sync-user'
import {
  checkRateLimit,
  rateLimitHeaders,
  rateLimitExceededResponse,
  type RateLimitPreset,
  type RateLimitConfig,
} from './rate-limit'
import type { users } from '@prisma/client'

// Handler context provided to the route handler
export interface HandlerContext {
  user: users
  request: Request
}

// Handler context for public routes (no auth required)
export interface PublicHandlerContext {
  user: users | null
  request: Request
}

// Route params for dynamic routes
export interface RouteParams<T = Record<string, string>> {
  params: Promise<T>
}

// Handler function types
type AuthenticatedHandler = (
  request: Request,
  context: HandlerContext
) => Promise<Response>

type PublicHandler = (
  request: Request,
  context: PublicHandlerContext
) => Promise<Response>

// Configuration options
export interface SecureHandlerOptions {
  // Rate limiting preset or custom config (false to disable)
  rateLimit?: RateLimitPreset | RateLimitConfig | false
  // Custom rate limit identifier generator (default: user ID or IP)
  rateLimitKey?: (request: Request, user: users | null) => string
  // Handler function
  handler: AuthenticatedHandler
}

export interface PublicHandlerOptions {
  // Rate limiting preset or custom config (false to disable)
  rateLimit?: RateLimitPreset | RateLimitConfig | false
  // Custom rate limit identifier generator
  rateLimitKey?: (request: Request) => string
  // Handler function (receives user if authenticated, null otherwise)
  handler: PublicHandler
}

/**
 * Extract client identifier for rate limiting
 */
function getClientIdentifier(request: Request, user: users | null): string {
  // Use user ID if authenticated
  if (user) {
    return `user:${user.id}`
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  return `ip:${ip}`
}

/**
 * Create a secure API handler with authentication and rate limiting
 */
export function createSecureHandler(options: SecureHandlerOptions) {
  const { rateLimit = 'default', rateLimitKey, handler } = options

  return async (request: Request): Promise<Response> => {
    try {
      // 1. Authenticate user
      const user = await getCurrentUser()

      if (!user) {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Non authentifié' } },
          { status: 401 }
        )
      }

      // 2. Check rate limit
      if (rateLimit !== false) {
        const identifier = rateLimitKey
          ? rateLimitKey(request, user)
          : getClientIdentifier(request, user)

        const rateLimitResult = await checkRateLimit(identifier, rateLimit)

        if (!rateLimitResult.success) {
          return rateLimitExceededResponse(rateLimitResult)
        }

        // Execute handler and add rate limit headers to response
        const response = await handler(request, { user, request })

        // Clone response to add headers
        const newHeaders = new Headers(response.headers)
        Object.entries(rateLimitHeaders(rateLimitResult)).forEach(
          ([key, value]) => {
            newHeaders.set(key, value)
          }
        )

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        })
      }

      // 3. Execute handler without rate limiting
      return handler(request, { user, request })
    } catch (error) {
      console.error('[API] Handler error:', error)

      return NextResponse.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Une erreur est survenue',
          },
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Create a public API handler (no auth required, but rate limited)
 */
export function createPublicHandler(options: PublicHandlerOptions) {
  const { rateLimit = 'default', rateLimitKey, handler } = options

  return async (request: Request): Promise<Response> => {
    try {
      // 1. Try to get user (optional)
      const user = await getCurrentUser()

      // 2. Check rate limit
      if (rateLimit !== false) {
        const identifier = rateLimitKey
          ? rateLimitKey(request)
          : getClientIdentifier(request, user)

        const rateLimitResult = await checkRateLimit(identifier, rateLimit)

        if (!rateLimitResult.success) {
          return rateLimitExceededResponse(rateLimitResult)
        }

        // Execute handler and add rate limit headers
        const response = await handler(request, { user, request })

        const newHeaders = new Headers(response.headers)
        Object.entries(rateLimitHeaders(rateLimitResult)).forEach(
          ([key, value]) => {
            newHeaders.set(key, value)
          }
        )

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        })
      }

      // 3. Execute handler without rate limiting
      return handler(request, { user, request })
    } catch (error) {
      console.error('[API] Handler error:', error)

      return NextResponse.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Une erreur est survenue',
          },
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Wrapper for handlers with route params (dynamic routes)
 */
export function withParams<T extends Record<string, string>>(
  handler: (
    request: Request,
    context: HandlerContext,
    params: T
  ) => Promise<Response>,
  options: Omit<SecureHandlerOptions, 'handler'>
) {
  return async (
    request: Request,
    { params }: RouteParams<T>
  ): Promise<Response> => {
    const resolvedParams = await params

    const secureHandler = createSecureHandler({
      ...options,
      handler: async (req, ctx) => handler(req, ctx, resolvedParams),
    })

    return secureHandler(request)
  }
}
