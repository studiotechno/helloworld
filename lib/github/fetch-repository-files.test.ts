import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock functions must be defined inside vi.hoisted
const {
  mockGetRepo,
  mockGetRef,
  mockGetCommit,
  mockGetTree,
  mockGetContent,
  mockGetRateLimit,
  mockKvGet,
  mockKvSet,
} = vi.hoisted(() => ({
  mockGetRepo: vi.fn(),
  mockGetRef: vi.fn(),
  mockGetCommit: vi.fn(),
  mockGetTree: vi.fn(),
  mockGetContent: vi.fn(),
  mockGetRateLimit: vi.fn(),
  mockKvGet: vi.fn(),
  mockKvSet: vi.fn(),
}))

// Mock Octokit
vi.mock('octokit', () => ({
  Octokit: class MockOctokit {
    rest = {
      repos: {
        get: mockGetRepo,
        getContent: mockGetContent,
      },
      git: {
        getRef: mockGetRef,
        getCommit: mockGetCommit,
        getTree: mockGetTree,
      },
      rateLimit: {
        get: mockGetRateLimit,
      },
    }
  },
}))

// Mock Vercel KV
vi.mock('@vercel/kv', () => ({
  kv: {
    get: mockKvGet,
    set: mockKvSet,
  },
}))

// Import after mocking
import {
  fetchRepositoryFiles,
  fetchFileContent,
  fetchChangedFiles,
  fetchGitignore,
  calculateContentHash,
  hasFileChanged,
  estimateRepoLines,
  fetchRepositoryStructure,
  type RepositoryFile,
} from './fetch-repository-files'

