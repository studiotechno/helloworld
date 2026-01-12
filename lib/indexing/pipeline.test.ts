import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock functions using vi.hoisted
const {
  mockFetchRepositoryStructure,
  mockFetchFileContent,
  mockFilterFiles,
  mockChunkFile,
  mockCalculateFileHash,
  mockEmbedCode,
  mockMarkJobStarted,
  mockMarkJobCompleted,
  mockMarkJobFailed,
  mockUpdateJobProgress,
  mockUpdateJobStatus,
  mockPrismaDeleteMany,
  mockPrismaFindMany,
  mockPrismaCount,
  mockPrismaTransaction,
  mockPrismaExecuteRaw,
} = vi.hoisted(() => ({
  mockFetchRepositoryStructure: vi.fn(),
  mockFetchFileContent: vi.fn(),
  mockFilterFiles: vi.fn(),
  mockChunkFile: vi.fn(),
  mockCalculateFileHash: vi.fn(),
  mockEmbedCode: vi.fn(),
  mockMarkJobStarted: vi.fn(),
  mockMarkJobCompleted: vi.fn(),
  mockMarkJobFailed: vi.fn(),
  mockUpdateJobProgress: vi.fn(),
  mockUpdateJobStatus: vi.fn(),
  mockPrismaDeleteMany: vi.fn(),
  mockPrismaFindMany: vi.fn(),
  mockPrismaCount: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockPrismaExecuteRaw: vi.fn(),
}))

// Mock dependencies
vi.mock('../db/prisma', () => ({
  prisma: {
    code_chunks: {
      deleteMany: mockPrismaDeleteMany,
      findMany: mockPrismaFindMany,
      count: mockPrismaCount,
    },
    $transaction: mockPrismaTransaction,
    $executeRaw: mockPrismaExecuteRaw,
  },
}))

vi.mock('../github/fetch-repository-files', () => ({
  fetchRepositoryStructure: mockFetchRepositoryStructure,
  fetchFileContent: mockFetchFileContent,
}))

vi.mock('../parsing/file-filter', () => ({
  filterFiles: mockFilterFiles,
}))

vi.mock('../parsing/chunker', () => ({
  chunkFile: mockChunkFile,
  calculateFileHash: mockCalculateFileHash,
}))

vi.mock('../embeddings/voyage-client', () => ({
  embedCode: mockEmbedCode,
}))

vi.mock('./job-manager', () => ({
  markJobStarted: mockMarkJobStarted,
  markJobCompleted: mockMarkJobCompleted,
  markJobFailed: mockMarkJobFailed,
  updateJobProgress: mockUpdateJobProgress,
  updateJobStatus: mockUpdateJobStatus,
}))

// Import after mocking
import {
  runIndexationPipeline,
  deleteRepositoryChunks,
  getRepositoryIndexStats,
  isRepositoryIndexed,
  type PipelineOptions,
} from './pipeline'

