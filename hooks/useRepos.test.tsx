import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useRepos } from './useRepos'

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
        retry: false, // Disable retries for faster tests
      },
    },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return Wrapper
}

describe('useRepos', () => {
  it('should fetch repos successfully', async () => {
    const mockRepos = [
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

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockRepos),
    })

    const { result } = renderHook(() => useRepos(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockRepos)
    expect(mockFetch).toHaveBeenCalledWith('/api/repos')
  })

  it('should be in loading state initially', () => {
    mockFetch.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    const { result } = renderHook(() => useRepos(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('should call the correct API endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })

    renderHook(() => useRepos(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/repos')
    })
  })

  it('should return empty array when no repos', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const { result } = renderHook(() => useRepos(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
  })
})
