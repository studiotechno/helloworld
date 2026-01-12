/**
 * Model Router for Cost Optimization
 *
 * Routes queries to the appropriate Claude model based on complexity:
 * - Simple questions → Claude Haiku (faster, cheaper)
 * - Complex reasoning → Claude Sonnet (more capable)
 *
 * This optimizes cost (~80% cheaper for simple queries) while
 * maintaining quality for complex tasks.
 */

import { models, type ModelType } from './client'

export interface QueryAnalysis {
  /** Detected complexity level */
  complexity: 'simple' | 'moderate' | 'complex'
  /** Recommended model */
  model: ModelType
  /** Reasoning for the choice */
  reason: string
  /** Confidence in the routing decision (0-1) */
  confidence: number
}

export interface RoutingOptions {
  /** Force a specific model (bypass routing) */
  forceModel?: ModelType
  /** Minimum context size (tokens) to trigger Sonnet */
  contextThreshold?: number
  /** Always use Sonnet for code generation tasks */
  preferSonnetForCode?: boolean
}

// Keywords that indicate simple queries (factual, lookup)
const SIMPLE_KEYWORDS = [
  'what is',
  "what's",
  'where is',
  "where's",
  'who is',
  "who's",
  'how many',
  'list',
  'show me',
  'find',
  'get',
  'return',
  'define',
  'explain briefly',
]

// Keywords that indicate complex queries (reasoning, generation)
const COMPLEX_KEYWORDS = [
  'implement',
  'create',
  'build',
  'design',
  'architect',
  'refactor',
  'optimize',
  'debug',
  'fix',
  'why',
  'compare',
  'analyze',
  'review',
  'improve',
  'migrate',
  'convert',
  'suggest',
  'recommend',
  'best practice',
  'how should',
  'help me',
]

// Code-related patterns that benefit from Sonnet
const CODE_GENERATION_PATTERNS = [
  /^write (a |an |the |some )?(new )?(function|class|method|component|service|module|script|code)/i,
  /^add (a |an |the |some )?(new )?(function|method|class|component)/i,
  /^create (a |an |the |some )?(new )?(function|class|component|service|module|type|interface)/i,
  /^implement (a |an |the |some )?/i,
  /^generate (a |an |the |some )?(new )?/i,
  /^build (a |an |the |some )?(new )?/i,
]

/**
 * Analyze query complexity and route to appropriate model
 */
export function routeQuery(
  query: string,
  options: RoutingOptions = {}
): QueryAnalysis {
  const {
    forceModel,
    contextThreshold = 5000,
    preferSonnetForCode = true,
  } = options

  // If model is forced, return immediately
  if (forceModel) {
    return {
      complexity: 'moderate',
      model: forceModel,
      reason: 'Model forced by option',
      confidence: 1.0,
    }
  }

  const queryLower = query.toLowerCase().trim()
  const wordCount = query.split(/\s+/).length

  // Check for code generation patterns
  if (preferSonnetForCode) {
    for (const pattern of CODE_GENERATION_PATTERNS) {
      if (pattern.test(query)) {
        return {
          complexity: 'complex',
          model: 'chat', // Sonnet
          reason: 'Code generation task detected',
          confidence: 0.9,
        }
      }
    }
  }

  // Check for complex keywords
  for (const keyword of COMPLEX_KEYWORDS) {
    if (queryLower.includes(keyword)) {
      return {
        complexity: 'complex',
        model: 'chat', // Sonnet
        reason: `Complex keyword detected: "${keyword}"`,
        confidence: 0.85,
      }
    }
  }

  // Check for simple keywords
  for (const keyword of SIMPLE_KEYWORDS) {
    if (queryLower.startsWith(keyword) || queryLower.includes(` ${keyword}`)) {
      // Short simple queries → Haiku
      if (wordCount < 20) {
        return {
          complexity: 'simple',
          model: 'haiku',
          reason: `Simple lookup query: "${keyword}"`,
          confidence: 0.8,
        }
      }
    }
  }

  // Very short queries are likely simple
  if (wordCount < 8) {
    return {
      complexity: 'simple',
      model: 'haiku',
      reason: 'Short query (likely simple)',
      confidence: 0.7,
    }
  }

  // Very long queries suggest complexity
  if (wordCount > 50) {
    return {
      complexity: 'complex',
      model: 'chat', // Sonnet
      reason: 'Long query (likely complex)',
      confidence: 0.75,
    }
  }

  // Default to moderate → Sonnet for safety
  return {
    complexity: 'moderate',
    model: 'chat', // Sonnet
    reason: 'Default to Sonnet for quality',
    confidence: 0.6,
  }
}

