/**
 * Code Parsing Module
 *
 * Exports for code chunking and file filtering functionality.
 */

// Chunking
export {
  chunkFile,
  detectLanguage,
  calculateFileHash,
  estimateTokens,
  type CodeChunk,
} from './chunker'

// File Filtering
export {
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
  type FileInfo,
  type FilterResult,
  type FilterOptions,
} from './file-filter'
