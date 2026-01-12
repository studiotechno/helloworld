/**
 * AI Module
 *
 * Exports for AI/LLM functionality.
 */

// Client configuration
export { model, models, type ModelType } from './client'

// Model Router
export {
  routeQuery,
  adjustForContext,
  getModelForQuery,
  estimateRoutingSavings,
  logRouting,
  type QueryAnalysis,
  type RoutingOptions,
} from './model-router'
