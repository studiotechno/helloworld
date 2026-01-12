import { describe, it, expect } from 'vitest'
import {
  buildCodeContext,
  buildMinimalContext,
  buildFileContext,
  formatCitation,
  extractCitations,
  buildEnhancedSystemPrompt,
} from './context-builder'
import { type RetrievedChunk } from './retriever'

// Mock chunks for testing
const mockChunks: RetrievedChunk[] = [
  {
    id: 'chunk-1',
    filePath: 'src/index.ts',
    startLine: 1,
    endLine: 10,
    content: 'export function main() {\n  console.log("hello")\n}',
    language: 'typescript',
    chunkType: 'function',
    symbolName: 'main',
    score: 0.95,
  },
  {
    id: 'chunk-2',
    filePath: 'src/index.ts',
    startLine: 15,
    endLine: 25,
    content: 'export function helper() {\n  return 42\n}',
    language: 'typescript',
    chunkType: 'function',
    symbolName: 'helper',
    score: 0.85,
  },
  {
    id: 'chunk-3',
    filePath: 'src/utils.ts',
    startLine: 1,
    endLine: 8,
    content: 'export const config = {\n  apiUrl: "https://api.example.com"\n}',
    language: 'typescript',
    chunkType: 'other',
    symbolName: 'config',
    score: 0.75,
  },
  {
    id: 'chunk-4',
    filePath: 'lib/api.ts',
    startLine: 10,
    endLine: 30,
    content: 'export async function fetchData(id: string) {\n  const response = await fetch(`/api/${id}`)\n  return response.json()\n}',
    language: 'typescript',
    chunkType: 'function',
    symbolName: 'fetchData',
    score: 0.70,
  },
]

