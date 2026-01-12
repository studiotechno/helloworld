import { describe, it, expect } from 'vitest'
import {
  parseGitignore,
  matchesGitignore,
  isInExcludedDir,
  matchesExcludedPattern,
  isBinaryFile,
  isInPriorityFolder,
  isImportantFile,
  isCodeFile,
  shouldIncludeFile,
  filterFiles,
  isEmptyRepository,
  getRepositoryStats,
  estimateTotalLines,
  FileInfo,
} from './file-filter'

describe('file-filter', () => {
  describe('parseGitignore', () => {
    it('should parse basic patterns', () => {
      const content = `
node_modules
dist
*.log
      `
      const patterns = parseGitignore(content)
      expect(patterns).toContain('node_modules')
      expect(patterns).toContain('dist')
      expect(patterns).toContain('*.log')
    })

    it('should ignore comments', () => {
      const content = `
# This is a comment
node_modules
# Another comment
dist
      `
      const patterns = parseGitignore(content)
      expect(patterns).not.toContain('# This is a comment')
      expect(patterns).toContain('node_modules')
      expect(patterns).toContain('dist')
    })

    it('should ignore empty lines', () => {
      const content = `
node_modules

dist

      `
      const patterns = parseGitignore(content)
      expect(patterns).toHaveLength(2)
    })

    it('should handle complex patterns', () => {
      const content = `
**/build/
!important.log
/root-only
**/*.temp
      `
      const patterns = parseGitignore(content)
      expect(patterns).toContain('**/build/')
      expect(patterns).toContain('!important.log')
      expect(patterns).toContain('/root-only')
      expect(patterns).toContain('**/*.temp')
    })
  })

  describe('matchesGitignore', () => {
    it('should match simple directory patterns', () => {
      const patterns = ['node_modules']
      expect(matchesGitignore('node_modules/package.json', patterns)).toBe(true)
      expect(matchesGitignore('src/node_modules/file.js', patterns)).toBe(true)
      expect(matchesGitignore('src/code.js', patterns)).toBe(false)
    })

    it('should match wildcard patterns', () => {
      const patterns = ['*.log']
      expect(matchesGitignore('error.log', patterns)).toBe(true)
      expect(matchesGitignore('logs/debug.log', patterns)).toBe(true)
      expect(matchesGitignore('file.txt', patterns)).toBe(false)
    })

    it('should match double wildcard patterns', () => {
      const patterns = ['**/assets/']
      expect(matchesGitignore('assets/image.png', patterns)).toBe(true)
      expect(matchesGitignore('src/assets/image.png', patterns)).toBe(true)
      expect(matchesGitignore('src/assetsHelper.js', patterns)).toBe(false)
    })

    it('should match root-only patterns', () => {
      const patterns = ['/dist']
      expect(matchesGitignore('dist/bundle.js', patterns)).toBe(true)
      expect(matchesGitignore('src/dist/file.js', patterns)).toBe(false)
    })

    it('should handle negation patterns (skip them)', () => {
      const patterns = ['*.log', '!important.log']
      // Negation is skipped, so important.log still won't match
      expect(matchesGitignore('error.log', patterns)).toBe(true)
      expect(matchesGitignore('important.log', patterns)).toBe(true) // Negation not implemented
    })
  })

  describe('isInExcludedDir', () => {
    it('should detect node_modules', () => {
      expect(isInExcludedDir('node_modules/react/index.js')).toBe(true)
      expect(isInExcludedDir('src/node_modules/local.js')).toBe(true)
    })

    it('should detect .git', () => {
      expect(isInExcludedDir('.git/config')).toBe(true)
      expect(isInExcludedDir('src/.git/hooks')).toBe(true)
    })

    it('should detect build directories', () => {
      expect(isInExcludedDir('dist/bundle.js')).toBe(true)
      expect(isInExcludedDir('build/output.js')).toBe(true)
      expect(isInExcludedDir('.next/server/pages.js')).toBe(true)
    })

    it('should detect cache directories', () => {
      expect(isInExcludedDir('coverage/lcov.info')).toBe(true)
      expect(isInExcludedDir('__pycache__/module.pyc')).toBe(true)
      expect(isInExcludedDir('.cache/data.json')).toBe(true)
    })

    it('should not exclude source directories', () => {
      expect(isInExcludedDir('src/index.ts')).toBe(false)
      expect(isInExcludedDir('lib/utils.ts')).toBe(false)
      expect(isInExcludedDir('app/page.tsx')).toBe(false)
    })

    it('should handle Windows-style paths', () => {
      expect(isInExcludedDir('node_modules\\react\\index.js')).toBe(true)
      expect(isInExcludedDir('src\\components\\Button.tsx')).toBe(false)
    })
  })

  describe('matchesExcludedPattern', () => {
    it('should match minified files', () => {
      expect(matchesExcludedPattern('bundle.min.js')).toBe(true)
      expect(matchesExcludedPattern('styles.min.css')).toBe(true)
    })

    it('should match lock files', () => {
      expect(matchesExcludedPattern('package-lock.json')).toBe(true)
      expect(matchesExcludedPattern('yarn.lock')).toBe(true)
      expect(matchesExcludedPattern('pnpm-lock.yaml')).toBe(true)
    })

    it('should match source maps', () => {
      expect(matchesExcludedPattern('bundle.js.map')).toBe(true)
      expect(matchesExcludedPattern('styles.css.map')).toBe(true)
    })

    it('should match generated files', () => {
      expect(matchesExcludedPattern('file.generated.ts')).toBe(true)
      expect(matchesExcludedPattern('api.generated.js')).toBe(true)
    })

    it('should not match regular source files', () => {
      expect(matchesExcludedPattern('index.ts')).toBe(false)
      expect(matchesExcludedPattern('component.tsx')).toBe(false)
      expect(matchesExcludedPattern('utils.js')).toBe(false)
    })
  })

  describe('isBinaryFile', () => {
    it('should detect image files', () => {
      expect(isBinaryFile('logo.png')).toBe(true)
      expect(isBinaryFile('photo.jpg')).toBe(true)
      expect(isBinaryFile('icon.ico')).toBe(true)
      expect(isBinaryFile('image.webp')).toBe(true)
    })

    it('should detect font files', () => {
      expect(isBinaryFile('font.woff')).toBe(true)
      expect(isBinaryFile('font.woff2')).toBe(true)
      expect(isBinaryFile('font.ttf')).toBe(true)
    })

    it('should detect archive files', () => {
      expect(isBinaryFile('archive.zip')).toBe(true)
      expect(isBinaryFile('backup.tar.gz')).toBe(true)
    })

    it('should detect compiled files', () => {
      expect(isBinaryFile('app.exe')).toBe(true)
      expect(isBinaryFile('library.dll')).toBe(true)
      expect(isBinaryFile('module.pyc')).toBe(true)
    })

    it('should not detect text/code files as binary', () => {
      expect(isBinaryFile('index.ts')).toBe(false)
      expect(isBinaryFile('styles.css')).toBe(false)
      expect(isBinaryFile('data.json')).toBe(false)
      expect(isBinaryFile('README.md')).toBe(false)
    })
  })

  describe('isInPriorityFolder', () => {
    it('should detect src folder', () => {
      expect(isInPriorityFolder('src/index.ts')).toBe(true)
      expect(isInPriorityFolder('src/components/Button.tsx')).toBe(true)
    })

    it('should detect lib folder', () => {
      expect(isInPriorityFolder('lib/utils.ts')).toBe(true)
    })

    it('should detect app folder', () => {
      expect(isInPriorityFolder('app/page.tsx')).toBe(true)
      expect(isInPriorityFolder('app/api/route.ts')).toBe(true)
    })

    it('should detect components folder', () => {
      expect(isInPriorityFolder('components/Header.tsx')).toBe(true)
    })

    it('should be case insensitive', () => {
      expect(isInPriorityFolder('SRC/index.ts')).toBe(true)
      expect(isInPriorityFolder('Lib/utils.ts')).toBe(true)
    })

    it('should not match non-priority folders', () => {
      expect(isInPriorityFolder('docs/README.md')).toBe(false)
      expect(isInPriorityFolder('tests/unit.test.ts')).toBe(false)
      expect(isInPriorityFolder('examples/demo.js')).toBe(false)
    })
  })

  describe('isImportantFile', () => {
    it('should detect package.json', () => {
      expect(isImportantFile('package.json')).toBe(true)
      expect(isImportantFile('src/package.json')).toBe(true)
    })

    it('should detect config files', () => {
      expect(isImportantFile('tsconfig.json')).toBe(true)
      expect(isImportantFile('schema.prisma')).toBe(true)
    })

    it('should detect Docker files', () => {
      expect(isImportantFile('Dockerfile')).toBe(true)
      expect(isImportantFile('docker-compose.yml')).toBe(true)
    })

    it('should not match regular files', () => {
      expect(isImportantFile('index.ts')).toBe(false)
      expect(isImportantFile('component.tsx')).toBe(false)
    })
  })

  describe('isCodeFile', () => {
    it('should detect TypeScript files', () => {
      expect(isCodeFile('index.ts')).toBe(true)
      expect(isCodeFile('component.tsx')).toBe(true)
    })

    it('should detect JavaScript files', () => {
      expect(isCodeFile('script.js')).toBe(true)
      expect(isCodeFile('component.jsx')).toBe(true)
    })

    it('should detect Python files', () => {
      expect(isCodeFile('app.py')).toBe(true)
    })

    it('should detect config files', () => {
      expect(isCodeFile('config.json')).toBe(true)
      expect(isCodeFile('settings.yaml')).toBe(true)
    })

    it('should not detect binary or unknown files', () => {
      expect(isCodeFile('image.png')).toBe(false)
      expect(isCodeFile('file.unknown')).toBe(false)
    })
  })

  describe('shouldIncludeFile', () => {
    it('should include regular source files', () => {
      expect(shouldIncludeFile('src/index.ts')).toBe(true)
      expect(shouldIncludeFile('lib/utils.js')).toBe(true)
      expect(shouldIncludeFile('app/page.tsx')).toBe(true)
    })

    it('should exclude node_modules', () => {
      expect(shouldIncludeFile('node_modules/react/index.js')).toBe(false)
    })

    it('should exclude binary files', () => {
      expect(shouldIncludeFile('assets/logo.png')).toBe(false)
      expect(shouldIncludeFile('fonts/arial.woff2')).toBe(false)
    })

    it('should exclude lock files', () => {
      expect(shouldIncludeFile('package-lock.json')).toBe(false)
      expect(shouldIncludeFile('yarn.lock')).toBe(false)
    })

    it('should respect gitignore patterns', () => {
      const patterns = ['*.log', 'temp/']
      expect(shouldIncludeFile('error.log', patterns)).toBe(false)
      expect(shouldIncludeFile('temp/cache.js', patterns)).toBe(false)
      expect(shouldIncludeFile('src/index.ts', patterns)).toBe(true)
    })

    it('should allow disabling gitignore', () => {
      const patterns = ['experiments/']
      // With gitignore respected, experiments/ files are excluded by gitignore pattern
      expect(shouldIncludeFile('experiments/test.ts', patterns, { respectGitignore: true })).toBe(false)
      // With gitignore disabled, experiments/ files are included (if they're code files)
      expect(shouldIncludeFile('experiments/test.ts', patterns, { respectGitignore: false })).toBe(true)
    })
  })

  describe('estimateTotalLines', () => {
    it('should estimate lines from file sizes', () => {
      const files: FileInfo[] = [
        { path: 'file1.ts', size: 4000 },  // ~100 lines
        { path: 'file2.ts', size: 8000 },  // ~200 lines
      ]
      const lines = estimateTotalLines(files)
      expect(lines).toBeGreaterThan(200)
      expect(lines).toBeLessThan(400)
    })

    it('should return 0 for empty array', () => {
      expect(estimateTotalLines([])).toBe(0)
    })
  })

  describe('filterFiles', () => {
    const createFiles = (paths: string[]): FileInfo[] =>
      paths.map(path => ({ path, size: 1000 }))

    it('should filter out excluded files', () => {
      const files = createFiles([
        'src/index.ts',
        'node_modules/react/index.js',
        'dist/bundle.js',
        'lib/utils.ts',
      ])

      const result = filterFiles(files)

      expect(result.included.map(f => f.path)).toContain('src/index.ts')
      expect(result.included.map(f => f.path)).toContain('lib/utils.ts')
      expect(result.excluded.map(f => f.path)).toContain('node_modules/react/index.js')
      expect(result.excluded.map(f => f.path)).toContain('dist/bundle.js')
    })

    it('should respect gitignore content', () => {
      const files = createFiles([
        'src/index.ts',
        'temp/cache.ts',
        'logs/error.log',
      ])

      const result = filterFiles(files, {
        gitignoreContent: 'temp/\n*.log',
      })

      expect(result.included.map(f => f.path)).toContain('src/index.ts')
      expect(result.excluded.map(f => f.path)).toContain('temp/cache.ts')
    })

    it('should detect empty repository', () => {
      const files = createFiles([
        'node_modules/react/index.js',
        'dist/bundle.js',
        '.git/config',
      ])

      const result = filterFiles(files)

      expect(result.isEmpty).toBe(true)
      expect(result.included).toHaveLength(0)
      expect(result.warnings).toContain('No indexable code files found in repository')
    })

    it('should prioritize files for large repositories', () => {
      // Create a "large" repo with files in priority and non-priority folders
      const priorityFiles = Array.from({ length: 100 }, (_, i) =>
        `src/file${i}.ts`
      )
      const nonPriorityFiles = Array.from({ length: 100 }, (_, i) =>
        `docs/file${i}.md`
      )

      const files = createFiles([...priorityFiles, ...nonPriorityFiles])
        .map(f => ({ ...f, size: 25000 })) // ~625 lines each = 125k total lines

      const result = filterFiles(files, { maxTotalLines: 50000 })

      expect(result.isPrioritized).toBe(true)
      expect(result.warnings.some(w => w.includes('large'))).toBe(true)
      // Should only include priority folder files
      expect(result.included.every(f => f.path.startsWith('src/'))).toBe(true)
    })

    it('should always include important files', () => {
      const files = createFiles([
        'package.json',
        'tsconfig.json',
        'schema.prisma',
        'docs/readme.md',
      ])

      const result = filterFiles(files)

      expect(result.included.map(f => f.path)).toContain('package.json')
      expect(result.included.map(f => f.path)).toContain('tsconfig.json')
      expect(result.included.map(f => f.path)).toContain('schema.prisma')
    })

    it('should return correct statistics', () => {
      const files = createFiles([
        'src/index.ts',
        'src/utils.ts',
        'node_modules/pkg/index.js',
      ])

      const result = filterFiles(files)

      expect(result.totalFiles).toBe(3)
      expect(result.totalSize).toBe(3000)
      expect(result.includedSize).toBe(2000)
    })
  })

  describe('isEmptyRepository', () => {
    it('should detect empty repository', () => {
      const files: FileInfo[] = [
        { path: 'node_modules/react/index.js', size: 1000 },
        { path: '.git/config', size: 500 },
      ]
      expect(isEmptyRepository(files)).toBe(true)
    })

    it('should detect repository with code', () => {
      const files: FileInfo[] = [
        { path: 'src/index.ts', size: 1000 },
        { path: 'node_modules/react/index.js', size: 1000 },
      ]
      expect(isEmptyRepository(files)).toBe(false)
    })

    it('should detect truly empty repository', () => {
      expect(isEmptyRepository([])).toBe(true)
    })
  })

  describe('getRepositoryStats', () => {
    it('should return correct statistics', () => {
      const files: FileInfo[] = [
        { path: 'src/index.ts', size: 4000 },
        { path: 'src/utils.ts', size: 4000 },
        { path: 'node_modules/pkg/index.js', size: 10000 },
        { path: 'logo.png', size: 50000 },
      ]

      const stats = getRepositoryStats(files)

      expect(stats.totalFiles).toBe(4)
      expect(stats.codeFiles).toBe(2) // Only src files (node_modules excluded)
      expect(stats.estimatedLines).toBeGreaterThan(0)
      expect(stats.isLarge).toBe(false) // 8000 chars / 40 = 200 lines
    })

    it('should detect large repository', () => {
      // Create files totaling ~60k lines (2.4M chars / 40)
      const files: FileInfo[] = Array.from({ length: 100 }, (_, i) => ({
        path: `src/file${i}.ts`,
        size: 24000, // ~600 lines each
      }))

      const stats = getRepositoryStats(files)

      expect(stats.isLarge).toBe(true)
      expect(stats.estimatedLines).toBeGreaterThan(50000)
    })
  })
})
