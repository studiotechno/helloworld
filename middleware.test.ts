import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

// Mock the updateSession function
const mockUpdateSession = vi.fn()

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args),
}))

function createMockRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, 'http://localhost:3000'))
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('protected routes', () => {
    it('redirects unauthenticated users from /dashboard to /login', async () => {
      mockUpdateSession.mockResolvedValue({
        supabaseResponse: { headers: new Headers() },
        user: null,
      })

      const request = createMockRequest('/dashboard')
      const response = await middleware(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login')
      expect(response.headers.get('location')).toContain('redirectTo=%2Fdashboard')
    })

    it('redirects unauthenticated users from /chat to /login', async () => {
      mockUpdateSession.mockResolvedValue({
        supabaseResponse: { headers: new Headers() },
        user: null,
      })

      const request = createMockRequest('/chat')
      const response = await middleware(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login')
    })

    it('allows authenticated users to access /dashboard', async () => {
      mockUpdateSession.mockResolvedValue({
        supabaseResponse: { headers: new Headers() },
        user: { id: 'user-123' },
      })

      const request = createMockRequest('/dashboard')
      const response = await middleware(request)

      // Should not redirect (status not 307)
      expect(response.status).not.toBe(307)
    })
  })

  describe('auth routes', () => {
    it('redirects authenticated users from /login to /dashboard', async () => {
      mockUpdateSession.mockResolvedValue({
        supabaseResponse: { headers: new Headers() },
        user: { id: 'user-123' },
      })

      const request = createMockRequest('/login')
      const response = await middleware(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/dashboard')
    })

    it('allows unauthenticated users to access /login', async () => {
      mockUpdateSession.mockResolvedValue({
        supabaseResponse: { headers: new Headers() },
        user: null,
      })

      const request = createMockRequest('/login')
      const response = await middleware(request)

      // Should not redirect (status not 307)
      expect(response.status).not.toBe(307)
    })
  })

  describe('public routes', () => {
    it('allows unauthenticated users to access /', async () => {
      mockUpdateSession.mockResolvedValue({
        supabaseResponse: { headers: new Headers() },
        user: null,
      })

      const request = createMockRequest('/')
      const response = await middleware(request)

      // Should not redirect
      expect(response.status).not.toBe(307)
    })
  })
})
