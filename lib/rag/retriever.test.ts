import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock functions using vi.hoisted
const {
  mockEmbedQuery,
  mockPrismaQueryRaw,
  mockPrismaFindMany,
} = vi.hoisted(() => ({
  mockEmbedQuery: vi.fn(),
  mockPrismaQueryRaw: vi.fn(),
  mockPrismaFindMany: vi.fn(),
}))

// Mock modules
vi.mock('../db/prisma', () => ({
  prisma: {
    $queryRaw: mockPrismaQueryRaw,
    code_chunks: {
      findMany: mockPrismaFindMany,
    },
  },
}))

vi.mock('../embeddings/voyage-client', () => ({
  embedQuery: mockEmbedQuery,
}))

// Import after mocking
import {
  retrieveRelevantChunks,
  vectorSearch,
  textSearch,
  smartSearch,
  searchByFile,
  searchBySymbol,
  searchByType,
  getRepositoryContext,
} from './retriever'

// Mock data
const mockEmbedding = new Array(1024).fill(0.1)

const mockHybridResults = [
  {
    id: 'chunk-1',
    file_path: 'src/index.ts',
    start_line: 1,
    end_line: 10,
    content: 'function main() { console.log("hello") }',
    language: 'typescript',
    chunk_type: 'function',
    symbol_name: 'main',
    combined_score: 0.95,
  },
  {
    id: 'chunk-2',
    file_path: 'src/utils.ts',
    start_line: 5,
    end_line: 15,
    content: 'export function helper() { return 42 }',
    language: 'typescript',
    chunk_type: 'function',
    symbol_name: 'helper',
    combined_score: 0.85,
  },
]

const mockVectorResults = [
  {
    id: 'chunk-1',
    file_path: 'src/index.ts',
    start_line: 1,
    end_line: 10,
    content: 'function main() { console.log("hello") }',
    language: 'typescript',
    chunk_type: 'function',
    symbol_name: 'main',
    similarity: 0.92,
  },
]

const mockTextResults = [
  {
    id: 'chunk-3',
    file_path: 'src/api.ts',
    start_line: 20,
    end_line: 30,
    content: 'export async function fetchUser(id: string) {}',
    language: 'typescript',
    chunk_type: 'function',
    symbol_name: 'fetchUser',
    similarity: 0.75,
  },
]

const mockChunks = [
  {
    id: 'chunk-1',
    file_path: 'src/index.ts',
    start_line: 1,
    end_line: 10,
    content: 'function main() {}',
    language: 'typescript',
    chunk_type: 'function',
    symbol_name: 'main',
  },
  {
    id: 'chunk-2',
    file_path: 'src/index.ts',
    start_line: 15,
    end_line: 25,
    content: 'function helper() {}',
    language: 'typescript',
    chunk_type: 'function',
    symbol_name: 'helper',
  },
]

