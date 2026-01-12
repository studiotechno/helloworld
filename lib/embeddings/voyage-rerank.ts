/**
 * Voyage AI Rerank Client
 *
 * Uses rerank-2.5 model for semantic re-ranking of search results.
 * Improves retrieval quality by re-scoring documents based on relevance.
 */

const VOYAGE_RERANK_URL = 'https://api.voyageai.com/v1/rerank'
const DEFAULT_MODEL = 'rerank-2.5'
const MAX_RETRIES = 5
const RETRY_DELAY_MS = 1000
const RATE_LIMIT_BASE_DELAY_MS = 2000

export type RerankModel = 'rerank-2.5' | 'rerank-2.5-lite'

export interface RerankOptions {
  /** Rerank model to use (default: rerank-2.5) */
  model?: RerankModel
  /** Number of top results to return (default: all) */
  topK?: number
  /** Whether to truncate documents that exceed token limit (default: true) */
  truncation?: boolean
}

export interface RerankResult {
  /** Original index in the input documents array */
  index: number
  /** Relevance score (higher = more relevant) */
  relevanceScore: number
  /** The document content (if returnDocuments is true) */
  document?: string
}

export interface RerankResponse {
  results: RerankResult[]
  /** Total tokens used */
  totalTokens: number
}

interface VoyageRerankResultItem {
  index: number
  relevance_score: number
  document?: string
}

interface VoyageRerankResponse {
  object: 'list'
  data: VoyageRerankResultItem[]
  model: string
  usage: {
    total_tokens: number
  }
}

interface VoyageError {
  error: {
    message: string
    type: string
    code?: string
  }
}

export class VoyageRerankError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly type?: string
  ) {
    super(message)
    this.name = 'VoyageRerankError'
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Get Voyage API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new VoyageRerankError(
      'VOYAGE_API_KEY environment variable is not set',
      undefined,
      'configuration_error'
    )
  }
  return apiKey
}

/**
 * Make a single rerank API request
 */
async function makeRerankRequest(
  query: string,
  documents: string[],
  options: RerankOptions = {}
): Promise<VoyageRerankResponse> {
  const apiKey = getApiKey()
  const { model = DEFAULT_MODEL, topK, truncation = true } = options

  const body: Record<string, unknown> = {
    query,
    documents,
    model,
    truncation,
  }

  if (topK !== undefined) {
    body.top_k = topK
  }

  const response = await fetch(VOYAGE_RERANK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as VoyageError
    const errorMessage =
      errorData.error?.message || `Voyage AI rerank error: ${response.statusText}`
    throw new VoyageRerankError(
      errorMessage,
      response.status,
      errorData.error?.type
    )
  }

  return response.json() as Promise<VoyageRerankResponse>
}

/**
 * Make rerank request with retry logic
 */
async function makeRerankRequestWithRetry(
  query: string,
  documents: string[],
  options: RerankOptions = {},
  retries = MAX_RETRIES
): Promise<VoyageRerankResponse> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await makeRerankRequest(query, documents, options)
    } catch (error) {
      lastError = error as Error

      // Don't retry on auth errors, validation errors, or config errors
      if (error instanceof VoyageRerankError) {
        if (
          error.statusCode === 401 ||
          error.statusCode === 400 ||
          error.type === 'configuration_error'
        ) {
          throw error
        }
        // Rate limit - use exponential backoff
        if (error.statusCode === 429) {
          const delay = RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, attempt)
          console.log(
            `[Voyage Rerank] Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${retries}`
          )
          await sleep(delay)
          continue
        }
      }

      // Retry on other errors with linear backoff
      if (attempt < retries - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
      }
    }
  }

  throw lastError || new VoyageRerankError('Unknown error after retries')
}

/**
 * Rerank documents based on relevance to a query
 *
 * Uses Voyage AI's rerank-2.5 model to score and reorder documents
 * by their semantic relevance to the query.
 *
 * @param query - The search query
 * @param documents - Array of document strings to rerank
 * @param options - Rerank options (model, topK, truncation)
 * @returns Array of results with original index and relevance score, sorted by score descending
 *
 * @example
 * ```typescript
 * const results = await rerankDocuments(
 *   'How does authentication work?',
 *   ['Auth module handles login...', 'Database schema...', 'JWT token validation...'],
 *   { topK: 5 }
 * )
 * // results[0] = { index: 2, relevanceScore: 0.95 } // JWT token was most relevant
 * ```
 */
export async function rerankDocuments(
  query: string,
  documents: string[],
  options: RerankOptions = {}
): Promise<RerankResponse> {
  if (!query.trim()) {
    throw new VoyageRerankError('Query cannot be empty', 400, 'validation_error')
  }

  if (documents.length === 0) {
    return { results: [], totalTokens: 0 }
  }

  // Filter out empty documents and track their indices
  const validDocuments: { doc: string; originalIndex: number }[] = []
  for (let i = 0; i < documents.length; i++) {
    if (documents[i].trim().length > 0) {
      validDocuments.push({ doc: documents[i], originalIndex: i })
    }
  }

  if (validDocuments.length === 0) {
    return { results: [], totalTokens: 0 }
  }

  const response = await makeRerankRequestWithRetry(
    query,
    validDocuments.map((v) => v.doc),
    options
  )

  // Map back to original indices
  const results: RerankResult[] = response.data.map((item) => ({
    index: validDocuments[item.index].originalIndex,
    relevanceScore: item.relevance_score,
    document: item.document,
  }))

  return {
    results,
    totalTokens: response.usage.total_tokens,
  }
}

/**
 * Rerank and return top K documents with their content
 *
 * Convenience function that returns the reranked documents
 * along with their scores.
 *
 * @param query - The search query
 * @param documents - Array of document strings to rerank
 * @param topK - Number of top results to return (default: 10)
 * @param options - Additional rerank options
 * @returns Array of { document, relevanceScore } sorted by score descending
 */
export async function rerankAndSelect<T extends { content: string }>(
  query: string,
  items: T[],
  topK = 10,
  options: Omit<RerankOptions, 'topK'> = {}
): Promise<{ item: T; relevanceScore: number }[]> {
  if (items.length === 0) {
    return []
  }

  const documents = items.map((item) => item.content)
  const response = await rerankDocuments(query, documents, { ...options, topK })

  return response.results.map((result) => ({
    item: items[result.index],
    relevanceScore: result.relevanceScore,
  }))
}

/**
 * Get available rerank models
 */
export function getAvailableRerankModels(): RerankModel[] {
  return ['rerank-2.5', 'rerank-2.5-lite']
}

/**
 * Get the default rerank model
 */
export function getDefaultRerankModel(): RerankModel {
  return DEFAULT_MODEL
}
