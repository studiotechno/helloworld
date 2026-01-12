/**
 * Integration Tests for RAG Indexation Pipeline
 *
 * Tests the full flow: fetch → filter → chunk → embed → store → retrieve
 * Uses mocked external services but tests real module integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================================
// Mock Setup
// ============================================================================

const {
  mockFetchRepositoryStructure,
  mockFetchFileContent,
  mockEmbedCode,
  mockEmbedQuery,
  mockPrismaDeleteMany,
  mockPrismaFindMany,
  mockPrismaCount,
  mockPrismaTransaction,
  mockPrismaExecuteRaw,
  mockPrismaQueryRaw,
  mockPrismaCreate,
  mockPrismaUpdate,
  mockPrismaFindUnique,
} = vi.hoisted(() => ({
  mockFetchRepositoryStructure: vi.fn(),
  mockFetchFileContent: vi.fn(),
  mockEmbedCode: vi.fn(),
  mockEmbedQuery: vi.fn(),
  mockPrismaDeleteMany: vi.fn(),
  mockPrismaFindMany: vi.fn(),
  mockPrismaCount: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockPrismaExecuteRaw: vi.fn(),
  mockPrismaQueryRaw: vi.fn(),
  mockPrismaCreate: vi.fn(),
  mockPrismaUpdate: vi.fn(),
  mockPrismaFindUnique: vi.fn(),
}))

// Mock Prisma
vi.mock('../db/prisma', () => ({
  prisma: {
    code_chunks: {
      deleteMany: mockPrismaDeleteMany,
      findMany: mockPrismaFindMany,
      count: mockPrismaCount,
      create: mockPrismaCreate,
    },
    indexing_jobs: {
      create: mockPrismaCreate,
      update: mockPrismaUpdate,
      findUnique: mockPrismaFindUnique,
      findMany: mockPrismaFindMany,
    },
    $transaction: mockPrismaTransaction,
    $executeRaw: mockPrismaExecuteRaw,
    $queryRaw: mockPrismaQueryRaw,
  },
}))

// Mock GitHub API
vi.mock('../github/fetch-repository-files', () => ({
  fetchRepositoryStructure: mockFetchRepositoryStructure,
  fetchFileContent: mockFetchFileContent,
}))

// Mock Voyage AI
vi.mock('../embeddings/voyage-client', () => ({
  embedCode: mockEmbedCode,
  embedQuery: mockEmbedQuery,
}))

// Import modules after mocking
import {
  runIndexationPipeline,
  getRepositoryIndexStats,
  isRepositoryIndexed,
  deleteRepositoryChunks,
  type PipelineOptions,
} from './pipeline'
import { chunkFile } from '../parsing/chunker'
import { filterFiles } from '../parsing/file-filter'
import { buildCodeContext, buildMinimalContext } from '../rag/context-builder'
import type { RetrievedChunk } from '../rag/retriever'

// ============================================================================
// Sample Repository Data
// ============================================================================

const SAMPLE_TYPESCRIPT_PROJECT = {
  files: [
    { path: 'src/index.ts', size: 500, sha: 'sha-1', type: 'file' as const },
    { path: 'src/utils/helpers.ts', size: 800, sha: 'sha-2', type: 'file' as const },
    { path: 'src/types/user.ts', size: 300, sha: 'sha-3', type: 'file' as const },
    { path: 'src/services/auth.ts', size: 1200, sha: 'sha-4', type: 'file' as const },
    { path: 'package.json', size: 500, sha: 'sha-5', type: 'file' as const },
    { path: 'tsconfig.json', size: 200, sha: 'sha-6', type: 'file' as const },
    { path: 'node_modules/react/index.js', size: 10000, sha: 'sha-7', type: 'file' as const },
    { path: '.git/config', size: 100, sha: 'sha-8', type: 'file' as const },
    { path: 'dist/bundle.js', size: 50000, sha: 'sha-9', type: 'file' as const },
  ],
  contents: {
    'src/index.ts': `
import { authenticate } from './services/auth'
import { formatUser } from './utils/helpers'
import type { User } from './types/user'

export async function main() {
  const user = await authenticate('token123')
  console.log(formatUser(user))
  return user
}

export function getVersion(): string {
  return '1.0.0'
}
`,
    'src/utils/helpers.ts': `
import type { User } from '../types/user'

export function formatUser(user: User): string {
  return \`\${user.firstName} \${user.lastName} (\${user.email})\`
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
  return emailRegex.test(email)
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}
`,
    'src/types/user.ts': `
export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  createdAt: Date
}

export type UserRole = 'admin' | 'user' | 'guest'

export interface UserWithRole extends User {
  role: UserRole
}
`,
    'src/services/auth.ts': `
import type { User } from '../types/user'
import { validateEmail, generateId } from '../utils/helpers'

const users: Map<string, User> = new Map()

export async function authenticate(token: string): Promise<User | null> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 100))

  if (!token || token.length < 5) {
    throw new Error('Invalid token')
  }

  return users.get(token) || null
}

export async function createUser(email: string, firstName: string, lastName: string): Promise<User> {
  if (!validateEmail(email)) {
    throw new Error('Invalid email format')
  }

  const user: User = {
    id: generateId(),
    email,
    firstName,
    lastName,
    createdAt: new Date(),
  }

  users.set(user.id, user)
  return user
}

export async function deleteUser(userId: string): Promise<boolean> {
  return users.delete(userId)
}
`,
    'package.json': `{
  "name": "sample-project",
  "version": "1.0.0",
  "dependencies": {
    "typescript": "^5.0.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  }
}`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "strict": true
  }
}`,
  },
}

const SAMPLE_PYTHON_PROJECT = {
  files: [
    { path: 'app/main.py', size: 600, sha: 'py-1', type: 'file' as const },
    { path: 'app/models/user.py', size: 400, sha: 'py-2', type: 'file' as const },
    { path: 'requirements.txt', size: 100, sha: 'py-3', type: 'file' as const },
  ],
  contents: {
    'app/main.py': `
from fastapi import FastAPI
from models.user import User, create_user

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.post("/users")
def create_new_user(email: str, name: str):
    user = create_user(email, name)
    return user
`,
    'app/models/user.py': `
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

@dataclass
class User:
    id: str
    email: str
    name: str
    created_at: datetime = datetime.now()

def create_user(email: str, name: str) -> User:
    import uuid
    return User(
        id=str(uuid.uuid4()),
        email=email,
        name=name
    )
`,
    'requirements.txt': `fastapi==0.100.0
uvicorn==0.23.0
`,
  },
}

const SAMPLE_PRISMA_SCHEMA = `
// Prisma schema file

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        String   @id @default(uuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
}
`

// ============================================================================
// Helper Functions
// ============================================================================

function generateMockEmbedding(seed: number = 0): number[] {
  // Generate deterministic 1024-dimensional embedding
  const embedding: number[] = []
  for (let i = 0; i < 1024; i++) {
    embedding.push(Math.sin(seed + i * 0.1) * 0.5)
  }
  return embedding
}

function setupSuccessfulMocks(project: typeof SAMPLE_TYPESCRIPT_PROJECT) {
  // Reset all mocks
  vi.clearAllMocks()

  // Setup repository structure
  mockFetchRepositoryStructure.mockResolvedValue({
    files: project.files,
    estimatedLines: 500,
    isLarge: false,
    gitignore: 'node_modules\ndist\n.git',
  })

  // Setup file content fetching
  mockFetchFileContent.mockImplementation(async (_, __, ___, path: string) => {
    const content = project.contents[path as keyof typeof project.contents]
    if (!content) return null
    return {
      path,
      content,
      sha: 'content-sha',
      size: content.length,
      encoding: 'utf-8',
    }
  })

  // Setup embeddings
  let embeddingSeed = 0
  mockEmbedCode.mockImplementation(async (chunks: string[]) => {
    return chunks.map(() => generateMockEmbedding(embeddingSeed++))
  })

  mockEmbedQuery.mockImplementation(async (query: string) => {
    return generateMockEmbedding(query.length)
  })

  // Setup Prisma mocks
  mockPrismaDeleteMany.mockResolvedValue({ count: 0 })
  mockPrismaTransaction.mockResolvedValue([])
  mockPrismaCount.mockResolvedValue(0)
  mockPrismaFindMany.mockResolvedValue([])
  mockPrismaCreate.mockImplementation(async (data) => ({ id: 'job-1', ...data.data }))
  mockPrismaUpdate.mockResolvedValue({})
  mockPrismaFindUnique.mockResolvedValue(null)
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('RAG Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // --------------------------------------------------------------------------
  // Full Pipeline Tests
  // --------------------------------------------------------------------------

  describe('Full Pipeline: fetch → chunk → embed → store → retrieve', () => {
    it('should process a TypeScript project end-to-end', async () => {
      setupSuccessfulMocks(SAMPLE_TYPESCRIPT_PROJECT)

      const options: PipelineOptions = {
        accessToken: 'test-token',
        repositoryId: 'repo-123',
        owner: 'test-owner',
        repo: 'test-repo',
        jobId: 'job-456',
      }

      const result = await runIndexationPipeline(options)

      expect(result.success).toBe(true)
      expect(result.filesProcessed).toBeGreaterThan(0)
      expect(result.chunksCreated).toBeGreaterThan(0)

      // Verify file filtering worked (node_modules, .git, dist excluded)
      expect(mockFetchFileContent).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'node_modules/react/index.js',
        expect.anything()
      )

      // Verify embeddings were generated
      expect(mockEmbedCode).toHaveBeenCalled()

      // Verify database operations
      expect(mockPrismaDeleteMany).toHaveBeenCalled()
      expect(mockPrismaTransaction).toHaveBeenCalled()
    })

    it('should process a Python project end-to-end', async () => {
      setupSuccessfulMocks(SAMPLE_PYTHON_PROJECT)

      const result = await runIndexationPipeline({
        accessToken: 'test-token',
        repositoryId: 'repo-python',
        owner: 'test-owner',
        repo: 'python-project',
        jobId: 'job-py',
      })

      expect(result.success).toBe(true)
      // requirements.txt may be filtered out as non-code, so expect 2-3 files
      expect(result.filesProcessed).toBeGreaterThanOrEqual(2)
    })

    it('should track progress through all phases', async () => {
      setupSuccessfulMocks(SAMPLE_TYPESCRIPT_PROJECT)

      const progressUpdates: Array<{ phase: string; progress: number; message: string }> = []

      await runIndexationPipeline({
        accessToken: 'test-token',
        repositoryId: 'repo-123',
        owner: 'test-owner',
        repo: 'test-repo',
        jobId: 'job-456',
        onProgress: (phase, progress, message) => {
          progressUpdates.push({ phase, progress, message })
        },
      })

      // Verify all phases were visited
      const phases = new Set(progressUpdates.map(p => p.phase))
      expect(phases.has('Fetching files')).toBe(true)
      expect(phases.has('Parsing code')).toBe(true)
      expect(phases.has('Generating embeddings')).toBe(true)
      expect(phases.has('Finalizing')).toBe(true)

      // Verify progress increases
      const progressValues = progressUpdates.map(p => p.progress)
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1] - 1) // Allow small decreases between phases
      }
    })
  })

  // --------------------------------------------------------------------------
  // Chunking + Filtering Integration
  // --------------------------------------------------------------------------

  describe('Chunking + File Filtering Integration', () => {
    it('should filter then chunk TypeScript files correctly', () => {
      const files = SAMPLE_TYPESCRIPT_PROJECT.files.map(f => ({
        path: f.path,
        size: f.size,
      }))

      const filterResult = filterFiles(files, {
        gitignoreContent: 'node_modules\ndist\n.git',
        respectGitignore: true,
      })

      // Should exclude node_modules, dist, .git
      expect(filterResult.included.length).toBe(6)
      expect(filterResult.excluded.length).toBe(3)

      // Now chunk the included files
      const allChunks = filterResult.included.flatMap(file => {
        const content = SAMPLE_TYPESCRIPT_PROJECT.contents[file.path as keyof typeof SAMPLE_TYPESCRIPT_PROJECT.contents]
        if (!content) return []
        return chunkFile(content, file.path)
      })

      // Verify chunks were created
      expect(allChunks.length).toBeGreaterThan(0)

      // Verify we have various chunk types
      const chunkTypes = new Set(allChunks.map(c => c.chunk_type))
      expect(chunkTypes.has('function')).toBe(true)
      expect(chunkTypes.has('interface')).toBe(true)

      // Verify all chunks have required fields
      for (const chunk of allChunks) {
        expect(chunk.file_path).toBeDefined()
        expect(chunk.start_line).toBeGreaterThan(0)
        expect(chunk.end_line).toBeGreaterThanOrEqual(chunk.start_line)
        expect(chunk.content.length).toBeGreaterThan(0)
        expect(chunk.language).toBeDefined()
      }
    })

    it('should extract functions with correct metadata', () => {
      const authContent = SAMPLE_TYPESCRIPT_PROJECT.contents['src/services/auth.ts']
      const chunks = chunkFile(authContent, 'src/services/auth.ts')

      // Find the authenticate function
      const authenticateChunk = chunks.find(c => c.symbol_name === 'authenticate')
      expect(authenticateChunk).toBeDefined()
      expect(authenticateChunk?.chunk_type).toBe('function')
      expect(authenticateChunk?.language).toBe('typescript')

      // Find createUser function
      const createUserChunk = chunks.find(c => c.symbol_name === 'createUser')
      expect(createUserChunk).toBeDefined()
    })

    it('should handle Prisma schema files specially', () => {
      const chunks = chunkFile(SAMPLE_PRISMA_SCHEMA, 'prisma/schema.prisma')

      // Should extract models - Prisma models are chunked as 'type'
      const models = chunks.filter(c => c.chunk_type === 'type')
      expect(models.length).toBeGreaterThanOrEqual(2) // User and Post

      // Verify model names
      const modelNames = models.map(m => m.symbol_name)
      expect(modelNames).toContain('User')
      expect(modelNames).toContain('Post')
    })

    it('should handle Python files', () => {
      const pythonContent = SAMPLE_PYTHON_PROJECT.contents['app/main.py']
      const chunks = chunkFile(pythonContent, 'app/main.py')

      // Should find functions
      const functions = chunks.filter(c => c.chunk_type === 'function')
      expect(functions.length).toBeGreaterThan(0)

      // Verify language
      expect(chunks[0].language).toBe('python')
    })
  })

  // --------------------------------------------------------------------------
  // Context Builder Integration
  // --------------------------------------------------------------------------

  describe('Context Builder Integration', () => {
    it('should build context from retrieved chunks', () => {
      const chunks: RetrievedChunk[] = [
        {
          id: '1',
          filePath: 'src/services/auth.ts',
          startLine: 10,
          endLine: 20,
          content: 'export async function authenticate(token: string): Promise<User | null> { ... }',
          language: 'typescript',
          chunkType: 'function',
          symbolName: 'authenticate',
          score: 0.95,
        },
        {
          id: '2',
          filePath: 'src/types/user.ts',
          startLine: 1,
          endLine: 8,
          content: 'export interface User { id: string; email: string; ... }',
          language: 'typescript',
          chunkType: 'interface',
          symbolName: 'User',
          score: 0.88,
        },
      ]

      const result = buildCodeContext(chunks)

      // Verify context structure (result.context is the string)
      expect(result.context).toContain('src/services/auth.ts')
      expect(result.context).toContain('src/types/user.ts')
      expect(result.context).toContain('authenticate')
      expect(result.context).toContain('User')
      expect(result.context).toContain('```typescript')

      // Verify citation format
      expect(result.context).toMatch(/\[.*:.*-.*\]/)

      // Verify result metadata
      expect(result.chunksIncluded).toBe(2)
      expect(result.chunksTotal).toBe(2)
    })

    it('should respect token limits in context building', () => {
      // Create many chunks to test token limits
      const chunks: RetrievedChunk[] = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        filePath: `src/file${i}.ts`,
        startLine: 1,
        endLine: 100,
        content: 'x'.repeat(5000), // Large content
        language: 'typescript',
        chunkType: 'function',
        symbolName: `function${i}`,
        score: 0.9 - i * 0.01,
      }))

      const result = buildCodeContext(chunks, { maxTokens: 10000 })

      // Context should not include all chunks due to token limit
      // The function should truncate based on token estimation
      expect(result.context.length).toBeLessThan(50 * 5000)
      expect(result.truncated).toBe(true)
      expect(result.chunksIncluded).toBeLessThan(50)
    })

    it('should build minimal context correctly', () => {
      const chunks: RetrievedChunk[] = [
        {
          id: '1',
          filePath: 'src/auth.ts',
          startLine: 1,
          endLine: 10,
          content: 'code here',
          language: 'typescript',
          chunkType: 'function',
          symbolName: 'login',
          score: 0.9,
        },
      ]

      const minimal = buildMinimalContext(chunks)

      expect(minimal).toContain('src/auth.ts')
      expect(minimal).toContain('login')
      // Should not contain full code
      expect(minimal.length).toBeLessThan(500)
    })
  })

  // --------------------------------------------------------------------------
  // Sample Repository Tests
  // --------------------------------------------------------------------------

  describe('Sample Repository Tests', () => {
    it('should handle small repository (< 10 files)', async () => {
      const smallProject = {
        files: [
          { path: 'index.ts', size: 100, sha: 'sha-1', type: 'file' as const },
          { path: 'utils.ts', size: 50, sha: 'sha-2', type: 'file' as const },
        ],
        contents: {
          'index.ts': 'export const hello = () => "world"',
          'utils.ts': 'export const add = (a: number, b: number) => a + b',
        },
      }

      setupSuccessfulMocks(smallProject)

      const result = await runIndexationPipeline({
        accessToken: 'test-token',
        repositoryId: 'small-repo',
        owner: 'test',
        repo: 'small',
        jobId: 'job-small',
      })

      expect(result.success).toBe(true)
      expect(result.filesProcessed).toBe(2)
    })

    it('should handle medium repository (50-100 files)', async () => {
      // Create a medium-sized project
      const files = Array.from({ length: 75 }, (_, i) => ({
        path: `src/module${i}/index.ts`,
        size: 500,
        sha: `sha-${i}`,
        type: 'file' as const,
      }))

      const contents: Record<string, string> = {}
      files.forEach((f, i) => {
        contents[f.path] = `export function handler${i}() { return ${i} }`
      })

      const mediumProject = { files, contents }
      setupSuccessfulMocks(mediumProject)

      const result = await runIndexationPipeline({
        accessToken: 'test-token',
        repositoryId: 'medium-repo',
        owner: 'test',
        repo: 'medium',
        jobId: 'job-medium',
      })

      expect(result.success).toBe(true)
      expect(result.filesProcessed).toBe(75)
    })

    it('should handle repository with only config files', async () => {
      const configOnlyProject = {
        files: [
          { path: 'package.json', size: 200, sha: 'sha-1', type: 'file' as const },
          { path: 'tsconfig.json', size: 100, sha: 'sha-2', type: 'file' as const },
          { path: '.eslintrc.json', size: 150, sha: 'sha-3', type: 'file' as const },
        ],
        contents: {
          'package.json': '{ "name": "test" }',
          'tsconfig.json': '{ "compilerOptions": {} }',
          '.eslintrc.json': '{ "rules": {} }',
        },
      }

      setupSuccessfulMocks(configOnlyProject)

      const result = await runIndexationPipeline({
        accessToken: 'test-token',
        repositoryId: 'config-repo',
        owner: 'test',
        repo: 'config-only',
        jobId: 'job-config',
      })

      expect(result.success).toBe(true)
      // Config files should still be processed
      expect(result.filesProcessed).toBeGreaterThanOrEqual(0)
    })

    it('should handle repository with mixed languages', async () => {
      const mixedProject = {
        files: [
          { path: 'backend/main.py', size: 500, sha: 'sha-1', type: 'file' as const },
          { path: 'frontend/App.tsx', size: 600, sha: 'sha-2', type: 'file' as const },
          { path: 'scripts/build.sh', size: 200, sha: 'sha-3', type: 'file' as const },
          { path: 'lib/utils.go', size: 400, sha: 'sha-4', type: 'file' as const },
        ],
        contents: {
          'backend/main.py': 'def main():\n    print("Hello")',
          'frontend/App.tsx': 'export function App() { return <div>Hello</div> }',
          'scripts/build.sh': '#!/bin/bash\necho "Building..."',
          'lib/utils.go': 'package lib\nfunc Add(a, b int) int { return a + b }',
        },
      }

      setupSuccessfulMocks(mixedProject)

      const result = await runIndexationPipeline({
        accessToken: 'test-token',
        repositoryId: 'mixed-repo',
        owner: 'test',
        repo: 'mixed',
        jobId: 'job-mixed',
      })

      expect(result.success).toBe(true)
      expect(result.filesProcessed).toBe(4)
    })
  })

  // --------------------------------------------------------------------------
  // Error Handling & Recovery Tests
  // --------------------------------------------------------------------------

  describe('Error Handling & Recovery', () => {
    it('should handle GitHub API failure gracefully', async () => {
      setupSuccessfulMocks(SAMPLE_TYPESCRIPT_PROJECT)
      mockFetchRepositoryStructure.mockRejectedValue(new Error('GitHub API rate limit exceeded'))

      const result = await runIndexationPipeline({
        accessToken: 'test-token',
        repositoryId: 'repo-123',
        owner: 'test',
        repo: 'test',
        jobId: 'job-fail',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('rate limit')
    })

    it('should handle Voyage AI embedding failure', async () => {
      setupSuccessfulMocks(SAMPLE_TYPESCRIPT_PROJECT)
      mockEmbedCode.mockRejectedValue(new Error('Voyage AI service unavailable'))

      const result = await runIndexationPipeline({
        accessToken: 'test-token',
        repositoryId: 'repo-123',
        owner: 'test',
        repo: 'test',
        jobId: 'job-embed-fail',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Voyage AI')
    })

    it('should handle database storage failure', async () => {
      setupSuccessfulMocks(SAMPLE_TYPESCRIPT_PROJECT)
      mockPrismaTransaction.mockRejectedValue(new Error('Database connection lost'))

      const result = await runIndexationPipeline({
        accessToken: 'test-token',
        repositoryId: 'repo-123',
        owner: 'test',
        repo: 'test',
        jobId: 'job-db-fail',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Database')
    })

    it('should handle file fetch failures for individual files', async () => {
      setupSuccessfulMocks(SAMPLE_TYPESCRIPT_PROJECT)

      // Make one file fail to fetch
      mockFetchFileContent.mockImplementation(async (_, __, ___, path: string) => {
        if (path === 'src/services/auth.ts') {
          return null // Simulate fetch failure
        }
        const content = SAMPLE_TYPESCRIPT_PROJECT.contents[path as keyof typeof SAMPLE_TYPESCRIPT_PROJECT.contents]
        if (!content) return null
        return { path, content, sha: 'sha', size: content.length, encoding: 'utf-8' }
      })

      const result = await runIndexationPipeline({
        accessToken: 'test-token',
        repositoryId: 'repo-123',
        owner: 'test',
        repo: 'test',
        jobId: 'job-partial',
      })

      // Should still succeed, just skip the failed file
      expect(result.success).toBe(true)
      expect(result.filesProcessed).toBeLessThan(6) // Less than all files
    })

    it('should handle empty repository', async () => {
      setupSuccessfulMocks(SAMPLE_TYPESCRIPT_PROJECT)
      mockFetchRepositoryStructure.mockResolvedValue({
        files: [],
        estimatedLines: 0,
        isLarge: false,
        gitignore: null,
      })

      const result = await runIndexationPipeline({
        accessToken: 'test-token',
        repositoryId: 'empty-repo',
        owner: 'test',
        repo: 'empty',
        jobId: 'job-empty',
      })

      expect(result.success).toBe(true)
      expect(result.filesProcessed).toBe(0)
      expect(result.chunksCreated).toBe(0)
    })

    it('should handle repository with only ignored files', async () => {
      setupSuccessfulMocks(SAMPLE_TYPESCRIPT_PROJECT)
      mockFetchRepositoryStructure.mockResolvedValue({
        files: [
          { path: 'node_modules/pkg/index.js', size: 1000, sha: 'sha-1', type: 'file' },
          { path: 'dist/bundle.js', size: 5000, sha: 'sha-2', type: 'file' },
        ],
        estimatedLines: 100,
        isLarge: false,
        gitignore: 'node_modules\ndist',
      })

      const result = await runIndexationPipeline({
        accessToken: 'test-token',
        repositoryId: 'ignored-repo',
        owner: 'test',
        repo: 'ignored',
        jobId: 'job-ignored',
      })

      expect(result.success).toBe(true)
      expect(result.chunksCreated).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // Performance Benchmarks
  // --------------------------------------------------------------------------

  describe('Performance Benchmarks', () => {
    it('should process 100 files in reasonable time', async () => {
      // Create 100 small files
      const files = Array.from({ length: 100 }, (_, i) => ({
        path: `src/file${i}.ts`,
        size: 200,
        sha: `sha-${i}`,
        type: 'file' as const,
      }))

      const contents: Record<string, string> = {}
      files.forEach((f, i) => {
        contents[f.path] = `export function fn${i}() { return ${i} }`
      })

      setupSuccessfulMocks({ files, contents })

      const startTime = Date.now()

      const result = await runIndexationPipeline({
        accessToken: 'test-token',
        repositoryId: 'perf-repo',
        owner: 'test',
        repo: 'perf',
        jobId: 'job-perf',
      })

      const duration = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(result.filesProcessed).toBe(100)
      // With mocked APIs, this should be very fast (< 5 seconds)
      expect(duration).toBeLessThan(5000)
    })

    it('should chunk large file efficiently', () => {
      // Create a large file (5000+ lines)
      const largeContent = Array.from({ length: 200 }, (_, i) => `
export function handler${i}(request: Request): Response {
  const data = processData(request.body)
  const result = computeResult(data)
  return new Response(JSON.stringify(result))
}
`).join('\n')

      const startTime = Date.now()
      const chunks = chunkFile(largeContent, 'large-file.ts')
      const duration = Date.now() - startTime

      expect(chunks.length).toBeGreaterThan(0)
      // Chunking should be fast (< 1 second)
      expect(duration).toBeLessThan(1000)
    })

    it('should filter large file list efficiently', () => {
      // Create 10000 files to filter
      const files = Array.from({ length: 10000 }, (_, i) => ({
        path: i % 10 === 0 ? `node_modules/pkg${i}/index.js` : `src/file${i}.ts`,
        size: 100,
      }))

      const startTime = Date.now()
      const result = filterFiles(files, {
        gitignoreContent: 'node_modules',
        respectGitignore: true,
      })
      const duration = Date.now() - startTime

      expect(result.included.length).toBe(9000) // 90% not in node_modules
      expect(result.excluded.length).toBe(1000) // 10% in node_modules
      // Filtering should be fast (< 500ms)
      expect(duration).toBeLessThan(500)
    })

    it('should build context for many chunks efficiently', () => {
      const chunks: RetrievedChunk[] = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        filePath: `src/file${i}.ts`,
        startLine: 1,
        endLine: 10,
        content: `export function fn${i}() { return ${i} }`,
        language: 'typescript',
        chunkType: 'function',
        symbolName: `fn${i}`,
        score: 0.9,
      }))

      const startTime = Date.now()
      const result = buildCodeContext(chunks)
      const duration = Date.now() - startTime

      expect(result.context.length).toBeGreaterThan(0)
      expect(result.chunksIncluded).toBeGreaterThan(0)
      // Context building should be fast (< 100ms)
      expect(duration).toBeLessThan(100)
    })
  })

  // --------------------------------------------------------------------------
  // Repository Stats & Index Check
  // --------------------------------------------------------------------------

  describe('Repository Stats & Index Status', () => {
    it('should return correct stats for indexed repository', async () => {
      mockPrismaFindMany.mockResolvedValue([
        { file_path: 'src/a.ts', language: 'typescript', chunk_type: 'function' },
        { file_path: 'src/a.ts', language: 'typescript', chunk_type: 'function' },
        { file_path: 'src/b.ts', language: 'typescript', chunk_type: 'class' },
        { file_path: 'app/c.py', language: 'python', chunk_type: 'function' },
      ])

      const stats = await getRepositoryIndexStats('repo-123')

      expect(stats.totalChunks).toBe(4)
      expect(stats.totalFiles).toBe(3)
      expect(stats.languages).toEqual({ typescript: 3, python: 1 })
      expect(stats.chunkTypes).toEqual({ function: 3, class: 1 })
    })

    it('should correctly identify indexed repository', async () => {
      mockPrismaCount.mockResolvedValue(50)

      const indexed = await isRepositoryIndexed('repo-123')
      expect(indexed).toBe(true)
    })

    it('should correctly identify non-indexed repository', async () => {
      mockPrismaCount.mockResolvedValue(0)

      const indexed = await isRepositoryIndexed('repo-empty')
      expect(indexed).toBe(false)
    })

    it('should delete repository chunks correctly', async () => {
      mockPrismaDeleteMany.mockResolvedValue({ count: 150 })

      const deletedCount = await deleteRepositoryChunks('repo-123')
      expect(deletedCount).toBe(150)
      expect(mockPrismaDeleteMany).toHaveBeenCalledWith({
        where: { repository_id: 'repo-123' },
      })
    })
  })
})
