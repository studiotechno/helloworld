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

// Hybrid Search (RRF-based fusion of vector + BM25)
export {
  hybridSearchV2,
  searchSymbols,
  searchFiles,
  analyzeSearchResults,
  toRetrievedChunks,
  type HybridSearchOptions,
  type HybridSearchResult,
  type SymbolSearchResult,
  type FileSearchResult,
} from './hybrid-search'

// Reranker (Voyage AI rerank-2.5)
export {
  rerankChunks,
  calculateRerankMetrics,
  getRerankSummary,
  type RerankOptions,
  type RerankedChunk,
} from './reranker'
