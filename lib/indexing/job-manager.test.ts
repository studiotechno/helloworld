import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Prisma functions using vi.hoisted
const {
  mockFindUnique,
  mockFindMany,
  mockCreate,
  mockUpdate,
  mockUpdateMany,
  mockDelete,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockDelete: vi.fn(),
}))

// Mock Prisma client
vi.mock('../db/prisma', () => ({
  prisma: {
    indexing_jobs: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      create: mockCreate,
      update: mockUpdate,
      updateMany: mockUpdateMany,
      delete: mockDelete,
    },
  },
}))

// Import after mocking
import {
  startIndexingJob,
  getJobStatus,
  getJobByRepository,
  updateJobProgress,
  updateJobStatus,
  markJobStarted,
  markJobCompleted,
  markJobFailed,
  cancelJob,
  deleteJob,
  isJobTerminal,
  isJobInProgress,
  calculateProgress,
  getJobsForUser,
  getInProgressJobs,
  cleanupStaleJobs,
} from './job-manager'

describe('job-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // Helper to create mock job data
  const createMockJob = (overrides = {}) => ({
    id: 'job-123',
    repository_id: 'repo-456',
    status: 'pending',
    progress: 0,
    files_total: 0,
    files_processed: 0,
    chunks_created: 0,
    current_phase: 'Initializing',
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: new Date('2026-01-12T10:00:00Z'),
    ...overrides,
  })

  describe('startIndexingJob', () => {
    it('should create a new job when none exists', async () => {
      mockFindUnique.mockResolvedValue(null)
      mockCreate.mockResolvedValue(createMockJob())

      const result = await startIndexingJob('repo-456')

      expect(result.isNew).toBe(true)
      expect(result.jobId).toBe('job-123')
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          repository_id: 'repo-456',
          status: 'pending',
          progress: 0,
          files_total: 0,
          files_processed: 0,
          chunks_created: 0,
          current_phase: 'Initializing',
        },
      })
    })

    it('should return existing job if in progress', async () => {
      mockFindUnique.mockResolvedValue(createMockJob({ status: 'fetching' }))

      const result = await startIndexingJob('repo-456')

      expect(result.isNew).toBe(false)
      expect(result.existingStatus).toBe('fetching')
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('should delete and recreate job if completed', async () => {
      mockFindUnique.mockResolvedValue(createMockJob({ status: 'completed' }))
      mockDelete.mockResolvedValue(createMockJob())
      mockCreate.mockResolvedValue(createMockJob({ id: 'new-job-789' }))

      const result = await startIndexingJob('repo-456')

      expect(result.isNew).toBe(true)
      expect(result.jobId).toBe('new-job-789')
      expect(mockDelete).toHaveBeenCalled()
      expect(mockCreate).toHaveBeenCalled()
    })

    it('should delete and recreate job if failed', async () => {
      mockFindUnique.mockResolvedValue(
        createMockJob({ status: 'failed', error_message: 'Previous error' })
      )
      mockDelete.mockResolvedValue(createMockJob())
      mockCreate.mockResolvedValue(createMockJob({ id: 'retry-job' }))

      const result = await startIndexingJob('repo-456')

      expect(result.isNew).toBe(true)
      expect(mockDelete).toHaveBeenCalled()
    })
  })

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      mockFindUnique.mockResolvedValue(createMockJob({ progress: 50 }))

      const job = await getJobStatus('job-123')

      expect(job).not.toBeNull()
      expect(job!.id).toBe('job-123')
      expect(job!.progress).toBe(50)
    })

    it('should return null for non-existent job', async () => {
      mockFindUnique.mockResolvedValue(null)

      const job = await getJobStatus('non-existent')

      expect(job).toBeNull()
    })
  })

  describe('getJobByRepository', () => {
    it('should return job by repository ID', async () => {
      mockFindUnique.mockResolvedValue(createMockJob())

      const job = await getJobByRepository('repo-456')

      expect(job).not.toBeNull()
      expect(job!.repositoryId).toBe('repo-456')
    })
  })

  describe('updateJobProgress', () => {
    it('should update progress fields', async () => {
      mockUpdate.mockResolvedValue(
        createMockJob({
          files_total: 100,
          files_processed: 50,
          progress: 50,
        })
      )

      const job = await updateJobProgress('job-123', {
        filesTotal: 100,
        filesProcessed: 50,
        progress: 50,
      })

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          files_total: 100,
          files_processed: 50,
          progress: 50,
        },
      })
      expect(job.progress).toBe(50)
    })

    it('should clamp progress to 0-100', async () => {
      mockUpdate.mockResolvedValue(createMockJob({ progress: 100 }))

      await updateJobProgress('job-123', { progress: 150 })

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: { progress: 100 },
      })
    })

    it('should update current phase', async () => {
      mockUpdate.mockResolvedValue(createMockJob({ current_phase: 'Parsing code' }))

      await updateJobProgress('job-123', { currentPhase: 'Parsing code' })

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: { current_phase: 'Parsing code' },
      })
    })
  })

  describe('updateJobStatus', () => {
    it('should update status', async () => {
      mockFindUnique.mockResolvedValue(createMockJob())
      mockUpdate.mockResolvedValue(createMockJob({ status: 'fetching' }))

      const job = await updateJobStatus('job-123', 'fetching')

      expect(job.status).toBe('fetching')
    })

    it('should set started_at when transitioning to active status', async () => {
      mockFindUnique.mockResolvedValue(createMockJob({ started_at: null }))
      mockUpdate.mockResolvedValue(createMockJob({ status: 'fetching' }))

      await updateJobStatus('job-123', 'fetching')

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            started_at: expect.any(Date),
          }),
        })
      )
    })

    it('should set completed_at when transitioning to terminal status', async () => {
      mockUpdate.mockResolvedValue(createMockJob({ status: 'completed' }))

      await updateJobStatus('job-123', 'completed')

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completed_at: expect.any(Date),
            progress: 100,
          }),
        })
      )
    })
  })

  describe('markJobStarted', () => {
    it('should mark job as started with files total', async () => {
      mockUpdate.mockResolvedValue(
        createMockJob({
          status: 'fetching',
          files_total: 100,
          started_at: new Date(),
        })
      )

      const job = await markJobStarted('job-123', 100)

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          status: 'fetching',
          current_phase: 'Fetching files',
          files_total: 100,
          started_at: expect.any(Date),
        },
      })
      expect(job.filesTotal).toBe(100)
    })
  })

  describe('markJobCompleted', () => {
    it('should mark job as completed', async () => {
      mockUpdate.mockResolvedValue(
        createMockJob({
          status: 'completed',
          progress: 100,
          chunks_created: 250,
        })
      )

      const job = await markJobCompleted('job-123', 250)

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          status: 'completed',
          progress: 100,
          chunks_created: 250,
          current_phase: null,
          completed_at: expect.any(Date),
        },
      })
      expect(job.chunksCreated).toBe(250)
    })
  })

  describe('markJobFailed', () => {
    it('should mark job as failed with error message', async () => {
      mockUpdate.mockResolvedValue(
        createMockJob({
          status: 'failed',
          error_message: 'API rate limit exceeded',
        })
      )

      const job = await markJobFailed('job-123', 'API rate limit exceeded')

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          status: 'failed',
          error_message: 'API rate limit exceeded',
          completed_at: expect.any(Date),
        },
      })
      expect(job.errorMessage).toBe('API rate limit exceeded')
    })
  })

  describe('cancelJob', () => {
    it('should cancel an in-progress job', async () => {
      mockFindUnique.mockResolvedValue(createMockJob({ status: 'parsing' }))
      mockUpdate.mockResolvedValue(createMockJob({ status: 'cancelled' }))

      const job = await cancelJob('job-123')

      expect(job).not.toBeNull()
      expect(job!.status).toBe('cancelled')
    })

    it('should return existing job if already completed', async () => {
      mockFindUnique.mockResolvedValue(createMockJob({ status: 'completed' }))

      const job = await cancelJob('job-123')

      expect(job).not.toBeNull()
      expect(job!.status).toBe('completed')
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('should return null for non-existent job', async () => {
      mockFindUnique.mockResolvedValue(null)

      const job = await cancelJob('non-existent')

      expect(job).toBeNull()
    })
  })

  describe('deleteJob', () => {
    it('should delete job and return true', async () => {
      mockDelete.mockResolvedValue(createMockJob())

      const result = await deleteJob('job-123')

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockDelete.mockRejectedValue(new Error('Not found'))

      const result = await deleteJob('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('isJobTerminal', () => {
    it('should return true for terminal statuses', () => {
      expect(isJobTerminal('completed')).toBe(true)
      expect(isJobTerminal('failed')).toBe(true)
      expect(isJobTerminal('cancelled')).toBe(true)
    })

    it('should return false for non-terminal statuses', () => {
      expect(isJobTerminal('pending')).toBe(false)
      expect(isJobTerminal('fetching')).toBe(false)
      expect(isJobTerminal('parsing')).toBe(false)
      expect(isJobTerminal('embedding')).toBe(false)
    })
  })

  describe('isJobInProgress', () => {
    it('should return true for in-progress statuses', () => {
      expect(isJobInProgress('pending')).toBe(true)
      expect(isJobInProgress('fetching')).toBe(true)
      expect(isJobInProgress('parsing')).toBe(true)
      expect(isJobInProgress('embedding')).toBe(true)
    })

    it('should return false for terminal statuses', () => {
      expect(isJobInProgress('completed')).toBe(false)
      expect(isJobInProgress('failed')).toBe(false)
      expect(isJobInProgress('cancelled')).toBe(false)
    })
  })

  describe('calculateProgress', () => {
    it('should return 0 for empty files', () => {
      expect(calculateProgress(0, 0, 'Fetching files')).toBe(0)
    })

    it('should calculate progress for fetching phase (0-10%)', () => {
      expect(calculateProgress(0, 100, 'Fetching files')).toBe(0)
      expect(calculateProgress(50, 100, 'Fetching files')).toBe(5)
      expect(calculateProgress(100, 100, 'Fetching files')).toBe(10)
    })

    it('should calculate progress for parsing phase (10-50%)', () => {
      expect(calculateProgress(0, 100, 'Parsing code')).toBe(10)
      expect(calculateProgress(50, 100, 'Parsing code')).toBe(30)
      expect(calculateProgress(100, 100, 'Parsing code')).toBe(50)
    })

    it('should calculate progress for embedding phase (50-95%)', () => {
      expect(calculateProgress(0, 100, 'Generating embeddings')).toBe(50)
      expect(calculateProgress(50, 100, 'Generating embeddings')).toBe(73)
      expect(calculateProgress(100, 100, 'Generating embeddings')).toBe(95)
    })

    it('should return 95% for finalizing phase', () => {
      expect(calculateProgress(100, 100, 'Finalizing')).toBe(95)
    })

    it('should return 0 for initializing phase', () => {
      expect(calculateProgress(0, 100, 'Initializing')).toBe(0)
    })
  })

  describe('getJobsForUser', () => {
    it('should return jobs for user repositories', async () => {
      mockFindMany.mockResolvedValue([
        createMockJob({ id: 'job-1' }),
        createMockJob({ id: 'job-2' }),
      ])

      const jobs = await getJobsForUser('user-123')

      expect(jobs).toHaveLength(2)
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          repository: {
            user_id: 'user-123',
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      })
    })
  })

  describe('getInProgressJobs', () => {
    it('should return all in-progress jobs', async () => {
      mockFindMany.mockResolvedValue([
        createMockJob({ status: 'fetching' }),
        createMockJob({ status: 'parsing' }),
      ])

      const jobs = await getInProgressJobs()

      expect(jobs).toHaveLength(2)
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          status: {
            in: ['pending', 'fetching', 'parsing', 'embedding'],
          },
        },
      })
    })
  })

  describe('cleanupStaleJobs', () => {
    it('should mark stale jobs as failed', async () => {
      mockUpdateMany.mockResolvedValue({ count: 3 })

      const count = await cleanupStaleJobs(30)

      expect(count).toBe(3)
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          status: {
            in: ['pending', 'fetching', 'parsing', 'embedding'],
          },
          OR: expect.any(Array),
        },
        data: {
          status: 'failed',
          error_message: 'Job timed out - please retry',
          completed_at: expect.any(Date),
        },
      })
    })

    it('should return 0 when no stale jobs', async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 })

      const count = await cleanupStaleJobs()

      expect(count).toBe(0)
    })
  })
})