describe('pipeline', () => {
  const defaultOptions: PipelineOptions = {
    accessToken: 'test-token',
    repositoryId: 'repo-123',
    owner: 'test-owner',
    repo: 'test-repo',
    jobId: 'job-456',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default successful mocks
    mockMarkJobStarted.mockResolvedValue({})
    mockMarkJobCompleted.mockResolvedValue({})
    mockMarkJobFailed.mockResolvedValue({})
    mockUpdateJobProgress.mockResolvedValue({})
    mockUpdateJobStatus.mockResolvedValue({})
    mockPrismaDeleteMany.mockResolvedValue({ count: 0 })
    mockPrismaTransaction.mockResolvedValue([])
    mockCalculateFileHash.mockReturnValue('hash-123')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('runIndexationPipeline', () => {
    it('should complete successfully with files', async () => {
      // Mock repository structure
      mockFetchRepositoryStructure.mockResolvedValue({
        files: [
          { path: 'src/index.ts', size: 1000, sha: 'sha-1', type: 'file' },
          { path: 'src/utils.ts', size: 500, sha: 'sha-2', type: 'file' },
        ],
        estimatedLines: 50,
        isLarge: false,
        gitignore: 'node_modules',
      })

      // Mock file filtering
      mockFilterFiles.mockReturnValue({
        included: [
          { path: 'src/index.ts', size: 1000 },
          { path: 'src/utils.ts', size: 500 },
        ],
        excluded: [],
        totalFiles: 2,
        totalSize: 1500,
        includedSize: 1500,
        isPrioritized: false,
        isEmpty: false,
        warnings: [],
      })

      // Mock file content fetching
      mockFetchFileContent.mockImplementation(async (_, __, ___, path) => ({
        path,
        content: 'const x = 1;',
        sha: 'content-sha',
        size: 12,
        encoding: 'utf-8',
      }))

      // Mock chunking
      mockChunkFile.mockReturnValue([
        {
          content: 'const x = 1;',
          file_path: 'src/index.ts',
          start_line: 1,
          end_line: 1,
          language: 'typescript',
          chunk_type: 'other',
          dependencies: [],
        },
      ])

      // Mock embeddings - return one embedding per chunk (2 chunks total)
      mockEmbedCode.mockResolvedValue([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ])

      const result = await runIndexationPipeline(defaultOptions)

      expect(result.success).toBe(true)
      expect(result.filesProcessed).toBe(2)
      expect(result.chunksCreated).toBe(2)
      expect(mockMarkJobCompleted).toHaveBeenCalledWith('job-456', 2)
    })

    it('should handle empty repository', async () => {
      mockFetchRepositoryStructure.mockResolvedValue({
        files: [],
        estimatedLines: 0,
        isLarge: false,
        gitignore: null,
      })

      const result = await runIndexationPipeline(defaultOptions)

      expect(result.success).toBe(true)
      expect(result.filesProcessed).toBe(0)
      expect(result.chunksCreated).toBe(0)
      expect(mockMarkJobCompleted).toHaveBeenCalledWith('job-456', 0)
    })

    it('should handle empty filter result', async () => {
      mockFetchRepositoryStructure.mockResolvedValue({
        files: [{ path: 'node_modules/pkg/index.js', size: 1000, sha: 'sha-1', type: 'file' }],
        estimatedLines: 25,
        isLarge: false,
        gitignore: 'node_modules',
      })

      mockFilterFiles.mockReturnValue({
        included: [],
        excluded: [{ path: 'node_modules/pkg/index.js', size: 1000 }],
        totalFiles: 1,
        totalSize: 1000,
        includedSize: 0,
        isPrioritized: false,
        isEmpty: true,
        warnings: ['No indexable code files found'],
      })

      const result = await runIndexationPipeline(defaultOptions)

      expect(result.success).toBe(true)
      expect(result.chunksCreated).toBe(0)
    })

    it('should handle errors and mark job as failed', async () => {
      mockFetchRepositoryStructure.mockRejectedValue(new Error('GitHub API error'))

      const result = await runIndexationPipeline(defaultOptions)

      expect(result.success).toBe(false)
      expect(result.error).toBe('GitHub API error')
      expect(mockMarkJobFailed).toHaveBeenCalledWith('job-456', 'GitHub API error')
    })

    it('should call progress callback', async () => {
      mockFetchRepositoryStructure.mockResolvedValue({
        files: [{ path: 'src/index.ts', size: 100, sha: 'sha-1', type: 'file' }],
        estimatedLines: 5,
        isLarge: false,
        gitignore: null,
      })

      mockFilterFiles.mockReturnValue({
        included: [{ path: 'src/index.ts', size: 100 }],
        excluded: [],
        totalFiles: 1,
        totalSize: 100,
        includedSize: 100,
        isPrioritized: false,
        isEmpty: false,
        warnings: [],
      })

      mockFetchFileContent.mockResolvedValue({
        path: 'src/index.ts',
        content: 'const x = 1;',
        sha: 'content-sha',
        size: 12,
        encoding: 'utf-8',
      })

      mockChunkFile.mockReturnValue([
        {
          content: 'const x = 1;',
          file_path: 'src/index.ts',
          start_line: 1,
          end_line: 1,
          language: 'typescript',
          chunk_type: 'other',
          dependencies: [],
        },
      ])

      mockEmbedCode.mockResolvedValue([[0.1, 0.2, 0.3]])

      const progressCalls: Array<{ phase: string; progress: number; message: string }> = []
      const onProgress = (phase: string, progress: number, message: string) => {
        progressCalls.push({ phase, progress, message })
      }

      await runIndexationPipeline({ ...defaultOptions, onProgress })

      expect(progressCalls.length).toBeGreaterThan(0)
      expect(progressCalls.some(p => p.phase === 'Fetching files')).toBe(true)
      expect(progressCalls.some(p => p.phase === 'Parsing code')).toBe(true)
      expect(progressCalls.some(p => p.phase === 'Generating embeddings')).toBe(true)
      expect(progressCalls.some(p => p.phase === 'Finalizing')).toBe(true)
    })

    it('should update job status at each phase', async () => {
      mockFetchRepositoryStructure.mockResolvedValue({
        files: [{ path: 'src/index.ts', size: 100, sha: 'sha-1', type: 'file' }],
        estimatedLines: 5,
        isLarge: false,
        gitignore: null,
      })

      mockFilterFiles.mockReturnValue({
        included: [{ path: 'src/index.ts', size: 100 }],
        excluded: [],
        totalFiles: 1,
        totalSize: 100,
        includedSize: 100,
        isPrioritized: false,
        isEmpty: false,
        warnings: [],
      })

      mockFetchFileContent.mockResolvedValue({
        path: 'src/index.ts',
        content: 'const x = 1;',
        sha: 'sha',
        size: 12,
        encoding: 'utf-8',
      })

      mockChunkFile.mockReturnValue([
        {
          content: 'const x = 1;',
          file_path: 'src/index.ts',
          start_line: 1,
          end_line: 1,
          language: 'typescript',
          chunk_type: 'other',
          dependencies: [],
        },
      ])

      mockEmbedCode.mockResolvedValue([[0.1]])

      await runIndexationPipeline(defaultOptions)

      expect(mockMarkJobStarted).toHaveBeenCalled()
      expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-456', 'fetching', { phase: 'Fetching files' })
      expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-456', 'parsing', { phase: 'Parsing code' })
      expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-456', 'embedding', { phase: 'Generating embeddings' })
      expect(mockMarkJobCompleted).toHaveBeenCalled()
    })

    it('should delete existing chunks before inserting new ones', async () => {
      mockFetchRepositoryStructure.mockResolvedValue({
        files: [{ path: 'src/index.ts', size: 100, sha: 'sha-1', type: 'file' }],
        estimatedLines: 5,
        isLarge: false,
        gitignore: null,
      })

      mockFilterFiles.mockReturnValue({
        included: [{ path: 'src/index.ts', size: 100 }],
        excluded: [],
        totalFiles: 1,
        totalSize: 100,
        includedSize: 100,
        isPrioritized: false,
        isEmpty: false,
        warnings: [],
      })

      mockFetchFileContent.mockResolvedValue({
        path: 'src/index.ts',
        content: 'const x = 1;',
        sha: 'sha',
        size: 12,
        encoding: 'utf-8',
      })

      mockChunkFile.mockReturnValue([
        {
          content: 'const x = 1;',
          file_path: 'src/index.ts',
          start_line: 1,
          end_line: 1,
          language: 'typescript',
          chunk_type: 'other',
          dependencies: [],
        },
      ])

      mockEmbedCode.mockResolvedValue([[0.1]])

      await runIndexationPipeline(defaultOptions)

      expect(mockPrismaDeleteMany).toHaveBeenCalledWith({
        where: { repository_id: 'repo-123' },
      })
    })
  })

  describe('deleteRepositoryChunks', () => {
    it('should delete all chunks for a repository', async () => {
      mockPrismaDeleteMany.mockResolvedValue({ count: 50 })

      const count = await deleteRepositoryChunks('repo-123')

      expect(count).toBe(50)
      expect(mockPrismaDeleteMany).toHaveBeenCalledWith({
        where: { repository_id: 'repo-123' },
      })
    })
  })

  describe('getRepositoryIndexStats', () => {
    it('should return repository statistics', async () => {
      mockPrismaFindMany.mockResolvedValue([
        { file_path: 'src/index.ts', language: 'typescript', chunk_type: 'function' },
        { file_path: 'src/index.ts', language: 'typescript', chunk_type: 'function' },
        { file_path: 'src/utils.ts', language: 'typescript', chunk_type: 'class' },
        { file_path: 'app.py', language: 'python', chunk_type: 'function' },
      ])

      const stats = await getRepositoryIndexStats('repo-123')

      expect(stats.totalChunks).toBe(4)
      expect(stats.totalFiles).toBe(3)
      expect(stats.languages).toEqual({ typescript: 3, python: 1 })
      expect(stats.chunkTypes).toEqual({ function: 3, class: 1 })
    })

    it('should return empty stats for unindexed repository', async () => {
      mockPrismaFindMany.mockResolvedValue([])

      const stats = await getRepositoryIndexStats('repo-123')

      expect(stats.totalChunks).toBe(0)
      expect(stats.totalFiles).toBe(0)
      expect(stats.languages).toEqual({})
      expect(stats.chunkTypes).toEqual({})
    })
  })

  describe('isRepositoryIndexed', () => {
    it('should return true when chunks exist', async () => {
      mockPrismaCount.mockResolvedValue(100)

      const indexed = await isRepositoryIndexed('repo-123')

      expect(indexed).toBe(true)
    })

    it('should return false when no chunks exist', async () => {
      mockPrismaCount.mockResolvedValue(0)

      const indexed = await isRepositoryIndexed('repo-123')

      expect(indexed).toBe(false)
    })
  })
})