describe('fetch-repository-files', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default rate limit response
    mockGetRateLimit.mockResolvedValue({
      data: { rate: { limit: 5000, remaining: 4999, reset: 1704844800, used: 1 } },
    })
    // Default cache miss
    mockKvGet.mockResolvedValue(null)
    mockKvSet.mockResolvedValue('OK')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('fetchRepositoryFiles', () => {
    it('should fetch repository files using Git Trees API', async () => {
      // Mock repo details for default branch
      mockGetRepo.mockResolvedValue({
        data: { default_branch: 'main' },
      })

      // Mock ref for branch
      mockGetRef.mockResolvedValue({
        data: { object: { sha: 'commit-sha-123' } },
      })

      // Mock commit to get tree SHA
      mockGetCommit.mockResolvedValue({
        data: { tree: { sha: 'tree-sha-456' } },
      })

      // Mock tree response
      mockGetTree.mockResolvedValue({
        data: {
          sha: 'tree-sha-456',
          truncated: false,
          tree: [
            { path: 'src/index.ts', type: 'blob', sha: 'file-sha-1', size: 1000 },
            { path: 'src/utils.ts', type: 'blob', sha: 'file-sha-2', size: 500 },
            { path: 'src/components', type: 'tree', sha: 'dir-sha-1' },
            { path: 'package.json', type: 'blob', sha: 'file-sha-3', size: 800 },
          ],
        },
      })

      const result = await fetchRepositoryFiles('test-token', 'owner', 'repo')

      expect(result.files).toHaveLength(3) // Only blobs, not trees
      expect(result.truncated).toBe(false)
      expect(result.totalCount).toBe(3)
      expect(result.files[0].path).toBe('src/index.ts')
      expect(result.files[0].sha).toBe('file-sha-1')
      expect(result.files[0].size).toBe(1000)
      expect(result.files[0].type).toBe('file')
    })

    it('should use specified branch instead of default', async () => {
      mockGetRef.mockResolvedValue({
        data: { object: { sha: 'commit-sha-123' } },
      })

      mockGetCommit.mockResolvedValue({
        data: { tree: { sha: 'tree-sha-456' } },
      })

      mockGetTree.mockResolvedValue({
        data: { sha: 'tree-sha-456', truncated: false, tree: [] },
      })

      await fetchRepositoryFiles('test-token', 'owner', 'repo', { branch: 'develop' })

      expect(mockGetRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'heads/develop',
      })
      // Should NOT call getRepo when branch is specified
      expect(mockGetRepo).not.toHaveBeenCalled()
    })

    it('should handle truncated response for large repos', async () => {
      mockGetRepo.mockResolvedValue({
        data: { default_branch: 'main' },
      })

      mockGetRef.mockResolvedValue({
        data: { object: { sha: 'commit-sha-123' } },
      })

      mockGetCommit.mockResolvedValue({
        data: { tree: { sha: 'tree-sha-456' } },
      })

      mockGetTree.mockResolvedValue({
        data: {
          sha: 'tree-sha-456',
          truncated: true, // GitHub truncates at 100k entries
          tree: Array.from({ length: 100 }, (_, i) => ({
            path: `file${i}.ts`,
            type: 'blob',
            sha: `sha-${i}`,
            size: 100,
          })),
        },
      })

      const result = await fetchRepositoryFiles('test-token', 'owner', 'repo')

      expect(result.truncated).toBe(true)
    })

    it('should limit files to maxFiles option', async () => {
      mockGetRepo.mockResolvedValue({
        data: { default_branch: 'main' },
      })

      mockGetRef.mockResolvedValue({
        data: { object: { sha: 'commit-sha-123' } },
      })

      mockGetCommit.mockResolvedValue({
        data: { tree: { sha: 'tree-sha-456' } },
      })

      mockGetTree.mockResolvedValue({
        data: {
          sha: 'tree-sha-456',
          truncated: false,
          tree: Array.from({ length: 100 }, (_, i) => ({
            path: `file${i}.ts`,
            type: 'blob',
            sha: `sha-${i}`,
            size: 100,
          })),
        },
      })

      const result = await fetchRepositoryFiles('test-token', 'owner', 'repo', {
        maxFiles: 10,
      })

      expect(result.files).toHaveLength(10)
      expect(result.totalCount).toBe(100)
      expect(result.fetchedCount).toBe(10)
    })

    it('should include download_url for each file', async () => {
      mockGetRepo.mockResolvedValue({
        data: { default_branch: 'main' },
      })

      mockGetRef.mockResolvedValue({
        data: { object: { sha: 'commit-sha-123' } },
      })

      mockGetCommit.mockResolvedValue({
        data: { tree: { sha: 'tree-sha-456' } },
      })

      mockGetTree.mockResolvedValue({
        data: {
          sha: 'tree-sha-456',
          truncated: false,
          tree: [{ path: 'src/index.ts', type: 'blob', sha: 'sha-1', size: 100 }],
        },
      })

      const result = await fetchRepositoryFiles('test-token', 'owner', 'repo')

      expect(result.files[0].download_url).toBe(
        'https://raw.githubusercontent.com/owner/repo/main/src/index.ts'
      )
    })
  })

  describe('fetchFileContent', () => {
    it('should fetch and decode file content', async () => {
      mockGetContent.mockResolvedValue({
        data: {
          type: 'file',
          path: 'src/index.ts',
          sha: 'file-sha-123',
          size: 26,
          content: Buffer.from('console.log("Hello World")').toString('base64'),
          encoding: 'base64',
        },
      })

      const content = await fetchFileContent('test-token', 'owner', 'repo', 'src/index.ts')

      expect(content).not.toBeNull()
      expect(content!.content).toBe('console.log("Hello World")')
      expect(content!.path).toBe('src/index.ts')
      expect(content!.sha).toBe('file-sha-123')
    })

    it('should return cached content if available', async () => {
      const cachedContent = {
        path: 'src/index.ts',
        content: 'cached content',
        sha: 'cached-sha',
        size: 100,
        encoding: 'utf-8',
      }

      mockKvGet.mockResolvedValue(cachedContent)

      const content = await fetchFileContent('test-token', 'owner', 'repo', 'src/index.ts', 'sha-123')

      expect(content).toEqual(cachedContent)
      expect(mockGetContent).not.toHaveBeenCalled()
    })

    it('should cache fetched content', async () => {
      mockGetContent.mockResolvedValue({
        data: {
          type: 'file',
          path: 'src/index.ts',
          sha: 'file-sha-123',
          size: 26,
          content: Buffer.from('test content').toString('base64'),
          encoding: 'base64',
        },
      })

      await fetchFileContent('test-token', 'owner', 'repo', 'src/index.ts', 'sha-123')

      expect(mockKvSet).toHaveBeenCalledWith(
        'file:owner/repo:sha-123',
        expect.objectContaining({ content: 'test content' }),
        { ex: 300 }
      )
    })

    it('should return null for directories', async () => {
      mockGetContent.mockResolvedValue({
        data: [
          { name: 'file1.ts', path: 'src/file1.ts', type: 'file' },
          { name: 'file2.ts', path: 'src/file2.ts', type: 'file' },
        ],
      })

      const content = await fetchFileContent('test-token', 'owner', 'repo', 'src')

      expect(content).toBeNull()
    })

    it('should return null when file fetch fails', async () => {
      mockGetContent.mockRejectedValue(new Error('Not found'))

      const content = await fetchFileContent('test-token', 'owner', 'repo', 'nonexistent.ts')

      expect(content).toBeNull()
    })
  })

  describe('fetchChangedFiles', () => {
    beforeEach(() => {
      mockGetRepo.mockResolvedValue({
        data: { default_branch: 'main' },
      })

      mockGetRef.mockResolvedValue({
        data: { object: { sha: 'commit-sha-123' } },
      })

      mockGetCommit.mockResolvedValue({
        data: { tree: { sha: 'tree-sha-456' } },
      })
    })

    it('should detect added files', async () => {
      mockGetTree.mockResolvedValue({
        data: {
          sha: 'tree-sha-456',
          truncated: false,
          tree: [
            { path: 'existing.ts', type: 'blob', sha: 'sha-1', size: 100 },
            { path: 'new-file.ts', type: 'blob', sha: 'sha-2', size: 200 },
          ],
        },
      })

      const existingFiles = new Map([['existing.ts', 'sha-1']])

      const result = await fetchChangedFiles('test-token', 'owner', 'repo', existingFiles)

      expect(result.added).toHaveLength(1)
      expect(result.added[0].path).toBe('new-file.ts')
      expect(result.modified).toHaveLength(0)
      expect(result.deleted).toHaveLength(0)
    })

    it('should detect modified files', async () => {
      mockGetTree.mockResolvedValue({
        data: {
          sha: 'tree-sha-456',
          truncated: false,
          tree: [{ path: 'existing.ts', type: 'blob', sha: 'sha-changed', size: 100 }],
        },
      })

      const existingFiles = new Map([['existing.ts', 'sha-original']])

      const result = await fetchChangedFiles('test-token', 'owner', 'repo', existingFiles)

      expect(result.added).toHaveLength(0)
      expect(result.modified).toHaveLength(1)
      expect(result.modified[0].path).toBe('existing.ts')
      expect(result.deleted).toHaveLength(0)
    })

    it('should detect deleted files', async () => {
      mockGetTree.mockResolvedValue({
        data: {
          sha: 'tree-sha-456',
          truncated: false,
          tree: [],
        },
      })

      const existingFiles = new Map([['deleted.ts', 'sha-1']])

      const result = await fetchChangedFiles('test-token', 'owner', 'repo', existingFiles)

      expect(result.added).toHaveLength(0)
      expect(result.modified).toHaveLength(0)
      expect(result.deleted).toHaveLength(1)
      expect(result.deleted[0]).toBe('deleted.ts')
    })

    it('should handle multiple changes', async () => {
      mockGetTree.mockResolvedValue({
        data: {
          sha: 'tree-sha-456',
          truncated: false,
          tree: [
            { path: 'unchanged.ts', type: 'blob', sha: 'sha-unchanged', size: 100 },
            { path: 'modified.ts', type: 'blob', sha: 'sha-new', size: 100 },
            { path: 'added.ts', type: 'blob', sha: 'sha-added', size: 100 },
          ],
        },
      })

      const existingFiles = new Map([
        ['unchanged.ts', 'sha-unchanged'],
        ['modified.ts', 'sha-old'],
        ['deleted.ts', 'sha-deleted'],
      ])

      const result = await fetchChangedFiles('test-token', 'owner', 'repo', existingFiles)

      expect(result.added).toHaveLength(1)
      expect(result.modified).toHaveLength(1)
      expect(result.deleted).toHaveLength(1)
    })
  })

  describe('fetchGitignore', () => {
    it('should fetch .gitignore content', async () => {
      mockGetContent.mockResolvedValue({
        data: {
          type: 'file',
          path: '.gitignore',
          sha: 'gitignore-sha',
          size: 50,
          content: Buffer.from('node_modules\ndist\n*.log').toString('base64'),
          encoding: 'base64',
        },
      })

      const gitignore = await fetchGitignore('test-token', 'owner', 'repo')

      expect(gitignore).toBe('node_modules\ndist\n*.log')
    })

    it('should return null if .gitignore does not exist', async () => {
      mockGetContent.mockRejectedValue(new Error('Not found'))

      const gitignore = await fetchGitignore('test-token', 'owner', 'repo')

      expect(gitignore).toBeNull()
    })
  })

  describe('calculateContentHash', () => {
    it('should return consistent hash for same content', () => {
      const content = 'const x = 1;'
      const hash1 = calculateContentHash(content)
      const hash2 = calculateContentHash(content)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 hex length
    })

    it('should return different hash for different content', () => {
      const hash1 = calculateContentHash('const x = 1;')
      const hash2 = calculateContentHash('const x = 2;')

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('hasFileChanged', () => {
    it('should return true when SHAs differ', () => {
      expect(hasFileChanged('sha-new', 'sha-old')).toBe(true)
    })

    it('should return false when SHAs match', () => {
      expect(hasFileChanged('sha-same', 'sha-same')).toBe(false)
    })
  })

  describe('estimateRepoLines', () => {
    it('should estimate lines from file sizes', () => {
      const files: RepositoryFile[] = [
        { path: 'file1.ts', size: 4000, sha: 'sha-1', type: 'file' },
        { path: 'file2.ts', size: 4000, sha: 'sha-2', type: 'file' },
      ]

      const lines = estimateRepoLines(files)

      // 8000 bytes / 40 chars per line = 200 lines
      expect(lines).toBe(200)
    })

    it('should return 0 for empty array', () => {
      expect(estimateRepoLines([])).toBe(0)
    })
  })

  describe('fetchRepositoryStructure', () => {
    it('should fetch structure with metadata', async () => {
      mockGetRepo.mockResolvedValue({
        data: { default_branch: 'main' },
      })

      mockGetRef.mockResolvedValue({
        data: { object: { sha: 'commit-sha-123' } },
      })

      mockGetCommit.mockResolvedValue({
        data: { tree: { sha: 'tree-sha-456' } },
      })

      mockGetTree.mockResolvedValue({
        data: {
          sha: 'tree-sha-456',
          truncated: false,
          tree: [
            { path: 'src/index.ts', type: 'blob', sha: 'sha-1', size: 1000 },
            { path: 'src/utils.ts', type: 'blob', sha: 'sha-2', size: 500 },
          ],
        },
      })

      // Mock gitignore fetch
      mockGetContent.mockResolvedValue({
        data: {
          type: 'file',
          path: '.gitignore',
          sha: 'gitignore-sha',
          size: 20,
          content: Buffer.from('node_modules').toString('base64'),
          encoding: 'base64',
        },
      })

      const result = await fetchRepositoryStructure('test-token', 'owner', 'repo')

      expect(result.files).toHaveLength(2)
      expect(result.estimatedLines).toBeGreaterThan(0)
      expect(result.isLarge).toBe(false)
      expect(result.gitignore).toBe('node_modules')
    })

    it('should detect large repository', async () => {
      mockGetRepo.mockResolvedValue({
        data: { default_branch: 'main' },
      })

      mockGetRef.mockResolvedValue({
        data: { object: { sha: 'commit-sha-123' } },
      })

      mockGetCommit.mockResolvedValue({
        data: { tree: { sha: 'tree-sha-456' } },
      })

      // Create files totaling > 50k lines (2M chars / 40)
      mockGetTree.mockResolvedValue({
        data: {
          sha: 'tree-sha-456',
          truncated: false,
          tree: Array.from({ length: 100 }, (_, i) => ({
            path: `file${i}.ts`,
            type: 'blob',
            sha: `sha-${i}`,
            size: 25000, // 625 lines each = 62,500 total
          })),
        },
      })

      mockGetContent.mockRejectedValue(new Error('Not found'))

      const result = await fetchRepositoryStructure('test-token', 'owner', 'repo')

      expect(result.isLarge).toBe(true)
      expect(result.estimatedLines).toBeGreaterThan(50000)
    })
  })
})
