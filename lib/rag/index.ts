/**
 * RAG (Retrieval Augmented Generation) Module
 *
 * Exports for code retrieval and context building.
 */

// Retriever
export {
  retrieveRelevantChunks,
  vectorSearch,
  textSearch,
  smartSearch,
  searchByFile,
  searchBySymbol,
  searchByType,
  getRepositoryContext,
  type RetrievedChunk,
  type SearchOptions,
  type SearchMode,
} from './retriever'

// Smart Retrieval (combines metadata + vector search)
export {
  smartRetrieve,
  getRetrievalSummary,
  type SmartRetrievalOptions,
  type SmartRetrievalResult,
} from './smart-retrieval'

// Query Classifier
export {
  classifyQuery,
  getMetadataFilter,
  getQueryTypeLabel,
  type QueryType,
} from './query-classifier'

// Context Builder
export {
  buildCodeContext,
  buildMinimalContext,
  buildFileContext,
  formatCitation,
  extractCitations,
  buildEnhancedSystemPrompt,
  type ContextOptions,
  type ContextResult,
} from './context-builder'