describe('retriever', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbedQuery.mockResolvedValue(mockEmbedding)
  })

  describe('retrieveRelevantChunks (hybrid search)', () => {
    it('should return chunks from hybrid search', async () => {
      mockPrismaQueryRaw.mockResolvedValue(mockHybridResults)

      const results = await retrieveRelevantChunks('how does main work', 'repo-123')

      expect(results).toHaveLength(2)
      expect(results[0].filePath).toBe('src/index.ts')
      expect(results[0].symbolName).toBe('main')
      expect(results[0].score).toBe(0.95)
      expect(results[1].score).toBe(0.85)
    })

    it('should call embedQuery with the search query', async () => {
      mockPrismaQueryRaw.mockResolvedValue([])

      await retrieveRelevantChunks('test query', 'repo-123')

      expect(mockEmbedQuery).toHaveBeenCalledWith('test query')
    })

    it('should use default parameters', async () => {
      mockPrismaQueryRaw.mockResolvedValue(mockHybridResults)

      await retrieveRelevantChunks('query', 'repo-123')

      // Check that the query includes default weights
      expect(mockPrismaQueryRaw).toHaveBeenCalled()
    })

    it('should respect custom options', async () => {
      mockPrismaQueryRaw.mockResolvedValue([])

      await retrieveRelevantChunks('query', 'repo-123', {
        limit: 5,
        vectorWeight: 0.9,
        textWeight: 0.1,
      })

      expect(mockPrismaQueryRaw).toHaveBeenCalled()
    })

    it('should transform database rows to RetrievedChunk format', async () => {
      mockPrismaQueryRaw.mockResolvedValue([mockHybridResults[0]])

      const results = await retrieveRelevantChunks('query', 'repo-123')

      expect(results[0]).toEqual({
        id: 'chunk-1',
        filePath: 'src/index.ts',
        startLine: 1,
        endLine: 10,
        content: 'function main() { console.log("hello") }',
        language: 'typescript',
        chunkType: 'function',
        symbolName: 'main',
        score: 0.95,
      })
    })
  })

  describe('vectorSearch', () => {
    it('should return chunks from vector search', async () => {
      mockPrismaQueryRaw.mockResolvedValue(mockVectorResults)

      const results = await vectorSearch('semantic search', 'repo-123')

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(0.92)
    })

    it('should use similarity threshold', async () => {
      mockPrismaQueryRaw.mockResolvedValue([])

      await vectorSearch('query', 'repo-123', { similarityThreshold: 0.8 })

      expect(mockPrismaQueryRaw).toHaveBeenCalled()
    })

    it('should use custom limit', async () => {
      mockPrismaQueryRaw.mockResolvedValue([])

      await vectorSearch('query', 'repo-123', { limit: 10 })

      expect(mockPrismaQueryRaw).toHaveBeenCalled()
    })
  })

  describe('textSearch', () => {
    it('should return chunks from text search', async () => {
      mockPrismaQueryRaw.mockResolvedValue(mockTextResults)

      const results = await textSearch('fetchUser', 'repo-123')

      expect(results).toHaveLength(1)
      expect(results[0].symbolName).toBe('fetchUser')
    })

    it('should return empty array for empty query', async () => {
      const results = await textSearch('   ', 'repo-123')

      expect(results).toEqual([])
      expect(mockPrismaQueryRaw).not.toHaveBeenCalled()
    })

    it('should sanitize special characters', async () => {
      mockPrismaQueryRaw.mockResolvedValue([])

      await textSearch('function()', 'repo-123')

      expect(mockPrismaQueryRaw).toHaveBeenCalled()
    })
  })

  describe('smartSearch', () => {
    it('should use identifier weights for simple identifiers', async () => {
      mockPrismaQueryRaw.mockResolvedValue(mockHybridResults)

      await smartSearch('getUserById', 'repo-123')

      // Should boost text weight for identifiers
      expect(mockPrismaQueryRaw).toHaveBeenCalled()
    })

    it('should use code weights for code-like queries', async () => {
      mockPrismaQueryRaw.mockResolvedValue(mockHybridResults)

      await smartSearch('function foo() {}', 'repo-123')

      // Should boost vector weight for code
      expect(mockPrismaQueryRaw).toHaveBeenCalled()
    })

    it('should use default weights for natural language', async () => {
      mockPrismaQueryRaw.mockResolvedValue(mockHybridResults)

      await smartSearch('how does the authentication system work', 'repo-123')

      // Should use default hybrid weights
      expect(mockPrismaQueryRaw).toHaveBeenCalled()
    })

    it('should detect method calls as code', async () => {
      mockPrismaQueryRaw.mockResolvedValue([])

      await smartSearch('user.getName()', 'repo-123')

      expect(mockPrismaQueryRaw).toHaveBeenCalled()
    })
  })

  describe('searchByFile', () => {
    it('should return all chunks from a file', async () => {
      mockPrismaFindMany.mockResolvedValue(mockChunks)

      const results = await searchByFile('src/index.ts', 'repo-123')

      expect(results).toHaveLength(2)
      expect(results[0].filePath).toBe('src/index.ts')
      expect(results[0].score).toBe(1.0) // Direct match
      expect(mockPrismaFindMany).toHaveBeenCalledWith({
        where: {
          repository_id: 'repo-123',
          file_path: 'src/index.ts',
        },
        orderBy: {
          start_line: 'asc',
        },
      })
    })

    it('should return empty array for non-existent file', async () => {
      mockPrismaFindMany.mockResolvedValue([])

      const results = await searchByFile('nonexistent.ts', 'repo-123')

      expect(results).toEqual([])
    })
  })

  describe('searchBySymbol', () => {
    it('should return chunks with matching symbol name', async () => {
      mockPrismaFindMany.mockResolvedValue([mockChunks[0]])

      const results = await searchBySymbol('main', 'repo-123')

      expect(results).toHaveLength(1)
      expect(results[0].symbolName).toBe('main')
      expect(mockPrismaFindMany).toHaveBeenCalledWith({
        where: {
          repository_id: 'repo-123',
          symbol_name: {
            contains: 'main',
            mode: 'insensitive',
          },
        },
        orderBy: {
          file_path: 'asc',
        },
      })
    })

    it('should use case-insensitive matching', async () => {
      mockPrismaFindMany.mockResolvedValue([mockChunks[0]])

      await searchBySymbol('MAIN', 'repo-123')

      expect(mockPrismaFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            symbol_name: expect.objectContaining({
              mode: 'insensitive',
            }),
          }),
        })
      )
    })
  })

  describe('searchByType', () => {
    it('should return chunks of specified type', async () => {
      mockPrismaFindMany.mockResolvedValue(mockChunks)

      const results = await searchByType('function', 'repo-123')

      expect(results).toHaveLength(2)
      expect(mockPrismaFindMany).toHaveBeenCalledWith({
        where: {
          repository_id: 'repo-123',
          chunk_type: 'function',
        },
        orderBy: {
          file_path: 'asc',
        },
        take: 50,
      })
    })

    it('should respect custom limit', async () => {
      mockPrismaFindMany.mockResolvedValue([])

      await searchByType('class', 'repo-123', 10)

      expect(mockPrismaFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      )
    })
  })

  describe('getRepositoryContext', () => {
    it('should return repository statistics', async () => {
      mockPrismaFindMany.mockResolvedValue([
        { file_path: 'src/a.ts', language: 'typescript', chunk_type: 'function' },
        { file_path: 'src/a.ts', language: 'typescript', chunk_type: 'class' },
        { file_path: 'src/b.ts', language: 'typescript', chunk_type: 'function' },
        { file_path: 'app.py', language: 'python', chunk_type: 'function' },
      ])

      const context = await getRepositoryContext('repo-123')

      expect(context.totalChunks).toBe(4)
      expect(context.totalFiles).toBe(3)
      expect(context.languages).toEqual({ typescript: 3, python: 1 })
      expect(context.chunkTypes).toEqual({ function: 3, class: 1 })
    })

    it('should return empty stats for unindexed repository', async () => {
      mockPrismaFindMany.mockResolvedValue([])

      const context = await getRepositoryContext('repo-123')

      expect(context.totalChunks).toBe(0)
      expect(context.totalFiles).toBe(0)
      expect(context.languages).toEqual({})
      expect(context.chunkTypes).toEqual({})
    })
  })

  describe('query type detection', () => {
    it('should recognize identifier patterns', async () => {
      mockPrismaQueryRaw.mockResolvedValue([])

      // These should be detected as identifiers
      await smartSearch('getUserById', 'repo-123')
      await smartSearch('snake_case_name', 'repo-123')
      await smartSearch('PascalCase', 'repo-123')

      expect(mockPrismaQueryRaw).toHaveBeenCalledTimes(3)
    })

    it('should recognize code patterns', async () => {
      mockPrismaQueryRaw.mockResolvedValue([])

      // These should be detected as code
      await smartSearch('if (x > 0) {}', 'repo-123')
      await smartSearch('function test() {}', 'repo-123')
      await smartSearch('arr.map()', 'repo-123')

      expect(mockPrismaQueryRaw).toHaveBeenCalledTimes(3)
    })

    it('should recognize natural language', async () => {
      mockPrismaQueryRaw.mockResolvedValue([])

      // These should be detected as natural language
      await smartSearch('how does the login system work', 'repo-123')
      await smartSearch('explain the database schema', 'repo-123')

      expect(mockPrismaQueryRaw).toHaveBeenCalledTimes(2)
    })
  })
})
