import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateChunkContext,
  generateContextsBatch,
  buildContextualContent,
  estimateContextGenerationCost,
  type ChunkForContext,
} from './contextual-generator'

// Mock the AI SDK generateText
vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

import { generateText } from 'ai'

const mockGenerateText = generateText as ReturnType<typeof vi.fn>

describe('contextual-generator', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-api-key' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  const createMockChunk = (name: string): ChunkForContext => ({
    content: `function ${name}() {\n  return "hello";\n}`,
    filePath: `/src/${name}.ts`,
    startLine: 1,
    endLine: 3,
    chunkType: 'function',
    symbolName: name,
    language: 'typescript',
  })

  describe('generateChunkContext', () => {
    it('should generate context for a chunk', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Returns a greeting string, used as a utility function in the application.',
      })

      const chunk = createMockChunk('greet')
      const context = await generateChunkContext(chunk)

      expect(context).toBe('Returns a greeting string, used as a utility function in the application.')
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          maxOutputTokens: 150,
          temperature: 0,
        })
      )
    })

    it('should include symbol name in prompt', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Handles authentication logic.',
      })

      const chunk = createMockChunk('authenticate')
      await generateChunkContext(chunk)

      const call = mockGenerateText.mock.calls[0][0]
      expect(call.prompt).toContain('Name: authenticate')
    })

    it('should include file context if provided', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Main entry point for user authentication.',
      })

      const chunk = createMockChunk('login')
      await generateChunkContext(chunk, {
        fullContent: '// Auth module\nexport function login() {}',
        filePath: '/src/auth.ts',
      })

      const call = mockGenerateText.mock.calls[0][0]
      expect(call.prompt).toContain('Full file context:')
      expect(call.prompt).toContain('// Auth module')
    })

    it('should truncate large file context', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Helper function.',
      })

      const chunk = createMockChunk('helper')
      const largeContent = 'x'.repeat(5000)

      await generateChunkContext(chunk, {
        fullContent: largeContent,
        filePath: '/src/large.ts',
      })

      const call = mockGenerateText.mock.calls[0][0]
      expect(call.prompt).toContain('... (truncated)')
    })

    it('should return empty string on error', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('API Error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const chunk = createMockChunk('failing')
      const context = await generateChunkContext(chunk)

      expect(context).toBe('')
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('generateContextsBatch', () => {
    it('should generate contexts for multiple chunks', async () => {
      mockGenerateText
        .mockResolvedValueOnce({ text: 'Context 1' })
        .mockResolvedValueOnce({ text: 'Context 2' })
        .mockResolvedValueOnce({ text: 'Context 3' })

      const chunks = [
        createMockChunk('func1'),
        createMockChunk('func2'),
        createMockChunk('func3'),
      ]

      const contexts = await generateContextsBatch(chunks)

      expect(contexts).toHaveLength(3)
      expect(contexts[0]).toBe('Context 1')
      expect(contexts[1]).toBe('Context 2')
      expect(contexts[2]).toBe('Context 3')
    })

    it('should call progress callback', async () => {
      mockGenerateText
        .mockResolvedValueOnce({ text: 'Context 1' })
        .mockResolvedValueOnce({ text: 'Context 2' })

      const chunks = [createMockChunk('func1'), createMockChunk('func2')]
      const progressCallback = vi.fn()

      await generateContextsBatch(chunks, undefined, progressCallback)

      expect(progressCallback).toHaveBeenCalled()
      expect(progressCallback).toHaveBeenCalledWith(2, 2)
    })

    it('should handle empty array', async () => {
      const contexts = await generateContextsBatch([])

      expect(contexts).toEqual([])
      expect(mockGenerateText).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully for individual chunks', async () => {
      mockGenerateText
        .mockResolvedValueOnce({ text: 'Context 1' })
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({ text: 'Context 3' })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const chunks = [
        createMockChunk('func1'),
        createMockChunk('func2'),
        createMockChunk('func3'),
      ]

      const contexts = await generateContextsBatch(chunks)

      expect(contexts).toHaveLength(3)
      expect(contexts[0]).toBe('Context 1')
      expect(contexts[1]).toBe('') // Failed chunk
      expect(contexts[2]).toBe('Context 3')

      consoleSpy.mockRestore()
    })
  })

  describe('buildContextualContent', () => {
    it('should prepend context to content', () => {
      const content = 'function hello() {}'
      const context = 'A greeting function.'

      const result = buildContextualContent(content, context)

      expect(result).toBe('A greeting function.\n\nfunction hello() {}')
    })

    it('should return content unchanged if no context', () => {
      const content = 'function hello() {}'

      expect(buildContextualContent(content, null)).toBe(content)
      expect(buildContextualContent(content, undefined)).toBe(content)
      expect(buildContextualContent(content, '')).toBe(content)
      expect(buildContextualContent(content, '   ')).toBe(content)
    })
  })

  describe('estimateContextGenerationCost', () => {
    it('should estimate cost for chunks', () => {
      const chunks = Array(100).fill(createMockChunk('test'))

      const estimate = estimateContextGenerationCost(chunks)

      expect(estimate.inputTokens).toBeGreaterThan(0)
      expect(estimate.outputTokens).toBeGreaterThan(0)
      expect(estimate.estimatedCostUSD).toBeGreaterThan(0)
    })

    it('should scale linearly with chunk count', () => {
      const chunks10 = Array(10).fill(createMockChunk('test'))
      const chunks100 = Array(100).fill(createMockChunk('test'))

      const estimate10 = estimateContextGenerationCost(chunks10)
      const estimate100 = estimateContextGenerationCost(chunks100)

      expect(estimate100.inputTokens).toBe(estimate10.inputTokens * 10)
      expect(estimate100.outputTokens).toBe(estimate10.outputTokens * 10)
    })

    it('should handle empty array', () => {
      const estimate = estimateContextGenerationCost([])

      expect(estimate.inputTokens).toBe(0)
      expect(estimate.outputTokens).toBe(0)
      expect(estimate.estimatedCostUSD).toBe(0)
    })
  })
})
