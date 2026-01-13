/**
 * Contextual Generator for Code Chunks
 *
 * Implements Anthropic's Contextual Retrieval technique:
 * https://www.anthropic.com/news/contextual-retrieval
 *
 * Uses Devstral to generate brief contextual descriptions for each code chunk
 * that explain what the chunk does in the context of the file and codebase.
 *
 * OPTIMIZED: Batches multiple chunks into a single LLM request to minimize
 * API calls and avoid rate limits.
 */

import { generateText } from 'ai'
import { models } from '../ai/client'

// Maximum tokens for context generation
const MAX_OUTPUT_TOKENS = 2000 // Increased for batch responses

// Batching configuration for Mistral Scale (6 req/sec = 360 req/min)
// Ultra-fast indexation with Devstral code-specialized model
const CHUNKS_PER_REQUEST = 15 // Number of chunks to describe in one LLM call
const REQUEST_DELAY_MS = 200 // 200ms between requests (5 req/sec, safe margin for 6 req/sec limit)

export interface ChunkForContext {
  content: string
  filePath: string
  startLine: number
  endLine: number
  chunkType: string
  symbolName?: string | null
  language: string
}

export interface FileContext {
  /** Full file content for context */
  fullContent: string
  /** File path */
  filePath: string
  /** Repository name */
  repoName?: string
}

/**
 * System prompt for batch context generation
 */
const BATCH_CONTEXT_SYSTEM_PROMPT = `You are a code documentation assistant. You will receive multiple code chunks and must generate a brief description for each one.

Rules for each description:
- Be specific about what the code does, not generic
- Mention the function/class name if provided
- Include relevant implementation details that would help find this code
- Focus on the "what" and "why", not the "how"
- Keep each description under 40 words
- Do not use markdown formatting
- Start directly with the description (no "This code..." or "The function...")
- Use present tense

IMPORTANT: Return a JSON array with descriptions in the same order as the input chunks.
Example response format:
["Description for chunk 1", "Description for chunk 2", "Description for chunk 3"]`

/**
 * Generate contexts for multiple chunks in a single LLM request
 */
async function generateBatchContexts(
  chunks: ChunkForContext[]
): Promise<string[]> {
  if (chunks.length === 0) return []

  // Build the prompt with all chunks
  let prompt = `Generate brief descriptions for these ${chunks.length} code chunks:\n\n`

  chunks.forEach((chunk, index) => {
    prompt += `--- CHUNK ${index + 1} ---\n`
    prompt += `File: ${chunk.filePath}\n`
    prompt += `Lines: ${chunk.startLine}-${chunk.endLine}\n`
    prompt += `Type: ${chunk.chunkType}\n`
    if (chunk.symbolName) {
      prompt += `Name: ${chunk.symbolName}\n`
    }
    prompt += `\`\`\`${chunk.language}\n${chunk.content}\n\`\`\`\n\n`
  })

  prompt += `Return a JSON array with ${chunks.length} descriptions, one for each chunk in order.`

  const maxRetries = 3

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { text } = await generateText({
        model: models.devstral,
        system: BATCH_CONTEXT_SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0,
      })

      // Parse the JSON response
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.warn('[ContextualGenerator] Could not find JSON array in response, retrying...')
        continue
      }

      const descriptions = JSON.parse(jsonMatch[0]) as string[]

      // Validate we got the right number of descriptions
      if (descriptions.length !== chunks.length) {
        console.warn(
          `[ContextualGenerator] Got ${descriptions.length} descriptions for ${chunks.length} chunks, padding/truncating...`
        )
        // Pad with empty strings or truncate
        while (descriptions.length < chunks.length) {
          descriptions.push('')
        }
        return descriptions.slice(0, chunks.length)
      }

      return descriptions
    } catch (error: unknown) {
      const isRateLimit =
        error instanceof Error &&
        (error.message.includes('rate_limit') ||
          error.message.includes('Rate limit') ||
          error.message.includes('429') ||
          (error as { statusCode?: number }).statusCode === 429)

      if (isRateLimit && attempt < maxRetries - 1) {
        const retryDelay = 10000 // 10 seconds for rate limit
        console.log(
          `[ContextualGenerator] Rate limited, waiting ${retryDelay / 1000}s before retry ${attempt + 1}/${maxRetries}`
        )
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        continue
      }

      const isJsonError = error instanceof SyntaxError
      if (isJsonError && attempt < maxRetries - 1) {
        console.warn('[ContextualGenerator] JSON parse error, retrying...')
        continue
      }

      console.error('[ContextualGenerator] Error generating batch context:', error)
      // Return empty strings for all chunks on error
      return new Array(chunks.length).fill('')
    }
  }

  return new Array(chunks.length).fill('')
}

