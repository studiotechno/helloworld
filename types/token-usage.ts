/**
 * Token Usage Types
 *
 * Centralized types for token usage tracking across the application.
 */

/** Types of token usage */
export type TokenUsageType = 'chat' | 'indexing_context' | 'indexing_embedding'

/** AI models tracked for usage */
export type TokenUsageModel = 'haiku' | 'sonnet' | 'devstral' | 'voyage-code-3'

/** Summary of input/output tokens */
export interface TokenSummary {
  input_tokens: number
  output_tokens: number
}

/** Usage breakdown by model */
export interface UsageByModel {
  [model: string]: {
    input: number
    output: number
  }
}

/** API response for token usage endpoint */
export interface TokenUsageResponse {
  /** Total tokens across all usage types */
  total: TokenSummary
  /** Tokens used for chat */
  chat: TokenSummary
  /** Tokens used for indexing (context + embedding) */
  indexing: TokenSummary
  /** Breakdown by AI model */
  by_model: UsageByModel
  /** Period covered (for future use) */
  period?: {
    start: string
    end: string
  }
}

/** Error response structure */
export interface TokenUsageError {
  error: {
    code: string
    message: string
  }
}
