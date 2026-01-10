import { describe, it, expect } from 'vitest'
import {
  parseCitations,
  splitContentByCitations,
  isCitation,
  type Citation,
} from './citation-parser'

describe('citation-parser', () => {
  describe('parseCitations', () => {
    it('should parse citation with file path only', () => {
      const content = 'The file [src/auth.ts] handles authentication'
      const citations = parseCitations(content)

      expect(citations).toHaveLength(1)
      expect(citations[0]).toEqual({
        path: 'src/auth.ts',
        line: undefined,
        original: '[src/auth.ts]',
        startIndex: 9,
        endIndex: 22,
      })
    })

    it('should parse citation with file path and line number', () => {
      const content = 'See [src/auth.ts:42] for details'
      const citations = parseCitations(content)

      expect(citations).toHaveLength(1)
      expect(citations[0]).toEqual({
        path: 'src/auth.ts',
        line: 42,
        original: '[src/auth.ts:42]',
        startIndex: 4,
        endIndex: 20,
      })
    })

    it('should parse multiple citations', () => {
      const content =
        'Files [src/auth.ts:10] and [lib/utils.ts] are related'
      const citations = parseCitations(content)

      expect(citations).toHaveLength(2)
      expect(citations[0].path).toBe('src/auth.ts')
      expect(citations[0].line).toBe(10)
      expect(citations[1].path).toBe('lib/utils.ts')
      expect(citations[1].line).toBeUndefined()
    })

    it('should handle various file extensions', () => {
      const content = '[file.tsx] [file.js] [file.py] [file.css] [file.json]'
      const citations = parseCitations(content)

      expect(citations).toHaveLength(5)
      expect(citations.map((c) => c.path)).toEqual([
        'file.tsx',
        'file.js',
        'file.py',
        'file.css',
        'file.json',
      ])
    })

    it('should handle nested directory paths', () => {
      const content = '[src/components/ui/Button.tsx:15]'
      const citations = parseCitations(content)

      expect(citations).toHaveLength(1)
      expect(citations[0].path).toBe('src/components/ui/Button.tsx')
      expect(citations[0].line).toBe(15)
    })

    it('should not match markdown links', () => {
      const content = 'See [documentation](https://example.com) for more'
      const citations = parseCitations(content)

      expect(citations).toHaveLength(0)
    })

    it('should not match simple bracketed text without extension', () => {
      const content = 'The [user] can access [admin panel]'
      const citations = parseCitations(content)

      expect(citations).toHaveLength(0)
    })

    it('should return empty array for content without citations', () => {
      const content = 'This is plain text without any citations'
      const citations = parseCitations(content)

      expect(citations).toHaveLength(0)
    })

    it('should handle files with dots in name', () => {
      const content = '[src/auth.test.ts:5]'
      const citations = parseCitations(content)

      expect(citations).toHaveLength(1)
      expect(citations[0].path).toBe('src/auth.test.ts')
    })

    it('should parse line numbers correctly', () => {
      const content = '[file.ts:1] [file.ts:100] [file.ts:9999]'
      const citations = parseCitations(content)

      expect(citations).toHaveLength(3)
      expect(citations[0].line).toBe(1)
      expect(citations[1].line).toBe(100)
      expect(citations[2].line).toBe(9999)
    })
  })

  describe('splitContentByCitations', () => {
    it('should return original content if no citations', () => {
      const content = 'Plain text without citations'
      const segments = splitContentByCitations(content)

      expect(segments).toHaveLength(1)
      expect(segments[0]).toBe(content)
    })

    it('should split content with single citation', () => {
      const content = 'Before [file.ts] after'
      const segments = splitContentByCitations(content)

      expect(segments).toHaveLength(3)
      expect(segments[0]).toBe('Before ')
      expect(isCitation(segments[1])).toBe(true)
      expect((segments[1] as Citation).path).toBe('file.ts')
      expect(segments[2]).toBe(' after')
    })

    it('should split content with multiple citations', () => {
      const content = 'See [file1.ts] and [file2.ts:10] for details'
      const segments = splitContentByCitations(content)

      expect(segments).toHaveLength(5)
      expect(segments[0]).toBe('See ')
      expect(isCitation(segments[1])).toBe(true)
      expect(segments[2]).toBe(' and ')
      expect(isCitation(segments[3])).toBe(true)
      expect(segments[4]).toBe(' for details')
    })

    it('should handle citation at start', () => {
      const content = '[file.ts] at the start'
      const segments = splitContentByCitations(content)

      expect(segments).toHaveLength(2)
      expect(isCitation(segments[0])).toBe(true)
      expect(segments[1]).toBe(' at the start')
    })

    it('should handle citation at end', () => {
      const content = 'At the end [file.ts]'
      const segments = splitContentByCitations(content)

      expect(segments).toHaveLength(2)
      expect(segments[0]).toBe('At the end ')
      expect(isCitation(segments[1])).toBe(true)
    })

    it('should handle adjacent citations', () => {
      const content = '[file1.ts][file2.ts]'
      const segments = splitContentByCitations(content)

      expect(segments).toHaveLength(2)
      expect(isCitation(segments[0])).toBe(true)
      expect(isCitation(segments[1])).toBe(true)
    })
  })

  describe('isCitation', () => {
    it('should return true for Citation objects', () => {
      const citation: Citation = {
        path: 'file.ts',
        line: 10,
        original: '[file.ts:10]',
        startIndex: 0,
        endIndex: 12,
      }
      expect(isCitation(citation)).toBe(true)
    })

    it('should return false for strings', () => {
      expect(isCitation('plain text')).toBe(false)
      expect(isCitation('[file.ts]')).toBe(false)
    })
  })
})
