/**
 * Query Expander - Uses LLM to extract search terms from user queries
 *
 * This replaces manual keyword classification with intelligent query analysis.
 * A fast model extracts relevant terms, file patterns, and concepts to search for.
 */

import { generateObject } from 'ai'
import { z } from 'zod'
import { models } from '@/lib/ai/client'

// Schema for the expanded query
const expandedQuerySchema = z.object({
  // Core search terms extracted from the query
  keywords: z.array(z.string()).describe('Key technical terms to search for (e.g., "authentication", "JWT", "middleware")'),

  // File path patterns that might contain relevant code
  filePatterns: z.array(z.string()).describe('File path patterns to prioritize (e.g., "auth", "middleware", "api/login")'),

  // Code concepts to look for
  concepts: z.array(z.string()).describe('Code concepts like function names, class names, or patterns (e.g., "useAuth", "validateToken", "AuthProvider")'),

  // Whether this is an architecture/infrastructure question
  isArchitectureQuestion: z.boolean().describe('True if asking about how something works, storage, infrastructure, pipelines'),

  // Summary of what the user is looking for
  intent: z.string().describe('Brief summary of what code/files would answer this question'),
})

export type ExpandedQuery = z.infer<typeof expandedQuerySchema>

/**
 * Expand a user query to extract search-relevant terms
 * Uses a fast model (Haiku) to analyze the query intelligently
 */
export async function expandQuery(query: string): Promise<ExpandedQuery> {
  try {
    const result = await generateObject({
      model: models.haiku,
      schema: expandedQuerySchema,
      prompt: `Analyze this question about a codebase and extract search terms.

Question: "${query}"

Extract:
1. Keywords: Technical terms that would appear in relevant code
2. File patterns: Directory or file name patterns (without wildcards, just the key part like "auth", "api", "utils")
3. Concepts: Function names, class names, variable patterns that might be relevant
4. Is this an architecture question: Does it ask about HOW something works, WHERE something is stored, or WHAT technology is used?
5. Intent: What code would answer this question?

Be thorough - include synonyms and related terms. For example:
- "authentication" → also include "auth", "login", "session", "jwt", "token"
- "database" → also include "db", "prisma", "postgres", "storage"
- "API endpoints" → also include "route", "api", "handler"`,
    })

    return result.object
  } catch (error) {
    console.error('[QueryExpander] Error expanding query:', error)
    // Return minimal expansion on error
    return {
      keywords: query.split(/\s+/).filter(w => w.length > 3),
      filePatterns: [],
      concepts: [],
      isArchitectureQuestion: false,
      intent: query,
    }
  }
}

/**
 * Convert expanded query to SQL LIKE patterns for file path matching
 */
export function toFilePathPatterns(expanded: ExpandedQuery): string[] {
  const patterns: string[] = []

  // Add file patterns from expansion
  for (const pattern of expanded.filePatterns) {
    patterns.push(`%${pattern}%`)
  }

  // For architecture questions, add common infrastructure paths
  if (expanded.isArchitectureQuestion) {
    patterns.push('%lib/%')
    patterns.push('%api/%')
    patterns.push('%services/%')
    patterns.push('%config%')
  }

  return [...new Set(patterns)] // Dedupe
}

/**
 * Build a combined search query from the expansion
 */
export function toSearchQuery(expanded: ExpandedQuery): string {
  const parts = [
    ...expanded.keywords,
    ...expanded.concepts,
  ]
  return parts.join(' ')
}

/**
 * Get a summary of the expansion for logging
 */
export function getExpansionSummary(expanded: ExpandedQuery): string {
  return `[QueryExpander] Keywords: [${expanded.keywords.slice(0, 5).join(', ')}${expanded.keywords.length > 5 ? '...' : ''}], ` +
    `Patterns: [${expanded.filePatterns.slice(0, 3).join(', ')}${expanded.filePatterns.length > 3 ? '...' : ''}], ` +
    `Architecture: ${expanded.isArchitectureQuestion}`
}
