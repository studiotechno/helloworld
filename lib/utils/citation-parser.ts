// Citation parser for extracting file references from LLM responses
// Handles format: [path/to/file.ext:line] or [path/to/file.ext]

export interface Citation {
  path: string
  line?: number
  original: string // Original matched text for replacement
  startIndex: number
  endIndex: number
}

// Regex to match [path/to/file.ext:line] or [path/to/file.ext]
// Matches file paths with common extensions, optionally followed by :lineNumber
// Excludes common markdown patterns like [text](url) by requiring file extension
const CITATION_REGEX = /\[([^\]\s]+\.[a-zA-Z0-9]+)(?::(\d+))?\]/g

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

    // Skip if it looks like a markdown link [text](url)
    // Check if there's a ( immediately after the ]
    const afterMatch = content.slice(match.index + match[0].length)
    if (afterMatch.startsWith('(')) {
      continue
    }

    citations.push({
      path,
      line: lineStr ? parseInt(lineStr, 10) : undefined,
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
