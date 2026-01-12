export {
  embedCode,
  embedQuery,
  cosineSimilarity,
  getEmbeddingDimensions,
  getModelName,
  VoyageClientError,
} from './voyage-client'

export {
  rerankDocuments,
  rerankAndSelect,
  getAvailableRerankModels,
  getDefaultRerankModel,
  VoyageRerankError,
  type RerankModel,
  type RerankOptions,
  type RerankResult,
  type RerankResponse,
} from './voyage-rerank'
