// Citation parser for extracting file references from LLM responses
// Handles formats:
// - [path/to/file.ext]
// - [path/to/file.ext:line]
// - [path/to/file.ext:startLine-endLine]

export interface Citation {
  path: string
  line?: number
  endLine?: number
  original: string // Original matched text for replacement
  startIndex: number
  endIndex: number
}

// Regex to match file path citations
// [path/to/file.ext] or [path/to/file.ext:line] or [path/to/file.ext:start-end]
// Requires:
// - Path containing at least one slash (/) to avoid matching simple words
// - File extension (.ts, .tsx, .js, etc.)
// - Optional line number or line range
// Note: Includes () for Next.js route groups like (auth), (dashboard)
const CITATION_REGEX = /\[([a-zA-Z0-9_\-./()]+\/[a-zA-Z0-9_\-./()]+\.[a-zA-Z0-9]+)(?::(\d+)(?:-(\d+))?)?\]/g

/**
 * Parse citations from content string
 * @param content - Text content that may contain citations
 * @returns Array of Citation objects with path, line, and position info
 */
export function parseCitations(content: string): Citation[] {
  const citations: Citation[] = []

  // Reset regex state for fresh parsing
  CITATION_REGEX.lastIndex = 0

  let match
  while ((match = CITATION_REGEX.exec(content)) !== null) {
    const path = match[1]
    const lineStr = match[2]
    const endLineStr = match[3]

    // Skip if it looks like a markdown link [text](url)
    // Check if there's a ( immediately after the ]
    const afterMatch = content.slice(match.index + match[0].length)
    if (afterMatch.startsWith('(')) {
      continue
    }

    citations.push({
      path,
      line: lineStr ? parseInt(lineStr, 10) : undefined,
      endLine: endLineStr ? parseInt(endLineStr, 10) : undefined,
      original: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  return citations
}

/**
 * Split content into segments with citation markers
 * Useful for rendering content with embedded CodeCitation components
 * @param content - Text content that may contain citations
 * @returns Array of segments, either text strings or Citation objects
 */
export function splitContentByCitations(
  content: string
): Array<string | Citation> {
  const citations = parseCitations(content)

  if (citations.length === 0) {
    return [content]
  }

  const segments: Array<string | Citation> = []
  let lastIndex = 0

  for (const citation of citations) {
    // Add text before citation
    if (citation.startIndex > lastIndex) {
      segments.push(content.slice(lastIndex, citation.startIndex))
    }

    // Add citation object
    segments.push(citation)
    lastIndex = citation.endIndex
  }

  // Add remaining text after last citation
  if (lastIndex < content.length) {
    segments.push(content.slice(lastIndex))
  }

  return segments
}

/**
 * Check if a segment is a Citation object
 */
export function isCitation(segment: string | Citation): segment is Citation {
  return typeof segment === 'object' && 'path' in segment
}
