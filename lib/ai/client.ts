import { anthropic } from '@ai-sdk/anthropic'
import { mistral } from '@ai-sdk/mistral'

// AI client configuration
// Uses Vercel AI SDK for streaming responses

export const model = anthropic('claude-sonnet-4-20250514')

// Alternative models for different use cases
export const models = {
  // Main model for chat responses (most capable)
  chat: anthropic('claude-sonnet-4-20250514'),
  // Fast model for simple tasks (title generation, etc.)
  fast: anthropic('claude-sonnet-4-20250514'),
  // Haiku model for high-volume, low-latency tasks (contextual retrieval, routing)
  haiku: anthropic('claude-3-5-haiku-20241022'),
  // Devstral model for code-specific tasks (indexation, context generation)
  // Uses Mistral's code-specialized model - faster and cheaper for code analysis
  devstral: mistral('devstral-small-2505'),
} as const

export type ModelType = keyof typeof models
