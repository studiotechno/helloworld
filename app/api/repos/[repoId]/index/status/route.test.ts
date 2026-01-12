import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock functions using vi.hoisted
const {
  mockGetCurrentUser,
  mockFindUnique,
  mockGetJobByRepository,
  mockGetRepositoryIndexStats,
  mockIsRepositoryIndexed,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockFindUnique: vi.fn(),
  mockGetJobByRepository: vi.fn(),
  mockGetRepositoryIndexStats: vi.fn(),
  mockIsRepositoryIndexed: vi.fn(),
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
  getJobByRepository: mockGetJobByRepository,
  getRepositoryIndexStats: mockGetRepositoryIndexStats,
  isRepositoryIndexed: mockIsRepositoryIndexed,
}))

// Import after mocking
import { GET } from './route'

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
  filesTotal: 100,
  filesProcessed: 0,
  chunksCreated: 0,
  currentPhase: 'Initializing',
  errorMessage: null,
  startedAt: null,
  completedAt: null,
}

const mockStats = {
  totalChunks: 250,
  totalFiles: 15,
  languages: { typescript: 200, javascript: 50 },
  chunkTypes: { function: 150, class: 50, other: 50 },
}

const createRequest = () =>
  new Request('http://localhost/api/repos/repo-456/index/status', { method: 'GET' })

describe('GET /api/repos/[repoId]/index/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 if not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const response = await GET(createRequest(), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error.code).toBe('UNAUTHORIZED')
  })

  it('should return 404 if repository not found', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(null)

    const response = await GET(createRequest(), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.code).toBe('NOT_FOUND')
  })

  it('should return 403 if repository does not belong to user', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue({ ...mockRepository, user_id: 'other-user' })

    const response = await GET(createRequest(), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error.code).toBe('FORBIDDEN')
  })

  it('should return not_started if no job and not indexed', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(mockRepository)
    mockGetJobByRepository.mockResolvedValue(null)
    mockIsRepositoryIndexed.mockResolvedValue(false)

    const response = await GET(createRequest(), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('not_started')
    expect(data.isIndexed).toBe(false)
  })

  it('should return indexed status with stats if already indexed', async () => {
    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(mockRepository)
    mockGetJobByRepository.mockResolvedValue(null)
    mockIsRepositoryIndexed.mockResolvedValue(true)
    mockGetRepositoryIndexStats.mockResolvedValue(mockStats)

    const response = await GET(createRequest(), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('indexed')
    expect(data.isIndexed).toBe(true)
    expect(data.stats).toEqual(mockStats)
  })

  it('should return in-progress job status', async () => {
    const inProgressJob = {
      ...mockJob,
      status: 'parsing',
      progress: 35,
      filesProcessed: 35,
      currentPhase: 'Parsing code',
      startedAt: new Date('2026-01-12T10:00:00Z'),
    }

    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(mockRepository)
    mockGetJobByRepository.mockResolvedValue(inProgressJob)

    const response = await GET(createRequest(), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.jobId).toBe('job-789')
    expect(data.status).toBe('parsing')
    expect(data.progress).toBe(35)
    expect(data.filesTotal).toBe(100)
    expect(data.filesProcessed).toBe(35)
    expect(data.currentPhase).toBe('Parsing code')
    expect(data.isIndexed).toBe(false)
  })

  it('should return completed job status with stats', async () => {
    const completedJob = {
      ...mockJob,
      status: 'completed',
      progress: 100,
      filesProcessed: 100,
      chunksCreated: 250,
      currentPhase: null,
      startedAt: new Date('2026-01-12T10:00:00Z'),
      completedAt: new Date('2026-01-12T10:02:00Z'),
    }

    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(mockRepository)
    mockGetJobByRepository.mockResolvedValue(completedJob)
    mockGetRepositoryIndexStats.mockResolvedValue(mockStats)

    const response = await GET(createRequest(), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('completed')
    expect(data.progress).toBe(100)
    expect(data.chunksCreated).toBe(250)
    expect(data.isIndexed).toBe(true)
    expect(data.stats).toEqual(mockStats)
  })

  it('should return failed job status with error', async () => {
    const failedJob = {
      ...mockJob,
      status: 'failed',
      progress: 45,
      errorMessage: 'GitHub API rate limit exceeded',
      startedAt: new Date('2026-01-12T10:00:00Z'),
      completedAt: new Date('2026-01-12T10:01:00Z'),
    }

    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(mockRepository)
    mockGetJobByRepository.mockResolvedValue(failedJob)

    const response = await GET(createRequest(), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('failed')
    expect(data.error).toBe('GitHub API rate limit exceeded')
    expect(data.isIndexed).toBe(false)
  })

  it('should return cancelled job status', async () => {
    const cancelledJob = {
      ...mockJob,
      status: 'cancelled',
      progress: 30,
      startedAt: new Date('2026-01-12T10:00:00Z'),
      completedAt: new Date('2026-01-12T10:00:30Z'),
    }

    mockGetCurrentUser.mockResolvedValue(mockUser)
    mockFindUnique.mockResolvedValue(mockRepository)
    mockGetJobByRepository.mockResolvedValue(cancelledJob)

    const response = await GET(createRequest(), {
      params: Promise.resolve({ repoId: 'repo-456' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('cancelled')
    expect(data.isIndexed).toBe(false)
  })
})
