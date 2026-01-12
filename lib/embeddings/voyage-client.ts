/**
 * Voyage AI Client for Code Embeddings
 *
 * Uses voyage-code-3 model optimized for code search and retrieval.
 * Supports batch processing with rate limiting and retry logic.
 */

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const MODEL = 'voyage-code-3'
const MAX_BATCH_SIZE = 128 // Voyage AI limit per request
const MAX_RETRIES = 5 // More retries for rate limiting
const RETRY_DELAY_MS = 1000
const RATE_LIMIT_BASE_DELAY_MS = 2000 // Base delay for rate limit errors

interface VoyageEmbeddingData {
  object: 'embedding'
  embedding: number[]
  index: number
}

interface VoyageResponse {
  object: 'list'
  data: VoyageEmbeddingData[]
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

export class VoyageClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly type?: string
  ) {
    super(message)
    this.name = 'VoyageClientError'
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
    throw new VoyageClientError(
      'VOYAGE_API_KEY environment variable is not set',
      undefined,
      'configuration_error'
    )
  }
  return apiKey
}

/**
 * Make a single API request to Voyage AI
 */
async function makeRequest(
  input: string[],
  inputType: 'document' | 'query'
): Promise<VoyageResponse> {
  const apiKey = getApiKey()

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input,
      model: MODEL,
      input_type: inputType,
    }),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as VoyageError
    const errorMessage =
      errorData.error?.message || `Voyage AI error: ${response.statusText}`
    throw new VoyageClientError(
      errorMessage,
      response.status,
      errorData.error?.type
    )
  }

  return response.json() as Promise<VoyageResponse>
}

/**
 * Make request with retry logic
 */
async function makeRequestWithRetry(
  input: string[],
  inputType: 'document' | 'query',
  retries = MAX_RETRIES
): Promise<VoyageResponse> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await makeRequest(input, inputType)
    } catch (error) {
      lastError = error as Error

      // Don't retry on auth errors, validation errors, or config errors
      if (error instanceof VoyageClientError) {
        if (error.statusCode === 401 || error.statusCode === 400 || error.type === 'configuration_error') {
          throw error
        }
        // Rate limit - use exponential backoff (2s, 4s, 8s, 16s, 32s)
        if (error.statusCode === 429) {
          const delay = RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, attempt)
          console.log(`[Voyage] Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${retries}`)
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

  throw lastError || new VoyageClientError('Unknown error after retries')
}

/**
 * Embed code chunks for storage/indexing
 *
 * @param chunks - Array of code strings to embed
 * @returns Array of embedding vectors (1024 dimensions each)
 */
export async function embedCode(chunks: string[]): Promise<number[][]> {
  if (chunks.length === 0) {
    return []
  }

  const results: number[][] = []

  // Process in batches
  for (let i = 0; i < chunks.length; i += MAX_BATCH_SIZE) {
    const batch = chunks.slice(i, i + MAX_BATCH_SIZE)

    // Filter out empty strings
    const validBatch = batch.filter((chunk) => chunk.trim().length > 0)
    if (validBatch.length === 0) {
      // Add zero vectors for empty chunks
      results.push(...batch.map(() => new Array(1024).fill(0)))
      continue
    }

    const response = await makeRequestWithRetry(validBatch, 'document')

    // Map embeddings back, handling filtered empty strings
    let validIndex = 0
    for (const chunk of batch) {
      if (chunk.trim().length > 0) {
        results.push(response.data[validIndex].embedding)
        validIndex++
      } else {
        results.push(new Array(1024).fill(0))
      }
    }
  }

  return results
}

/**
 * Embed a query for similarity search
 *
 * @param query - The search query string
 * @returns Embedding vector (1024 dimensions)
 */
export async function embedQuery(query: string): Promise<number[]> {
  if (!query.trim()) {
    throw new VoyageClientError('Query cannot be empty', 400, 'validation_error')
  }

  const response = await makeRequestWithRetry([query], 'query')
  return response.data[0].embedding
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) return 0

  return dotProduct / magnitude
}

/**
 * Get embedding dimensions for the model
 */
export function getEmbeddingDimensions(): number {
  return 1024 // voyage-code-3 uses 1024 dimensions
}

/**
 * Get the model name being used
 */
export function getModelName(): string {
  return MODEL
}