/**
 * Adjust routing based on context size
 *
 * Large contexts benefit from Sonnet's larger context window
 * and better reasoning over long documents.
 */
export function adjustForContext(
  analysis: QueryAnalysis,
  contextTokens: number,
  threshold = 5000
): QueryAnalysis {
  // Large context → prefer Sonnet
  if (contextTokens > threshold && analysis.model === 'haiku') {
    return {
      ...analysis,
      model: 'chat', // Sonnet
      reason: `Upgraded to Sonnet: large context (${contextTokens} tokens)`,
      confidence: analysis.confidence * 0.9,
    }
  }

  return analysis
}

/**
 * Get the actual model instance for the routing decision
 */
export function getModelForQuery(
  query: string,
  contextTokens = 0,
  options: RoutingOptions = {}
) {
  let analysis = routeQuery(query, options)

  // Adjust based on context size
  if (contextTokens > 0) {
    analysis = adjustForContext(analysis, contextTokens, options.contextThreshold)
  }

  return {
    model: models[analysis.model],
    analysis,
  }
}

/**
 * Estimate cost savings from routing
 *
 * Based on Anthropic pricing (as of early 2025):
 * - Sonnet: $3/$15 per 1M input/output tokens
 * - Haiku: $0.25/$1.25 per 1M input/output tokens
 *
 * Haiku is ~12x cheaper for input, ~12x cheaper for output
 */
export function estimateRoutingSavings(
  queries: Array<{ query: string; contextTokens?: number; outputTokens?: number }>
): {
  totalQueries: number
  haikuQueries: number
  sonnetQueries: number
  estimatedSavingsPercent: number
} {
  let haikuQueries = 0
  let sonnetQueries = 0
  let haikuInputTokens = 0
  let haikuOutputTokens = 0
  let sonnetInputTokens = 0
  let sonnetOutputTokens = 0

  for (const q of queries) {
    const analysis = routeQuery(q.query)
    const inputTokens = (q.contextTokens || 500) + 100 // estimate query tokens
    const outputTokens = q.outputTokens || 500

    if (analysis.model === 'haiku') {
      haikuQueries++
      haikuInputTokens += inputTokens
      haikuOutputTokens += outputTokens
    } else {
      sonnetQueries++
      sonnetInputTokens += inputTokens
      sonnetOutputTokens += outputTokens
    }
  }

  // Calculate costs
  const sonnetInputCost = 3 / 1_000_000
  const sonnetOutputCost = 15 / 1_000_000
  const haikuInputCost = 0.25 / 1_000_000
  const haikuOutputCost = 1.25 / 1_000_000

  const actualCost =
    haikuInputTokens * haikuInputCost +
    haikuOutputTokens * haikuOutputCost +
    sonnetInputTokens * sonnetInputCost +
    sonnetOutputTokens * sonnetOutputCost

  const allSonnetCost =
    (haikuInputTokens + sonnetInputTokens) * sonnetInputCost +
    (haikuOutputTokens + sonnetOutputTokens) * sonnetOutputCost

  const savings = allSonnetCost > 0 ? ((allSonnetCost - actualCost) / allSonnetCost) * 100 : 0

  return {
    totalQueries: queries.length,
    haikuQueries,
    sonnetQueries,
    estimatedSavingsPercent: Math.round(savings),
  }
}

/**
 * Log routing decision for monitoring
 */
export function logRouting(analysis: QueryAnalysis, queryPreview: string): void {
  const preview = queryPreview.length > 50 ? queryPreview.substring(0, 50) + '...' : queryPreview
  console.log(
    `[ModelRouter] ${analysis.model.toUpperCase()} (${analysis.complexity}, ${(analysis.confidence * 100).toFixed(0)}%): "${preview}" - ${analysis.reason}`
  )
}
