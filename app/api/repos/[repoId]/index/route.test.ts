import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock functions using vi.hoisted
const {
  mockGetCurrentUser,
  mockFindUnique,
  mockStartIndexingJob,
  mockCancelJob,
  mockGetJobByRepository,
  mockIsJobInProgress,
  mockRunIndexationPipeline,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockFindUnique: vi.fn(),
  mockStartIndexingJob: vi.fn(),
  mockCancelJob: vi.fn(),
  mockGetJobByRepository: vi.fn(),
  mockIsJobInProgress: vi.fn(),
  mockRunIndexationPipeline: vi.fn(),
}))

// Mock modules
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    repositories: {
      findUnique: mockFindUnique,
    },
  },
}))

vi.mock('@/lib/auth/sync-user', () => ({
  getCurrentUser: mockGetCurrentUser,
}))

vi.mock('@/lib/indexing', () => ({
  startIndexingJob: mockStartIndexingJob,
  cancelJob: mockCancelJob,
  getJobByRepository: mockGetJobByRepository,
  isJobInProgress: mockIsJobInProgress,
}))

vi.mock('@/lib/indexing/pipeline', () => ({
  runIndexationPipeline: mockRunIndexationPipeline,
}))

// Import after mocking
import { POST, DELETE } from './route'

const mockUser = {
  id: 'user-123',
  github_id: '12345',
  email: 'test@example.com',
  name: 'Test User',
  github_token: 'ghp_test_token_123',
}

const mockRepository = {
  id: 'repo-456',
  user_id: 'user-123',
  github_repo_id: '67890',
  full_name: 'owner/repo',
  default_branch: 'main',
  is_active: true,
}

const mockJob = {
  id: 'job-789',
  repositoryId: 'repo-456',
  status: 'pending',
  progress: 0,
  filesTotal: 0,
  filesProcessed: 0,
  chunksCreated: 0,
  currentPhase: 'Initializing',
  errorMessage: null,
  startedAt: null,
  completedAt: null,
}

const createRequest = (method: string) =>
  new Request('http://localhost/api/repos/repo-456/index', { method })

describe('POST /api/repos/[repoId]/index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRunIndexationPipeline.mockResolvedValue({ success: true })
  })

  it('should return 401 if not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const response = await POST(createRequest('POST'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('should return 401 if user has no GitHub token', async () => {
    mockGetCurrentUser.mockResolvedValue({ ...mockUser, github_token: null })

    const response = await POST(createRequest('POST'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('NO_GITHUB_TOKEN')
  })

  it('should return 404 if repository not found', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(null)

    const response = await POST(createRequest('POST'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.code).toBe('NOT_FOUND')
  })

  it('should return 403 if repository does not belong to user', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue({ ...mockRepository, user_id: 'other-user' })

    const response = await POST(createRequest('POST'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  it('should return existing job if already in progress', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(mockRepository)
    mockGetJobByRepository.mockResolvedValue({ ...mockJob, status: 'fetching', progress: 25 })
    mockIsJobInProgress.mockReturnValue(true)

    const response = await POST(createRequest('POST'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.jobId).toBe('job-789')
    expect(data.status).toBe('fetching')
    expect(data.progress).toBe(25)
    expect(data.message).toBe('Indexation deja en cours')
    expect(mockStartIndexingJob).not.toHaveBeenCalled()
  })

  it('should start new indexation job successfully', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(mockRepository)
    mockGetJobByRepository.mockResolvedValue(null)
    mockIsJobInProgress.mockReturnValue(false)
    mockStartIndexingJob.mockResolvedValue({ jobId: 'new-job', isNew: true })

    const response = await POST(createRequest('POST'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.jobId).toBe('new-job')
    expect(data.status).toBe('pending')
    expect(data.message).toBe('Indexation demarree')
    expect(data.statusUrl).toBe('/api/repos/repo-456/index/status')
    expect(mockStartIndexingJob).toHaveBeenCalledWith('repo-456')
    expect(mockRunIndexationPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'ghp_test_token_123',
        repositoryId: 'repo-456',
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        jobId: 'new-job',
      })
    )
  })

  it('should handle existing completed job and return its status', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(mockRepository)
    mockGetJobByRepository
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...mockJob, status: 'completed', progress: 100 })
    mockIsJobInProgress.mockReturnValue(false)
    mockStartIndexingJob.mockResolvedValue({ jobId: 'job-789', isNew: false })

    const response = await POST(createRequest('POST'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.jobId).toBe('job-789')
    expect(data.message).toBe('Job existant')
  })
})

describe('DELETE /api/repos/[repoId]/index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 if not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const response = await DELETE(createRequest('DELETE'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('should return 404 if repository not found', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(null)

    const response = await DELETE(createRequest('DELETE'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.code).toBe('NOT_FOUND')
  })

  it('should return 403 if repository does not belong to user', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue({ ...mockRepository, user_id: 'other-user' })

    const response = await DELETE(createRequest('DELETE'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  it('should return 404 if no indexing job exists', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(mockRepository)
    mockGetJobByRepository.mockResolvedValue(null)

    const response = await DELETE(createRequest('DELETE'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.code).toBe('NOT_FOUND')
  })

  it('should return message if job is not in progress', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(mockRepository)
    mockGetJobByRepository.mockResolvedValue({ ...mockJob, status: 'completed' })
    mockIsJobInProgress.mockReturnValue(false)

    const response = await DELETE(createRequest('DELETE'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe("Le job n'est pas en cours")
    expect(data.status).toBe('completed')
    expect(mockCancelJob).not.toHaveBeenCalled()
  })

  it('should cancel job successfully', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(mockRepository)
    mockGetJobByRepository.mockResolvedValue({ ...mockJob, status: 'parsing' })
    mockIsJobInProgress.mockReturnValue(true)
    mockCancelJob.mockResolvedValue({ ...mockJob, status: 'cancelled' })

    const response = await DELETE(createRequest('DELETE'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.message).toBe('Indexation annulee')
    expect(data.status).toBe('cancelled')
    expect(mockCancelJob).toHaveBeenCalledWith('job-789')
  })

  it('should return 500 if cancel fails', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(mockRepository)
    mockGetJobByRepository.mockResolvedValue({ ...mockJob, status: 'parsing' })
    mockIsJobInProgress.mockReturnValue(true)
    mockCancelJob.mockResolvedValue(null)

    const response = await DELETE(createRequest('DELETE'), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error.code).toBe('CANCEL_FAILED')
  })
})
