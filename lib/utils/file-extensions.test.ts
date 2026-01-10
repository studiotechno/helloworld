import { describe, it, expect } from 'vitest'
import { getExtensionColor, extractExtension } from './file-extensions'

describe('file-extensions', () => {
  describe('getExtensionColor', () => {
    it('should return blue for TypeScript files', () => {
      expect(getExtensionColor('ts')).toContain('bg-blue-500')
      expect(getExtensionColor('tsx')).toContain('bg-blue-500')
    })

    it('should return yellow for JavaScript files', () => {
      expect(getExtensionColor('js')).toContain('bg-yellow-500')
      expect(getExtensionColor('jsx')).toContain('bg-yellow-500')
    })

    it('should return green for Python files', () => {
      expect(getExtensionColor('py')).toContain('bg-green-500')
    })

    it('should return purple for CSS files', () => {
      expect(getExtensionColor('css')).toContain('bg-purple-500')
      expect(getExtensionColor('scss')).toContain('bg-purple-500')
    })

    it('should return orange for config files', () => {
      expect(getExtensionColor('json')).toContain('bg-orange-500')
      expect(getExtensionColor('yaml')).toContain('bg-orange-500')
      expect(getExtensionColor('yml')).toContain('bg-orange-500')
    })

    it('should return gray for markdown files', () => {
      expect(getExtensionColor('md')).toContain('bg-gray-500')
    })

    it('should handle uppercase extensions', () => {
      expect(getExtensionColor('TS')).toContain('bg-blue-500')
      expect(getExtensionColor('JSON')).toContain('bg-orange-500')
    })

    it('should handle extensions with leading dot', () => {
      expect(getExtensionColor('.ts')).toContain('bg-blue-500')
      expect(getExtensionColor('.json')).toContain('bg-orange-500')
    })

    it('should return default for unknown extensions', () => {
      expect(getExtensionColor('xyz')).toContain('bg-gray-500')
      expect(getExtensionColor('unknown')).toContain('bg-gray-500')
    })

    it('should return default for undefined', () => {
      expect(getExtensionColor(undefined)).toContain('bg-gray-500')
    })

    it('should return default for empty string', () => {
      expect(getExtensionColor('')).toContain('bg-gray-500')
    })
  })

  describe('extractExtension', () => {
    it('should extract extension from simple path', () => {
      expect(extractExtension('file.ts')).toBe('ts')
      expect(extractExtension('file.tsx')).toBe('tsx')
    })

    it('should extract extension from path with directories', () => {
      expect(extractExtension('src/components/Button.tsx')).toBe('tsx')
      expect(extractExtension('lib/utils/helper.ts')).toBe('ts')
    })

    it('should handle files with multiple dots', () => {
      expect(extractExtension('file.test.ts')).toBe('ts')
      expect(extractExtension('component.stories.tsx')).toBe('tsx')
    })

    it('should return undefined for files without extension', () => {
      expect(extractExtension('Dockerfile')).toBeUndefined()
      expect(extractExtension('Makefile')).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      expect(extractExtension('')).toBeUndefined()
    })
  })
})
