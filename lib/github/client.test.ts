import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create mock functions
const mockListForAuthenticatedUser = vi.fn()
const mockGetContent = vi.fn()
const mockGetRateLimit = vi.fn()
const mockGetRepo = vi.fn()
const mockListLanguages = vi.fn()

// Mock Octokit before importing the module
vi.mock('octokit', () => ({
  Octokit: class MockOctokit {
    rest = {
      repos: {
        listForAuthenticatedUser: mockListForAuthenticatedUser,
        getContent: mockGetContent,
        get: mockGetRepo,
        listLanguages: mockListLanguages,
      },
      rateLimit: {
        get: mockGetRateLimit,
      },
    }
  },
}))

// Import after mocking
import {
  fetchUserRepos,
  getRateLimit,
  fetchRepoContent,
  checkRepoSizeWarning,
  fetchRepoDetails,
  fetchRepoLanguages,
  REPO_SIZE_WARNING_THRESHOLD_KB,
} from './client'

describe('GitHub Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('fetchUserRepos', () => {
    it('should fetch and map user repositories correctly', async () => {
      const mockRepos = [
        {
          id: 1,
          name: 'repo-1',
          full_name: 'user/repo-1',
          description: 'A test repository',
          private: false,
          language: 'TypeScript',
          default_branch: 'main',
          updated_at: '2026-01-09T10:00:00Z',
          pushed_at: '2026-01-09T10:00:00Z',
          size: 1024,
          stargazers_count: 10,
        },
        {
          id: 2,
          name: 'repo-2',
          full_name: 'user/repo-2',
          description: null,
          private: true,
          language: null,
          default_branch: 'master',
          updated_at: '2026-01-08T10:00:00Z',
          pushed_at: '2026-01-08T10:00:00Z',
          size: 512,
          stargazers_count: 0,
        },
      ]

      mockListForAuthenticatedUser.mockResolvedValue({ data: mockRepos })

      const repos = await fetchUserRepos('test-token')

      expect(repos).toHaveLength(2)
      expect(repos[0]).toEqual({
        id: 1,
        name: 'repo-1',
        full_name: 'user/repo-1',
        description: 'A test repository',
        private: false,
        language: 'TypeScript',
        default_branch: 'main',
        updated_at: '2026-01-09T10:00:00Z',
        pushed_at: '2026-01-09T10:00:00Z',
        size: 1024,
        stargazers_count: 10,
      })
      expect(repos[1].description).toBeNull()
      expect(repos[1].private).toBe(true)
    })

    it('should handle empty repository list', async () => {
      mockListForAuthenticatedUser.mockResolvedValue({ data: [] })

      const repos = await fetchUserRepos('test-token')
      expect(repos).toHaveLength(0)
    })

    it('should propagate API errors', async () => {
      mockListForAuthenticatedUser.mockRejectedValue(new Error('rate limit exceeded'))

      await expect(fetchUserRepos('test-token')).rejects.toThrow('rate limit exceeded')
    })

    it('should call Octokit with correct parameters', async () => {
      mockListForAuthenticatedUser.mockResolvedValue({ data: [] })

      await fetchUserRepos('test-token')

      expect(mockListForAuthenticatedUser).toHaveBeenCalledWith({
        sort: 'pushed',
        direction: 'desc',
        per_page: 100,
      })
    })
  })

  describe('getRateLimit', () => {
    it('should fetch rate limit information', async () => {
      const mockRateLimit = {
        rate: {
          limit: 5000,
          remaining: 4999,
          reset: 1704844800,
          used: 1,
        },
      }

      mockGetRateLimit.mockResolvedValue({ data: mockRateLimit })

      const rateLimit = await getRateLimit('test-token')

      expect(rateLimit).toEqual({
        limit: 5000,
        remaining: 4999,
        reset: 1704844800,
        used: 1,
      })
    })
  })

  describe('fetchRepoContent', () => {
    it('should fetch directory content correctly', async () => {
      const mockContent = [
        {
          name: 'src',
          path: 'src',
          sha: 'abc123',
          size: 0,
          type: 'dir',
          download_url: null,
        },
        {
          name: 'README.md',
          path: 'README.md',
          sha: 'def456',
          size: 1024,
          type: 'file',
          download_url: 'https://example.com/README.md',
        },
      ]

      mockGetContent.mockResolvedValue({ data: mockContent })

      const content = await fetchRepoContent('test-token', 'user', 'repo', '')

      expect(content).toHaveLength(2)
      expect(content[0].type).toBe('dir')
      expect(content[1].type).toBe('file')
    })

    it('should handle single file response', async () => {
      const mockFile = {
        name: 'README.md',
        path: 'README.md',
        sha: 'abc123',
        size: 1024,
        type: 'file',
        content: 'SGVsbG8gV29ybGQ=', // base64 "Hello World"
        encoding: 'base64',
        download_url: 'https://example.com/README.md',
      }

      mockGetContent.mockResolvedValue({ data: mockFile })

      const content = await fetchRepoContent('test-token', 'user', 'repo', 'README.md')

      expect(content).toHaveLength(1)
      expect(content[0].content).toBe('SGVsbG8gV29ybGQ=')
      expect(content[0].encoding).toBe('base64')
    })
  })

  describe('checkRepoSizeWarning', () => {
    it('should return exceedsLimit true when size exceeds threshold', () => {
      const result = checkRepoSizeWarning(60000) // 60MB > 50MB threshold

      expect(result.exceedsLimit).toBe(true)
      expect(result.sizeKB).toBe(60000)
      expect(result.thresholdKB).toBe(REPO_SIZE_WARNING_THRESHOLD_KB)
    })

    it('should return exceedsLimit false when size is under threshold', () => {
      const result = checkRepoSizeWarning(30000) // 30MB < 50MB threshold

      expect(result.exceedsLimit).toBe(false)
      expect(result.sizeKB).toBe(30000)
    })

    it('should return exceedsLimit false when size equals threshold', () => {
      const result = checkRepoSizeWarning(50000) // 50MB = 50MB threshold

      expect(result.exceedsLimit).toBe(false)
    })

    it('should handle zero size', () => {
      const result = checkRepoSizeWarning(0)

      expect(result.exceedsLimit).toBe(false)
      expect(result.sizeKB).toBe(0)
    })
  })

  describe('fetchRepoDetails', () => {
    it('should fetch repository details correctly', async () => {
      const mockRepo = {
        id: 12345,
        name: 'my-repo',
        full_name: 'owner/my-repo',
        description: 'A great repository',
        private: false,
        language: 'TypeScript',
        default_branch: 'main',
        updated_at: '2026-01-09T10:00:00Z',
        pushed_at: '2026-01-09T10:00:00Z',
        size: 2048,
        stargazers_count: 100,
      }

      mockGetRepo.mockResolvedValue({ data: mockRepo })

      const repo = await fetchRepoDetails('test-token', 'owner', 'my-repo')

      expect(repo).toEqual({
        id: 12345,
        name: 'my-repo',
        full_name: 'owner/my-repo',
        description: 'A great repository',
        private: false,
        language: 'TypeScript',
        default_branch: 'main',
        updated_at: '2026-01-09T10:00:00Z',
        pushed_at: '2026-01-09T10:00:00Z',
        size: 2048,
        stargazers_count: 100,
      })

      expect(mockGetRepo).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'my-repo',
      })
    })

    it('should handle null fields correctly', async () => {
      const mockRepo = {
        id: 12345,
        name: 'my-repo',
        full_name: 'owner/my-repo',
        description: null,
        private: true,
        language: null,
        default_branch: 'main',
        updated_at: null,
        pushed_at: null,
        size: null,
        stargazers_count: null,
      }

      mockGetRepo.mockResolvedValue({ data: mockRepo })

      const repo = await fetchRepoDetails('test-token', 'owner', 'my-repo')

      expect(repo.description).toBeNull()
      expect(repo.language).toBeNull()
      expect(repo.updated_at).toBe('')
      expect(repo.pushed_at).toBe('')
      expect(repo.size).toBe(0)
      expect(repo.stargazers_count).toBe(0)
    })
  })

  describe('fetchRepoLanguages', () => {
    it('should fetch and sort languages by bytes descending', async () => {
      const mockLanguages = {
        TypeScript: 50000,
        JavaScript: 30000,
        CSS: 10000,
      }

      mockListLanguages.mockResolvedValue({ data: mockLanguages })

      const languages = await fetchRepoLanguages('test-token', 'owner', 'my-repo')

      expect(languages).toEqual(['TypeScript', 'JavaScript', 'CSS'])
      expect(mockListLanguages).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'my-repo',
      })
    })

    it('should return empty array for repo with no languages', async () => {
      mockListLanguages.mockResolvedValue({ data: {} })

      const languages = await fetchRepoLanguages('test-token', 'owner', 'my-repo')

      expect(languages).toEqual([])
    })

    it('should handle single language', async () => {
      const mockLanguages = {
        Python: 10000,
      }

      mockListLanguages.mockResolvedValue({ data: mockLanguages })

      const languages = await fetchRepoLanguages('test-token', 'owner', 'my-repo')

      expect(languages).toEqual(['Python'])
    })

    it('should sort languages correctly when bytes are equal', async () => {
      const mockLanguages = {
        Go: 10000,
        Rust: 10000,
        TypeScript: 10000,
      }

      mockListLanguages.mockResolvedValue({ data: mockLanguages })

      const languages = await fetchRepoLanguages('test-token', 'owner', 'my-repo')

      // With equal bytes, order depends on JavaScript object iteration
      expect(languages).toHaveLength(3)
      expect(languages).toContain('Go')
      expect(languages).toContain('Rust')
      expect(languages).toContain('TypeScript')
    })

    it('should propagate API errors', async () => {
      mockListLanguages.mockRejectedValue(new Error('API error'))

      await expect(fetchRepoLanguages('test-token', 'owner', 'my-repo')).rejects.toThrow(
        'API error'
      )
    })
  })
})
