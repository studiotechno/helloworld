import { anthropic } from '@ai-sdk/anthropic'

// Anthropic Claude client configuration
// Uses Vercel AI SDK for streaming responses

export const model = anthropic('claude-sonnet-4-20250514')

// Alternative models for different use cases
export const models = {
  // Main model for chat responses
  chat: anthropic('claude-sonnet-4-20250514'),
  // Fast model for simple tasks (title generation, etc.)
  fast: anthropic('claude-sonnet-4-20250514'),
} as const
