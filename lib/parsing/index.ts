/**
 * Code Parsing Module
 *
 * Exports for code chunking and file filtering functionality.
 */

// Chunking (regex-based - fallback)
export {
  chunkFile,
  detectLanguage,
  calculateFileHash,
  estimateTokens,
  type CodeChunk,
} from './chunker'

// AST-based Chunking (Tree-sitter)
export {
  chunkFileAST,
  extractSymbols,
  getChunkContext,
} from './ast-chunker'

// Tree-sitter Initialization
export {
  initTreeSitter,
  isLanguageSupported,
  SUPPORTED_LANGUAGES,
} from './tree-sitter-init'

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
