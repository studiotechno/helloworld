/**
 * File Filtering & Prioritization for Code Indexation
 *
 * Filters files based on:
 * - .gitignore patterns
 * - Default exclusions (node_modules, .git, etc.)
 * - Binary file detection
 * - Priority folders for large repos
 */

import { detectLanguage } from './chunker'

export interface FileInfo {
  path: string
  size: number
}

export interface FilterResult {
  included: FileInfo[]
  excluded: FileInfo[]
  totalFiles: number
  totalSize: number
  includedSize: number
  isPrioritized: boolean
  isEmpty: boolean
  warnings: string[]
}

export interface FilterOptions {
  maxTotalLines?: number
  gitignoreContent?: string
  respectGitignore?: boolean
}

// Default directories to always exclude
const DEFAULT_EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'venv',
  '.venv',
  'env',
  '.env',
  'vendor',
  'target', // Rust
  'Pods', // iOS
  '.gradle',
  '.idea',
  '.vscode',
  '.DS_Store',
  'tmp',
  'temp',
  'logs',
  'log',
  '.cache',
  '.parcel-cache',
  '.turbo',
  'storybook-static',
]

// Default file patterns to exclude
const DEFAULT_EXCLUDED_PATTERNS = [
  /\.min\.(js|css)$/,
  /\.bundle\.(js|css)$/,
  /\.map$/,
  /\.lock$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /composer\.lock$/,
  /Gemfile\.lock$/,
  /Cargo\.lock$/,
  /\.d\.ts$/, // Type declaration files (often generated)
  /\.generated\./,
  /\.snap$/, // Jest snapshots
]

// Binary file extensions to exclude
const BINARY_EXTENSIONS = new Set([
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg', 'avif',
  // Fonts
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  // Documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  // Archives
  'zip', 'tar', 'gz', 'rar', '7z', 'bz2',
  // Audio/Video
  'mp3', 'mp4', 'wav', 'ogg', 'webm', 'avi', 'mov', 'flv',
  // Compiled
  'exe', 'dll', 'so', 'dylib', 'class', 'pyc', 'pyo', 'o', 'obj',
  // Database
  'db', 'sqlite', 'sqlite3',
  // Other binary
  'bin', 'dat', 'dump',
])

// Priority folders to index first (and exclusively for large repos)
const PRIORITY_FOLDERS = [
  'src',
  'lib',
  'app',
  'pages',
  'components',
  'api',
  'server',
  'client',
  'core',
  'modules',
  'packages',
  'services',
  'utils',
  'helpers',
  'hooks',
  'contexts',
  'providers',
  'middleware',
  'routes',
  'controllers',
  'models',
  'schemas',
  'types',
  'interfaces',
  'config',
  'scripts',
]

// Files that are always important regardless of location
const IMPORTANT_FILES = [
  'package.json',
  'tsconfig.json',
  'schema.prisma',
  '.env.example',
  'README.md',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
]

// Threshold for "large" repository (lines)
const LARGE_REPO_THRESHOLD = 50000
// Average chars per line estimate
const AVG_CHARS_PER_LINE = 40

/**
 * Parse .gitignore content into patterns
 */
export function parseGitignore(content: string): string[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
}

/**
 * Convert a gitignore pattern to a RegExp
 */