/**
 * Generate contexts for all chunks using batched requests
 *
 * Processes chunks in batches of CHUNKS_PER_REQUEST to minimize API calls
 */
export async function generateContextsBatch(
  chunks: ChunkForContext[],
  _fileContext?: FileContext, // Reserved for future use
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> {
  const results: string[] = new Array(chunks.length).fill('')

  // Process in batches
  for (let i = 0; i < chunks.length; i += CHUNKS_PER_REQUEST) {
    const batch = chunks.slice(i, i + CHUNKS_PER_REQUEST)

    // Generate contexts for this batch in a single request
    const batchResults = await generateBatchContexts(batch)

    // Store results
    batchResults.forEach((context, idx) => {
      results[i + idx] = context
    })

    // Report progress
    const completed = Math.min(i + CHUNKS_PER_REQUEST, chunks.length)
    onProgress?.(completed, chunks.length)

    // Delay between batches to respect rate limit
    if (i + CHUNKS_PER_REQUEST < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
    }
  }

  return results
}

/**
 * Generate context for a single chunk (legacy function, uses batch internally)
 */
export async function generateChunkContext(
  chunk: ChunkForContext,
  _fileContext?: FileContext
): Promise<string> {
  const results = await generateBatchContexts([chunk])
  return results[0] || ''
}

/**
 * Build a content string with context prepended
 *
 * This is used before embedding to improve retrieval quality
 */
export function buildContextualContent(
  content: string,
  context: string | null | undefined
): string {
  if (!context || context.trim().length === 0) {
    return content
  }

  return `${context}\n\n${content}`
}

/**
 * Estimate the cost of generating contexts
 *
 * Based on Mistral Devstral pricing (much cheaper than Claude)
 */
export function estimateContextGenerationCost(
  chunks: ChunkForContext[],
  avgFileContextChars = 1500
): {
  inputTokens: number
  outputTokens: number
  estimatedCostUSD: number
  estimatedRequests: number
  estimatedTimeSeconds: number
} {
  const numRequests = Math.ceil(chunks.length / CHUNKS_PER_REQUEST)

  // Rough token estimates per batch
  const avgChunkTokens = 200
  const systemPromptTokens = 200
  const outputTokensPerChunk = 50

  const inputTokensPerBatch = systemPromptTokens + avgChunkTokens * CHUNKS_PER_REQUEST
  const outputTokensPerBatch = outputTokensPerChunk * CHUNKS_PER_REQUEST

  const totalInputTokens = inputTokensPerBatch * numRequests
  const totalOutputTokens = outputTokensPerBatch * numRequests

  // Devstral pricing (approximate)
  const inputCostPer1M = 0.1
  const outputCostPer1M = 0.3

  const inputCost = (totalInputTokens / 1_000_000) * inputCostPer1M
  const outputCost = (totalOutputTokens / 1_000_000) * outputCostPer1M

  // Time estimate based on rate limiting
  const estimatedTimeSeconds = numRequests * (REQUEST_DELAY_MS / 1000)

  return {
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    estimatedCostUSD: inputCost + outputCost,
    estimatedRequests: numRequests,
    estimatedTimeSeconds,
  }
}
