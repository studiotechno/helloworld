import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useConnectRepo } from './useConnectRepo'

// Mock fetch
const originalFetch = global.fetch
const mockFetch = vi.fn()

beforeEach(() => {
  global.fetch = mockFetch
})

afterEach(() => {
  global.fetch = originalFetch
  vi.clearAllMocks()
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return Wrapper
}

describe('useConnectRepo', () => {
  it('should connect a repository successfully', async () => {
    const mockResponse = {
      repository: {
        id: 'test-uuid',
        user_id: 'user-uuid',
        github_repo_id: '12345',
        full_name: 'owner/repo',
        default_branch: 'main',
        is_active: true,
        last_synced_at: '2026-01-09T10:00:00Z',
        created_at: '2026-01-09T10:00:00Z',
      },
      warning: null,
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const { result } = renderHook(() => useConnectRepo(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      repoId: 12345,
      fullName: 'owner/repo',
      defaultBranch: 'main',
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockResponse)
    expect(mockFetch).toHaveBeenCalledWith('/api/repos/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoId: 12345,
        fullName: 'owner/repo',
        defaultBranch: 'main',
      }),
    })
  })

  it('should return warning for large repositories', async () => {
    const mockResponse = {
      repository: {
        id: 'test-uuid',
        user_id: 'user-uuid',
        github_repo_id: '12345',
        full_name: 'owner/large-repo',
        default_branch: 'main',
        is_active: true,
        last_synced_at: null,
        created_at: '2026-01-09T10:00:00Z',
      },
      warning: {
        code: 'SIZE_WARNING',
        message: 'Ce repository depasse la limite recommandee',
      },
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const { result } = renderHook(() => useConnectRepo(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      repoId: 12345,
      fullName: 'owner/large-repo',
      defaultBranch: 'main',
      size: 1000, // Large repo
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.warning).not.toBeNull()
    expect(result.current.data?.warning?.code).toBe('SIZE_WARNING')
  })

  it('should handle connection errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: { code: 'CONNECT_FAILED', message: 'Connection failed' },
        }),
    })

    const { result } = renderHook(() => useConnectRepo(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      repoId: 12345,
      fullName: 'owner/repo',
      defaultBranch: 'main',
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('Connection failed')
  })

  it('should be in idle state initially', () => {
    const { result } = renderHook(() => useConnectRepo(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isIdle).toBe(true)
    expect(result.current.data).toBeUndefined()
  })
})