function gitignorePatternToRegex(pattern: string): RegExp {
  // Handle negation (we'll skip negated patterns for simplicity)
  if (pattern.startsWith('!')) {
    return new RegExp('^$') // Never match
  }

  // Check if pattern is rooted (starts with /)
  const isRooted = pattern.startsWith('/')
  let cleanPattern = isRooted ? pattern.slice(1) : pattern

  // Check if pattern starts with **/ (matches at any depth including root)
  const startsWithDoubleWildcard = cleanPattern.startsWith('**/')
  if (startsWithDoubleWildcard) {
    cleanPattern = cleanPattern.slice(3) // Remove **/
  }

  // Check if pattern ends with /
  const isDirectory = cleanPattern.endsWith('/')
  if (isDirectory) {
    cleanPattern = cleanPattern.slice(0, -1)
  }

  let regex = cleanPattern
    // Escape special regex chars except * and ?
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // Convert gitignore wildcards to regex
    .replace(/\*\*/g, '___DOUBLE_STAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___DOUBLE_STAR___/g, '.*')
    .replace(/\?/g, '[^/]')

  // Build final regex based on pattern type
  if (startsWithDoubleWildcard) {
    // **/ means match at any level including root
    regex = '(?:^|.*/)' + regex
  } else if (isRooted) {
    // Pattern starts at root
    regex = '^' + regex
  } else {
    // Pattern can match anywhere in path (at start or after /)
    regex = '(?:^|/)' + regex
  }

  // Directory patterns match the directory and anything inside
  if (isDirectory) {
    regex += '(?:/|$)'
  } else {
    // Non-directory patterns match end of path or followed by /
    regex += '(?:/|$)'
  }

  return new RegExp(regex)
}

/**
 * Check if a file path matches any gitignore patterns
 */
export function matchesGitignore(filePath: string, patterns: string[]): boolean {
  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/')

  for (const pattern of patterns) {
    if (pattern.startsWith('!')) continue // Skip negation patterns

    try {
      const regex = gitignorePatternToRegex(pattern)
      if (regex.test(normalizedPath)) {
        return true
      }
    } catch {
      // Invalid pattern, skip
      continue
    }
  }

  return false
}

/**
 * Check if a file is in a default excluded directory
 */
export function isInExcludedDir(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const parts = normalizedPath.split('/')

  for (const part of parts) {
    if (DEFAULT_EXCLUDED_DIRS.includes(part)) {
      return true
    }
  }

  return false
}

/**
 * Check if a file matches default excluded patterns
 */
export function matchesExcludedPattern(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/')

  for (const pattern of DEFAULT_EXCLUDED_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return true
    }
  }

  return false
}

/**
 * Check if a file is binary based on extension
 */
export function isBinaryFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return BINARY_EXTENSIONS.has(ext)
}

/**
 * Check if a file is in a priority folder
 */
export function isInPriorityFolder(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const parts = normalizedPath.split('/')

  for (const part of parts) {
    if (PRIORITY_FOLDERS.includes(part.toLowerCase())) {
      return true
    }
  }

  return false
}

/**
 * Check if a file is an important root file
 */
export function isImportantFile(filePath: string): boolean {
  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || ''
  return IMPORTANT_FILES.includes(fileName)
}

/**
 * Check if a file is a code file that should be indexed
 */
export function isCodeFile(filePath: string): boolean {
  const language = detectLanguage(filePath)
  // Text files without a recognized language are usually not code
  const codeLanguages = [
    'typescript', 'javascript', 'python', 'go', 'rust', 'java',
    'kotlin', 'swift', 'ruby', 'php', 'csharp', 'cpp', 'c',
    'vue', 'svelte', 'prisma', 'sql', 'json', 'yaml', 'shell',
    'markdown', 'dart'
  ]
  return codeLanguages.includes(language)
}

/**
 * Estimate total lines in repository from file sizes
 */
export function estimateTotalLines(files: FileInfo[]): number {
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  return Math.ceil(totalSize / AVG_CHARS_PER_LINE)
}

/**
 * Filter a single file - returns true if file should be included
 */
export function shouldIncludeFile(
  filePath: string,
  gitignorePatterns: string[] = [],
  options: { respectGitignore?: boolean } = {}
): boolean {
  const { respectGitignore = true } = options

  // Always exclude binary files
  if (isBinaryFile(filePath)) {
    return false
  }

  // Always exclude files in default excluded directories
  if (isInExcludedDir(filePath)) {
    return false
  }

  // Always exclude files matching default patterns
  if (matchesExcludedPattern(filePath)) {
    return false
  }

  // Check gitignore if enabled
  if (respectGitignore && gitignorePatterns.length > 0) {
    if (matchesGitignore(filePath, gitignorePatterns)) {
      return false
    }
  }

  // Only include code files
  if (!isCodeFile(filePath)) {
    return false
  }

  return true
}

