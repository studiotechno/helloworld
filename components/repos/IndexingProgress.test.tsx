import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IndexingProgress, IndexingBadge, type IndexingStatusData } from './IndexingProgress'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('IndexingProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any pending timers
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
    filesTotal: 100,
    filesProcessed: 100,
    chunksCreated: 250,
    isIndexed: true,
    stats: {
      totalChunks: 250,
      totalFiles: 100,
      languages: { typescript: 200, python: 50 },
      chunkTypes: { function: 150, class: 50, other: 50 },
    },
  }

  const mockFailedResponse: IndexingStatusData = {
    status: 'failed',
    jobId: 'job-123',
    progress: 30,
    error: 'GitHub API rate limit exceeded',
    isIndexed: false,
  }

  describe('loading state', () => {
    it('should show loading indicator initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<IndexingProgress repositoryId="repo-123" />)

      expect(screen.getByText('Chargement...')).toBeInTheDocument()
    })
  })

  describe('not started state', () => {
    it('should show "not indexed" message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotStartedResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" />)

      await waitFor(() => {
        expect(screen.getByText('Repository non indexe')).toBeInTheDocument()
      })
    })

    it('should show start indexing button', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotStartedResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" />)

      await waitFor(() => {
        expect(screen.getByText("Demarrer l'indexation")).toBeInTheDocument()
      })
    })

    it('should start indexing when button clicked', async () => {
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
          json: () => Promise.resolve({ ...mockInProgressResponse, status: 'pending' }),
        })

      const onStartIndexing = vi.fn()
      render(<IndexingProgress repositoryId="repo-123" onStartIndexing={onStartIndexing} />)

      await waitFor(() => {
        expect(screen.getByText("Demarrer l'indexation")).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText("Demarrer l'indexation"))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/repos/repo-123/index', { method: 'POST' })
      })
    })

    it('should show compact button in compact mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotStartedResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" compact />)

      await waitFor(() => {
        expect(screen.getByText('Indexer')).toBeInTheDocument()
      })
    })
  })

  describe('in progress state', () => {
    it('should show progress bar with percentage', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInProgressResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" />)

      await waitFor(() => {
        expect(screen.getByText('45%')).toBeInTheDocument()
      })
    })

    it('should show files processed count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInProgressResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" />)

      await waitFor(() => {
        expect(screen.getByText('45 / 100 fichiers')).toBeInTheDocument()
      })
    })

    it('should show current phase', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInProgressResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" />)

      await waitFor(() => {
        expect(screen.getByText('Analyse du code')).toBeInTheDocument()
      })
    })

    it('should show chunks created', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInProgressResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" />)

      await waitFor(() => {
        expect(screen.getByText('120 sections creees')).toBeInTheDocument()
      })
    })

    it('should poll status every 2 seconds', async () => {
      vi.useFakeTimers()

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockInProgressResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ...mockInProgressResponse, progress: 60 }),
        })

      render(<IndexingProgress repositoryId="repo-123" />)

      // Wait for initial fetch
      await vi.waitFor(() => {
        expect(screen.getByText('45%')).toBeInTheDocument()
      })

      // Advance time by 2 seconds for polling
      await vi.advanceTimersByTimeAsync(2000)

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })

      vi.useRealTimers()
    })

    it('should show compact view with percentage only', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInProgressResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" compact />)

      await waitFor(() => {
        expect(screen.getByText('45%')).toBeInTheDocument()
      })
      expect(screen.queryByText('45 / 100 fichiers')).not.toBeInTheDocument()
    })
  })

  describe('completed state', () => {
    it('should show completed message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompletedResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" />)

      await waitFor(() => {
        expect(screen.getByText('Indexation terminee')).toBeInTheDocument()
      })
    })

    it('should show stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompletedResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" />)

      await waitFor(() => {
        expect(screen.getByText(/100 fichiers/)).toBeInTheDocument()
        expect(screen.getByText(/250 sections/)).toBeInTheDocument()
      })
    })

    it('should show re-index button', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompletedResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" />)

      await waitFor(() => {
        expect(screen.getByText('Re-indexer')).toBeInTheDocument()
      })
    })

    it('should show compact badge in compact mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompletedResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" compact />)

      await waitFor(() => {
        expect(screen.getByText('Indexé')).toBeInTheDocument()
      })
    })

    it('should not poll when completed', async () => {
      vi.useFakeTimers()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompletedResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" />)

      await vi.waitFor(() => {
        expect(screen.getByText('Indexation terminee')).toBeInTheDocument()
      })

      // Advance time - should not poll
      await vi.advanceTimersByTimeAsync(5000)

      expect(mockFetch).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })
  })

  describe('failed state', () => {
    it('should show error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFailedResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" />)

      await waitFor(() => {
        expect(screen.getByText('Indexation echouee')).toBeInTheDocument()
        expect(screen.getByText('GitHub API rate limit exceeded')).toBeInTheDocument()
      })
    })

    it('should show retry button', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFailedResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" />)

      await waitFor(() => {
        expect(screen.getByText('Reessayer')).toBeInTheDocument()
      })
    })

    it('should show compact error badge', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFailedResponse),
      })

      render(<IndexingProgress repositoryId="repo-123" compact />)

      await waitFor(() => {
        expect(screen.getByText('Echec')).toBeInTheDocument()
      })
    })
  })

  describe('callback props', () => {
    it('should call onStatusChange when status updates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInProgressResponse),
      })

      const onStatusChange = vi.fn()
      render(<IndexingProgress repositoryId="repo-123" onStatusChange={onStatusChange} />)

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith(mockInProgressResponse)
      })
    })
  })
})

describe('IndexingBadge', () => {
  it('should show not started badge', () => {
    render(<IndexingBadge status="not_started" />)
    expect(screen.getByText('Non indexe')).toBeInTheDocument()
  })

  it('should show indexed badge', () => {
    render(<IndexingBadge status="completed" />)
    expect(screen.getByText('Indexe')).toBeInTheDocument()
  })

  it('should show in-progress badge', () => {
    render(<IndexingBadge status="parsing" />)
    expect(screen.getByText('Analyse')).toBeInTheDocument()
  })

  it('should show failed badge', () => {
    render(<IndexingBadge status="failed" />)
    expect(screen.getByText('Echec')).toBeInTheDocument()
  })

  it('should show cancelled badge', () => {
    render(<IndexingBadge status="cancelled" />)
    expect(screen.getByText('Annule')).toBeInTheDocument()
  })
})