describe('context-builder', () => {
  describe('buildCodeContext', () => {
    it('should return empty context message for no chunks', () => {
      const result = buildCodeContext([])

      expect(result.chunksIncluded).toBe(0)
      expect(result.chunksTotal).toBe(0)
      expect(result.truncated).toBe(false)
      expect(result.context).toContain('Aucun code pertinent')
    })

    it('should return English message when language is en', () => {
      const result = buildCodeContext([], { language: 'en' })

      expect(result.context).toContain('No relevant code found')
    })

    it('should include all chunks when within token limit', () => {
      const result = buildCodeContext(mockChunks)

      expect(result.chunksIncluded).toBe(4)
      expect(result.chunksTotal).toBe(4)
      expect(result.truncated).toBe(false)
      expect(result.files).toHaveLength(3)
    })

    it('should group chunks by file', () => {
      const result = buildCodeContext(mockChunks, { groupByFile: true })

      // Should have file headers
      expect(result.context).toContain('📄 src/index.ts')
      expect(result.context).toContain('📄 src/utils.ts')
      expect(result.context).toContain('📄 lib/api.ts')
    })

    it('should include file path and line numbers', () => {
      const result = buildCodeContext(mockChunks)

      expect(result.context).toContain('[src/index.ts:1-10]')
      expect(result.context).toContain('[src/index.ts:15-25]')
      expect(result.context).toContain('[lib/api.ts:10-30]')
    })

    it('should include symbol names', () => {
      const result = buildCodeContext(mockChunks)

      expect(result.context).toContain('`main`')
      expect(result.context).toContain('`helper`')
      expect(result.context).toContain('`fetchData`')
    })

    it('should include chunk types', () => {
      const result = buildCodeContext(mockChunks)

      expect(result.context).toContain('**function**')
      expect(result.context).toContain('**other**')
    })

    it('should include code blocks with language hints', () => {
      const result = buildCodeContext(mockChunks)

      expect(result.context).toContain('```typescript')
      expect(result.context).toContain('export function main()')
      expect(result.context).toContain('```')
    })

    it('should include scores when requested', () => {
      const result = buildCodeContext(mockChunks, { includeScores: true })

      expect(result.context).toContain('Relevance: 95%')
      expect(result.context).toContain('Relevance: 85%')
    })

    it('should not include scores by default', () => {
      const result = buildCodeContext(mockChunks)

      expect(result.context).not.toContain('Relevance:')
    })

    it('should include citation instructions in footer', () => {
      const result = buildCodeContext(mockChunks)

      expect(result.context).toContain('[chemin:lignes]')
    })

    it('should include English citation instructions when language is en', () => {
      const result = buildCodeContext(mockChunks, { language: 'en' })

      expect(result.context).toContain('[path:lines]')
    })

    it('should truncate when exceeding token limit', () => {
      // Use a very small token limit
      const result = buildCodeContext(mockChunks, { maxTokens: 100 })

      expect(result.truncated).toBe(true)
      expect(result.chunksIncluded).toBeLessThan(result.chunksTotal)
      expect(result.context).toContain('limite de tokens')
    })

    it('should estimate tokens correctly', () => {
      const result = buildCodeContext(mockChunks)

      // Token estimate should be roughly chars / 4
      const expectedTokens = Math.ceil(result.context.length / 4)
      expect(result.estimatedTokens).toBe(expectedTokens)
    })

    it('should return list of included files', () => {
      const result = buildCodeContext(mockChunks)

      expect(result.files).toContain('src/index.ts')
      expect(result.files).toContain('src/utils.ts')
      expect(result.files).toContain('lib/api.ts')
    })

    it('should work without grouping', () => {
      const result = buildCodeContext(mockChunks, { groupByFile: false })

      expect(result.chunksIncluded).toBe(4)
      // Should still include all chunks but not grouped
      expect(result.context).toContain('[src/index.ts:1-10]')
    })
  })

  describe('buildMinimalContext', () => {
    it('should return minimal message for no chunks', () => {
      const result = buildMinimalContext([])

      expect(result).toContain('Aucun code pertinent')
    })

    it('should list files with symbols', () => {
      const result = buildMinimalContext(mockChunks)

      expect(result).toContain('**src/index.ts**')
      expect(result).toContain('`main`')
      expect(result).toContain('`helper`')
      expect(result).toContain('**lib/api.ts**')
    })

    it('should work in English', () => {
      const result = buildMinimalContext(mockChunks, { language: 'en' })

      expect(result).toContain('Relevant Files')
    })
  })

  describe('buildFileContext', () => {
    it('should show all chunks from a specific file', () => {
      const result = buildFileContext(mockChunks, 'src/index.ts')

      expect(result).toContain('📄 src/index.ts')
      expect(result).toContain('`main`')
      expect(result).toContain('`helper`')
      expect(result).not.toContain('fetchData')
    })

    it('should return message for non-existent file', () => {
      const result = buildFileContext(mockChunks, 'nonexistent.ts')

      expect(result).toContain('Aucun contenu trouve')
    })

    it('should sort chunks by line number', () => {
      const result = buildFileContext(mockChunks, 'src/index.ts')

      const mainIndex = result.indexOf('main')
      const helperIndex = result.indexOf('helper')
      expect(mainIndex).toBeLessThan(helperIndex)
    })
  })

  describe('formatCitation', () => {
    it('should format citation correctly', () => {
      const citation = formatCitation(mockChunks[0])

      expect(citation).toBe('[src/index.ts:1-10]')
    })

    it('should handle different line ranges', () => {
      const citation = formatCitation(mockChunks[3])

      expect(citation).toBe('[lib/api.ts:10-30]')
    })
  })

  describe('extractCitations', () => {
    it('should extract all citations', () => {
      const citations = extractCitations(mockChunks)

      expect(citations).toHaveLength(4)
      expect(citations[0]).toEqual({
        file: 'src/index.ts',
        startLine: 1,
        endLine: 10,
        symbol: 'main',
      })
    })

    it('should handle chunks without symbol names', () => {
      const chunksWithoutSymbol: RetrievedChunk[] = [
        {
          ...mockChunks[0],
          symbolName: null,
        },
      ]

      const citations = extractCitations(chunksWithoutSymbol)

      expect(citations[0].symbol).toBeUndefined()
    })

    it('should return empty array for no chunks', () => {
      const citations = extractCitations([])

      expect(citations).toEqual([])
    })
  })

  describe('buildEnhancedSystemPrompt', () => {
    it('should combine base prompt with code context', () => {
      const basePrompt = 'You are a helpful assistant.'
      const { prompt, result } = buildEnhancedSystemPrompt(basePrompt, mockChunks)

      expect(prompt).toContain('You are a helpful assistant.')
      expect(prompt).toContain('Code source pertinent')
      expect(result.chunksIncluded).toBe(4)
    })

    it('should pass options to buildCodeContext', () => {
      const basePrompt = 'Base prompt'
      const { prompt } = buildEnhancedSystemPrompt(basePrompt, mockChunks, {
        language: 'en',
        includeScores: true,
      })

      expect(prompt).toContain('Relevant Source Code')
      expect(prompt).toContain('Relevance:')
    })

    it('should handle empty chunks', () => {
      const basePrompt = 'Base prompt'
      const { prompt, result } = buildEnhancedSystemPrompt(basePrompt, [])

      expect(prompt).toContain('Base prompt')
      expect(result.chunksIncluded).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle chunks with very long content', () => {
      const longContent = 'x'.repeat(10000)
      const longChunk: RetrievedChunk = {
        ...mockChunks[0],
        content: longContent,
      }

      const result = buildCodeContext([longChunk])

      expect(result.chunksIncluded).toBe(1)
      expect(result.context).toContain(longContent)
    })

    it('should handle special characters in content', () => {
      const specialChunk: RetrievedChunk = {
        ...mockChunks[0],
        content: 'const regex = /[a-z]+/g;\nconst html = "<div>test</div>";',
      }

      const result = buildCodeContext([specialChunk])

      expect(result.context).toContain('/[a-z]+/g')
      expect(result.context).toContain('<div>')
    })

    it('should handle chunks with null symbolName', () => {
      const noSymbolChunk: RetrievedChunk = {
        ...mockChunks[0],
        symbolName: null,
      }

      const result = buildCodeContext([noSymbolChunk])

      expect(result.chunksIncluded).toBe(1)
      // Should still show location
      expect(result.context).toContain('[src/index.ts:1-10]')
    })

    it('should handle single chunk', () => {
      const result = buildCodeContext([mockChunks[0]])

      expect(result.chunksIncluded).toBe(1)
      expect(result.files).toEqual(['src/index.ts'])
    })

    it('should deduplicate files list', () => {
      const result = buildCodeContext(mockChunks)

      // src/index.ts appears twice in chunks but should only appear once in files
      const srcIndexCount = result.files.filter(f => f === 'src/index.ts').length
      expect(srcIndexCount).toBe(1)
    })
  })
})
