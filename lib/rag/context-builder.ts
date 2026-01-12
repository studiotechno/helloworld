/**
 * Context Builder for LLM
 *
 * Transforms retrieved code chunks into a formatted context string
 * optimized for Claude to understand and reference.
 */

import { type RetrievedChunk } from './retriever'

// Token estimation: ~4 characters per token for code
const CHARS_PER_TOKEN = 4
const DEFAULT_MAX_TOKENS = 30000 // Leave room for response

export interface ContextOptions {
  maxTokens?: number
  includeScores?: boolean
  includeMetadata?: boolean
  groupByFile?: boolean
  language?: 'en' | 'fr'
}

export interface ContextResult {
  context: string
  chunksIncluded: number
  chunksTotal: number
  estimatedTokens: number
  truncated: boolean
  files: string[]
}

/**
 * Group chunks by file path
 */
function groupChunksByFile(chunks: RetrievedChunk[]): Map<string, RetrievedChunk[]> {
  const grouped = new Map<string, RetrievedChunk[]>()

  for (const chunk of chunks) {
    const existing = grouped.get(chunk.filePath) || []
    existing.push(chunk)
    grouped.set(chunk.filePath, existing)
  }

  // Sort chunks within each file by line number
  for (const [filePath, fileChunks] of grouped) {
    fileChunks.sort((a, b) => a.startLine - b.startLine)
    grouped.set(filePath, fileChunks)
  }

  return grouped
}

/**
 * Estimate token count from character count
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Format a single chunk for display
 */
function formatChunk(
  chunk: RetrievedChunk,
  options: ContextOptions
): string {
  const lines: string[] = []

  // Header with location
  const location = `[${chunk.filePath}:${chunk.startLine}-${chunk.endLine}]`

  if (chunk.symbolName) {
    lines.push(`### ${location}`)
    lines.push(`**${chunk.chunkType}**: \`${chunk.symbolName}\``)
  } else {
    lines.push(`### ${location}`)
  }

  // Add context description if available (from Contextual Retrieval)
  if (chunk.context) {
    lines.push('')
    lines.push(`> ${chunk.context}`)
  }

  // Add score if requested
  if (options.includeScores) {
    lines.push(`_Relevance: ${(chunk.score * 100).toFixed(0)}%_`)
  }

  // Code block with language hint
  lines.push('')
  lines.push(`\`\`\`${chunk.language}`)
  lines.push(chunk.content)
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}

/**
 * Format chunks grouped by file
 */
function formatGroupedChunks(
  grouped: Map<string, RetrievedChunk[]>,
  options: ContextOptions,
  maxChars: number
): { formatted: string; includedCount: number; truncated: boolean } {
  const sections: string[] = []
  let totalChars = 0
  let includedCount = 0
  let truncated = false

  for (const [filePath, chunks] of grouped) {
    // File header
    const fileHeader = `## 📄 ${filePath}\n\n`

    // Check if we can fit the file header
    if (totalChars + fileHeader.length > maxChars) {
      truncated = true
      break
    }

    const chunkSections: string[] = [fileHeader]
    let fileChars = fileHeader.length

    for (const chunk of chunks) {
      const formattedChunk = formatChunk(chunk, options)
      const chunkChars = formattedChunk.length

      // Check if we can fit this chunk
      if (totalChars + fileChars + chunkChars > maxChars) {
        truncated = true
        break
      }

      chunkSections.push(formattedChunk)
      fileChars += chunkChars
      includedCount++
    }

    if (chunkSections.length > 1) {
      sections.push(chunkSections.join(''))
      totalChars += fileChars
    }

    if (truncated) break
  }

  return {
    formatted: sections.join('\n'),
    includedCount,
    truncated,
  }
}

/**
 * Format chunks without grouping (sequential)
 */
function formatSequentialChunks(
  chunks: RetrievedChunk[],
  options: ContextOptions,
  maxChars: number
): { formatted: string; includedCount: number; truncated: boolean } {
  const sections: string[] = []
  let totalChars = 0
  let includedCount = 0
  let truncated = false

  for (const chunk of chunks) {
    const formattedChunk = formatChunk(chunk, options)
    const chunkChars = formattedChunk.length

    if (totalChars + chunkChars > maxChars) {
      truncated = true
      break
    }

    sections.push(formattedChunk)
    totalChars += chunkChars
    includedCount++
  }

  return {
    formatted: sections.join('\n'),
    includedCount,
    truncated,
  }
}

/**
 * Build code context for LLM from retrieved chunks
 *
 * @param chunks - Retrieved code chunks from search
 * @param options - Formatting options
 * @returns Formatted context with metadata
 */
