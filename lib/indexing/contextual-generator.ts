/**
 * Contextual Generator for Code Chunks
 *
 * Implements Anthropic's Contextual Retrieval technique:
 * https://www.anthropic.com/news/contextual-retrieval
 *
 * Uses Claude Haiku to generate brief contextual descriptions for each code chunk
 * that explain what the chunk does in the context of the file and codebase.
 *
 * This context is prepended to the chunk content before embedding, which
 * significantly improves retrieval quality for ambiguous queries.
 */

import { generateText } from 'ai'
import { models } from '../ai/client'

// Maximum tokens for context generation (keep it brief)
const MAX_CONTEXT_TOKENS = 150

// Rate limiting for Mistral API (much more generous than Anthropic)
const BATCH_SIZE = 10 // Process chunks in parallel batches
const BATCH_DELAY_MS = 500 // Small delay between batches

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
 * System prompt for context generation
 */
const CONTEXT_SYSTEM_PROMPT = `You are a code documentation assistant. Given a code chunk and its surrounding file context, generate a brief (1-2 sentences) description of what this code does and its role in the file.

Rules:
- Be specific about what the code does, not generic
- Mention the function/class name if provided
- Include relevant implementation details that would help find this code
- Focus on the "what" and "why", not the "how"
- Keep it under 50 words
- Do not use markdown formatting
- Start directly with the description (no "This code..." or "The function...")
- Use present tense`

/**
 * Generate context for a single chunk
 */
export async function generateChunkContext(
  chunk: ChunkForContext,
  fileContext?: FileContext
): Promise<string> {
  // Build the prompt
  let prompt = `File: ${chunk.filePath}\n`
  prompt += `Lines: ${chunk.startLine}-${chunk.endLine}\n`
  prompt += `Type: ${chunk.chunkType}\n`

  if (chunk.symbolName) {
    prompt += `Name: ${chunk.symbolName}\n`
  }

  // Include file context if available (truncated to avoid token limits)
  if (fileContext?.fullContent) {
    const maxFileContextChars = 2000
    const truncatedContext =
      fileContext.fullContent.length > maxFileContextChars
        ? fileContext.fullContent.substring(0, maxFileContextChars) + '\n... (truncated)'
        : fileContext.fullContent
    prompt += `\nFull file context:\n\`\`\`${chunk.language}\n${truncatedContext}\n\`\`\`\n`
  }

  prompt += `\nCode chunk to describe:\n\`\`\`${chunk.language}\n${chunk.content}\n\`\`\`\n`
  prompt += `\nGenerate a brief description:`

  const maxRetries = 5

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { text } = await generateText({
        model: models.devstral,
        system: CONTEXT_SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: MAX_CONTEXT_TOKENS,
        temperature: 0, // Deterministic output
      })

      return text.trim()
    } catch (error: unknown) {
      // Check for rate limit error
      const isRateLimit = error instanceof Error &&
        (error.message.includes('rate_limit') ||
         error.message.includes('429') ||
         (error as { statusCode?: number }).statusCode === 429)

      if (isRateLimit && attempt < maxRetries - 1) {
        // Extract retry-after from error if available, default to 15 seconds
        const retryAfter = 15000
        console.log(`[ContextualGenerator] Rate limited, waiting ${retryAfter / 1000}s before retry ${attempt + 1}/${maxRetries}`)
        await new Promise((resolve) => setTimeout(resolve, retryAfter))
        continue
      }

      console.error('[ContextualGenerator] Error generating context:', error)
      // Return empty string on error - context is optional
      return ''
    }
  }

  return ''
}

/**
 * Generate contexts for multiple chunks in batch
 *
 * Processes chunks in parallel batches with rate limiting
 */
export async function generateContextsBatch(
  chunks: ChunkForContext[],
  fileContext?: FileContext,
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> {
  const results: string[] = new Array(chunks.length).fill('')

  // Process in batches
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map((chunk) => generateChunkContext(chunk, fileContext))
    )

    // Store results
    batchResults.forEach((context, idx) => {
      results[i + idx] = context
    })

    // Report progress
    const completed = Math.min(i + BATCH_SIZE, chunks.length)
    onProgress?.(completed, chunks.length)

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  return results
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
 * Based on Claude Haiku pricing:
 * - Input: $0.25 / 1M tokens
 * - Output: $1.25 / 1M tokens
 */
export function estimateContextGenerationCost(
  chunks: ChunkForContext[],
  avgFileContextChars = 1500
): {
  inputTokens: number
  outputTokens: number
  estimatedCostUSD: number
} {
  // Rough token estimates
  const avgChunkTokens = 200 // Average chunk size
  const systemPromptTokens = 150 // System prompt
  const fileContextTokens = Math.ceil(avgFileContextChars / 4) // ~4 chars per token
  const outputTokens = 50 // Target output size

  const inputTokensPerChunk = systemPromptTokens + avgChunkTokens + fileContextTokens
  const totalInputTokens = inputTokensPerChunk * chunks.length
  const totalOutputTokens = outputTokens * chunks.length

  // Haiku pricing
  const inputCostPer1M = 0.25
  const outputCostPer1M = 1.25

  const inputCost = (totalInputTokens / 1_000_000) * inputCostPer1M
  const outputCost = (totalOutputTokens / 1_000_000) * outputCostPer1M

  return {
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    estimatedCostUSD: inputCost + outputCost,
  }
}