/**
 * Main filter function - filters and prioritizes files for indexation
 */
export function filterFiles(
  files: FileInfo[],
  options: FilterOptions = {}
): FilterResult {
  const {
    maxTotalLines = LARGE_REPO_THRESHOLD,
    gitignoreContent = '',
    respectGitignore = true,
  } = options

  const gitignorePatterns = gitignoreContent ? parseGitignore(gitignoreContent) : []
  const warnings: string[] = []

  const included: FileInfo[] = []
  const excluded: FileInfo[] = []

  // First pass: apply basic filtering
  for (const file of files) {
    if (shouldIncludeFile(file.path, gitignorePatterns, { respectGitignore })) {
      included.push(file)
    } else {
      excluded.push(file)
    }
  }

  // Check if repository is empty or minimal
  if (included.length === 0) {
    return {
      included: [],
      excluded,
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      includedSize: 0,
      isPrioritized: false,
      isEmpty: true,
      warnings: ['No indexable code files found in repository'],
    }
  }

  // Estimate total lines
  const estimatedLines = estimateTotalLines(included)
  const isLarge = estimatedLines > maxTotalLines

  // If repo is large, prioritize important folders
  let finalIncluded = included
  let isPrioritized = false

  if (isLarge) {
    isPrioritized = true
    warnings.push(
      `Repository is large (~${Math.round(estimatedLines / 1000)}k lines). ` +
      `Only priority folders will be indexed: ${PRIORITY_FOLDERS.slice(0, 5).join(', ')}, etc.`
    )

    // Filter to only priority folders and important files
    const priorityFiles = included.filter(
      f => isInPriorityFolder(f.path) || isImportantFile(f.path)
    )

    // If we still have too many files, sort by priority and take top ones
    if (estimateTotalLines(priorityFiles) > maxTotalLines) {
      // Sort: important files first, then by folder priority
      priorityFiles.sort((a, b) => {
        const aImportant = isImportantFile(a.path) ? 0 : 1
        const bImportant = isImportantFile(b.path) ? 0 : 1
        return aImportant - bImportant
      })

      // Take files until we reach the limit
      let accumulatedLines = 0
      finalIncluded = []

      for (const file of priorityFiles) {
        const fileLines = Math.ceil(file.size / AVG_CHARS_PER_LINE)
        if (accumulatedLines + fileLines <= maxTotalLines) {
          finalIncluded.push(file)
          accumulatedLines += fileLines
        }
      }

      warnings.push(
        `Indexed ${finalIncluded.length} of ${included.length} files due to size limit.`
      )
    } else {
      finalIncluded = priorityFiles
    }

    // Add remaining files to excluded
    const includedPaths = new Set(finalIncluded.map(f => f.path))
    for (const file of included) {
      if (!includedPaths.has(file.path)) {
        excluded.push(file)
      }
    }
  }

  return {
    included: finalIncluded,
    excluded,
    totalFiles: files.length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    includedSize: finalIncluded.reduce((sum, f) => sum + f.size, 0),
    isPrioritized,
    isEmpty: false,
    warnings,
  }
}

/**
 * Quick check if a repository appears to be empty/minimal
 */
export function isEmptyRepository(files: FileInfo[]): boolean {
  // Filter to just code files
  const codeFiles = files.filter(f => isCodeFile(f.path) && !isInExcludedDir(f.path))
  return codeFiles.length === 0
}

/**
 * Get repository statistics before filtering
 */
export function getRepositoryStats(files: FileInfo[]): {
  totalFiles: number
  estimatedLines: number
  isLarge: boolean
  codeFiles: number
} {
  const codeFiles = files.filter(f => isCodeFile(f.path) && !isInExcludedDir(f.path))
  const estimatedLines = estimateTotalLines(codeFiles)

  return {
    totalFiles: files.length,
    estimatedLines,
    isLarge: estimatedLines > LARGE_REPO_THRESHOLD,
    codeFiles: codeFiles.length,
  }
}