export function buildCodeContext(
  chunks: RetrievedChunk[],
  options: ContextOptions = {}
): ContextResult {
  const {
    maxTokens = DEFAULT_MAX_TOKENS,
    includeScores = false,
    includeMetadata: _includeMetadata = true,
    groupByFile = true,
    language = 'fr',
  } = options

  const maxChars = maxTokens * CHARS_PER_TOKEN

  if (chunks.length === 0) {
    return {
      context: language === 'fr'
        ? 'Aucun code pertinent trouve dans le repository.'
        : 'No relevant code found in the repository.',
      chunksIncluded: 0,
      chunksTotal: 0,
      estimatedTokens: 10,
      truncated: false,
      files: [],
    }
  }

  // Build header
  const headerLines: string[] = []

  if (language === 'fr') {
    headerLines.push('## Code source pertinent')
    headerLines.push('')
    headerLines.push(`J'ai trouve ${chunks.length} section(s) de code pertinente(s) dans le repository:`)
  } else {
    headerLines.push('## Relevant Source Code')
    headerLines.push('')
    headerLines.push(`Found ${chunks.length} relevant code section(s) in the repository:`)
  }
  headerLines.push('')

  const header = headerLines.join('\n')
  const headerChars = header.length

  // Calculate remaining space for chunks
  const footerEstimate = 200 // Reserve space for footer
  const availableChars = maxChars - headerChars - footerEstimate

  // Format chunks
  let formatted: string
  let includedCount: number
  let truncated: boolean

  if (groupByFile) {
    const grouped = groupChunksByFile(chunks)
    const result = formatGroupedChunks(grouped, { includeScores }, availableChars)
    formatted = result.formatted
    includedCount = result.includedCount
    truncated = result.truncated
  } else {
    const result = formatSequentialChunks(chunks, { includeScores }, availableChars)
    formatted = result.formatted
    includedCount = result.includedCount
    truncated = result.truncated
  }

  // Build footer
  const footerLines: string[] = []
  footerLines.push('---')

  if (truncated) {
    if (language === 'fr') {
      footerLines.push(`_Note: ${includedCount}/${chunks.length} sections affichees (limite de tokens atteinte)_`)
    } else {
      footerLines.push(`_Note: Showing ${includedCount}/${chunks.length} sections (token limit reached)_`)
    }
    footerLines.push('')
  }

  if (language === 'fr') {
    footerLines.push('Utilise ces informations pour repondre avec precision.')
    footerLines.push('Cite toujours les fichiers avec le format `[chemin:lignes]`.')
  } else {
    footerLines.push('Use this information to answer accurately.')
    footerLines.push('Always cite files using the format `[path:lines]`.')
  }

  const footer = footerLines.join('\n')

  // Combine all parts
  const context = [header, formatted, footer].join('\n')

  // Get unique files
  const files = [...new Set(chunks.slice(0, includedCount).map(c => c.filePath))]

  return {
    context,
    chunksIncluded: includedCount,
    chunksTotal: chunks.length,
    estimatedTokens: estimateTokens(context),
    truncated,
    files,
  }
}

/**
 * Build a minimal context with just file references
 *
 * Useful when token budget is very limited
 */
export function buildMinimalContext(
  chunks: RetrievedChunk[],
  options: { language?: 'en' | 'fr' } = {}
): string {
  const { language = 'fr' } = options

  if (chunks.length === 0) {
    return language === 'fr'
      ? 'Aucun code pertinent trouve.'
      : 'No relevant code found.'
  }

  const lines: string[] = []

  if (language === 'fr') {
    lines.push('## Fichiers pertinents')
    lines.push('')
  } else {
    lines.push('## Relevant Files')
    lines.push('')
  }

  // Group by file and show summary
  const grouped = groupChunksByFile(chunks)

  for (const [filePath, fileChunks] of grouped) {
    const symbols = fileChunks
      .filter(c => c.symbolName)
      .map(c => `\`${c.symbolName}\``)
      .slice(0, 5)

    const symbolStr = symbols.length > 0 ? `: ${symbols.join(', ')}` : ''
    lines.push(`- **${filePath}**${symbolStr}`)
  }

  return lines.join('\n')
}

/**
 * Build context for a specific file
 *
 * Shows all chunks from a single file in order
 */
export function buildFileContext(
  chunks: RetrievedChunk[],
  filePath: string,
  options: { language?: 'en' | 'fr' } = {}
): string {
  const { language = 'fr' } = options

  const fileChunks = chunks
    .filter(c => c.filePath === filePath)
    .sort((a, b) => a.startLine - b.startLine)

  if (fileChunks.length === 0) {
    return language === 'fr'
      ? `Aucun contenu trouve pour ${filePath}`
      : `No content found for ${filePath}`
  }

  const lines: string[] = []
  lines.push(`## 📄 ${filePath}`)
  lines.push('')

  for (const chunk of fileChunks) {
    if (chunk.symbolName) {
      lines.push(`### ${chunk.chunkType}: \`${chunk.symbolName}\` (lignes ${chunk.startLine}-${chunk.endLine})`)
    } else {
      lines.push(`### Lignes ${chunk.startLine}-${chunk.endLine}`)
    }
    lines.push('')
    lines.push(`\`\`\`${chunk.language}`)
    lines.push(chunk.content)
    lines.push('```')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format a citation reference for use in responses
 */
export function formatCitation(chunk: RetrievedChunk): string {
  return `[${chunk.filePath}:${chunk.startLine}-${chunk.endLine}]`
}

/**
 * Extract citations from chunks for storing with messages
 */
export function extractCitations(
  chunks: RetrievedChunk[]
): Array<{ file: string; startLine: number; endLine: number; symbol?: string }> {
  return chunks.map(chunk => ({
    file: chunk.filePath,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    symbol: chunk.symbolName || undefined,
  }))
}

/**
 * Build system prompt enhancement with code context
 *
 * Combines base system prompt with code context
 */
export function buildEnhancedSystemPrompt(
  basePrompt: string,
  chunks: RetrievedChunk[],
  options: ContextOptions = {}
): { prompt: string; result: ContextResult } {
  const result = buildCodeContext(chunks, options)

  const enhancedPrompt = `${basePrompt}

${result.context}`

  return {
    prompt: enhancedPrompt,
    result,
  }
}
