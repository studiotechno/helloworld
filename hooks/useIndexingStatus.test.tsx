import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useIndexingStatus, getStatusLabel, getStatusColor } from './useIndexingStatus'
import type { IndexingStatusData } from '@/components/repos/IndexingProgress'
import type { ReactNode } from 'react'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('useIndexingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const mockNotStartedResponse: IndexingStatusData = {
    status: 'not_started',
    isIndexed: false,
  }

  const mockInProgressResponse: IndexingStatusData = {
    status: 'parsing',
    jobId: 'job-123',
    progress: 45,
    filesTotal: 100,
    filesProcessed: 45,
    chunksCreated: 120,
    currentPhase: 'Parsing code',
    isIndexed: false,
  }

  const mockCompletedResponse: IndexingStatusData = {
    status: 'completed',
    jobId: 'job-123',
    progress: 100,
    isIndexed: true,
  }

  const mockFailedResponse: IndexingStatusData = {
    status: 'failed',
    jobId: 'job-123',
    progress: 30,
    error: 'GitHub API rate limit exceeded',
    isIndexed: false,
  }

  describe('status fetching', () => {
    it('should return initial loading state', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      const { result } = renderHook(() => useIndexingStatus('repo-123'), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.statusData).toBeNull()
    })

    it('should fetch status successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompletedResponse),
      })

      const { result } = renderHook(() => useIndexingStatus('repo-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.status).toBe('completed')
      expect(result.current.isIndexed).toBe(true)
      expect(result.current.isCompleted).toBe(true)
    })

    it('should not fetch when repositoryId is null', () => {
      const { result } = renderHook(() => useIndexingStatus(null), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should not fetch when repositoryId is undefined', () => {
      const { result } = renderHook(() => useIndexingStatus(undefined), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('derived state', () => {
    it('should calculate isInProgress correctly for parsing status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInProgressResponse),
      })

      const { result } = renderHook(() => useIndexingStatus('repo-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isInProgress).toBe(true)
      })

      expect(result.current.isCompleted).toBe(false)
      expect(result.current.isFailed).toBe(false)
      expect(result.current.progress).toBe(45)
    })

    it('should calculate isFailed correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFailedResponse),
      })

      const { result } = renderHook(() => useIndexingStatus('repo-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isFailed).toBe(true)
      })

      expect(result.current.isCompleted).toBe(false)
      expect(result.current.isInProgress).toBe(false)
      expect(result.current.error).toBe('GitHub API rate limit exceeded')
    })

    it('should calculate isCompleted for indexed status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'indexed', isIndexed: true }),
      })

      const { result } = renderHook(() => useIndexingStatus('repo-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isCompleted).toBe(true)
      })

      expect(result.current.isIndexed).toBe(true)
    })
  })

  describe('startIndexing mutation', () => {
    it('should call POST endpoint to start indexing', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockNotStartedResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jobId: 'new-job', status: 'pending' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'pending', isIndexed: false }),
        })

      const { result } = renderHook(() => useIndexingStatus('repo-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.startIndexing()
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/repos/repo-123/index', {
          method: 'POST',
        })
      })
    })
  })

  describe('cancelIndexing mutation', () => {
    it('should call DELETE endpoint to cancel indexing', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockInProgressResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'cancelled', isIndexed: false }),
        })

      const { result } = renderHook(() => useIndexingStatus('repo-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.cancelIndexing()
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/repos/repo-123/index', {
          method: 'DELETE',
        })
      })
    })
  })

  describe('error handling', () => {
    it('should handle fetch error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Not found' } }),
      })

      const { result } = renderHook(() => useIndexingStatus('repo-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.queryError).toBeTruthy()
      })
    })
  })

  describe('onStatusChange callback', () => {
    it('should call onStatusChange when status is fetched', async () => {
      const onStatusChange = vi.fn()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompletedResponse),
      })

      renderHook(
        () => useIndexingStatus('repo-123', { onStatusChange }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith(mockCompletedResponse)
      })
    })
  })

  describe('polling behavior', () => {
    it('should not poll when status is completed', async () => {
      vi.useFakeTimers()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompletedResponse),
      })

      renderHook(() => useIndexingStatus('repo-123'), {
        wrapper: createWrapper(),
      })

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Advance time - should not poll again
      await vi.advanceTimersByTimeAsync(5000)

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})

describe('getStatusLabel', () => {
  it('should return correct label for not_started', () => {
    expect(getStatusLabel('not_started')).toBe('Non indexe')
  })

  it('should return correct label for pending', () => {
    expect(getStatusLabel('pending')).toBe('En attente')
  })

  it('should return correct label for fetching', () => {
    expect(getStatusLabel('fetching')).toBe('Telechargement')
  })

  it('should return correct label for parsing', () => {
    expect(getStatusLabel('parsing')).toBe('Analyse')
  })

  it('should return correct label for embedding', () => {
    expect(getStatusLabel('embedding')).toBe('Embeddings')
  })

  it('should return correct label for completed', () => {
    expect(getStatusLabel('completed')).toBe('Indexe')
  })

  it('should return correct label for indexed', () => {
    expect(getStatusLabel('indexed')).toBe('Indexe')
  })

  it('should return correct label for failed', () => {
    expect(getStatusLabel('failed')).toBe('Echec')
  })

  it('should return correct label for cancelled', () => {
    expect(getStatusLabel('cancelled')).toBe('Annule')
  })
})

describe('getStatusColor', () => {
  it('should return muted color for not_started', () => {
    expect(getStatusColor('not_started')).toBe('text-muted-foreground')
  })

  it('should return green for completed', () => {
    expect(getStatusColor('completed')).toBe('text-green-500')
  })

  it('should return green for indexed', () => {
    expect(getStatusColor('indexed')).toBe('text-green-500')
  })

  it('should return destructive for failed', () => {
    expect(getStatusColor('failed')).toBe('text-destructive')
  })

  it('should return blue for parsing', () => {
    expect(getStatusColor('parsing')).toBe('text-blue-500')
  })

  it('should return purple for embedding', () => {
    expect(getStatusColor('embedding')).toBe('text-purple-500')
  })
})
