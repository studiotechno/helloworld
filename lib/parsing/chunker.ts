/**
 * Code Chunking Engine
 *
 * Splits code files into semantic chunks for embedding.
 * Uses pattern-based detection for functions, classes, interfaces.
 * Falls back to fixed-size chunking when semantic units aren't detected.
 */

import crypto from 'crypto'

export interface CodeChunk {
  content: string
  file_path: string
  start_line: number
  end_line: number
  language: string
  chunk_type: 'function' | 'class' | 'interface' | 'type' | 'config' | 'import' | 'other'
  symbol_name?: string
  dependencies: string[]
}

// Maximum chunk size in characters (roughly 500 tokens)
const MAX_CHUNK_SIZE = 2000
// Minimum chunk size to avoid tiny chunks (lowered for small but meaningful units)
const MIN_CHUNK_SIZE = 50
// Overlap between chunks for context preservation
const OVERLAP_SIZE = 100

/**
 * Language detection based on file extension
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    rb: 'ruby',
    php: 'php',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    vue: 'vue',
    svelte: 'svelte',
    prisma: 'prisma',
    sql: 'sql',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    mdx: 'markdown',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
  }

  return languageMap[ext] || 'text'
}

/**
 * Extract import/dependency statements from code
 */
function extractDependencies(content: string, language: string): string[] {
  const deps: string[] = []

  // TypeScript/JavaScript imports
  if (['typescript', 'javascript'].includes(language)) {
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g

    let match
    while ((match = importRegex.exec(content)) !== null) {
      deps.push(match[1])
    }
    while ((match = requireRegex.exec(content)) !== null) {
      deps.push(match[1])
    }
  }

  // Python imports
  if (language === 'python') {
    const importRegex = /(?:from\s+(\S+)\s+)?import\s+(\S+)/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      deps.push(match[1] || match[2])
    }
  }

  // Go imports
  if (language === 'go') {
    const importRegex = /import\s+(?:\(\s*)?["']([^"']+)["']/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      deps.push(match[1])
    }
  }

  return [...new Set(deps)]
}

/**
 * Patterns for detecting semantic code units
 */
const SEMANTIC_PATTERNS: Record<string, Array<{ type: CodeChunk['chunk_type']; pattern: RegExp }>> = {
  typescript: [
    { type: 'function', pattern: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/m },
    { type: 'function', pattern: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/m },
    { type: 'function', pattern: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*\w+)?\s*=>/m },
    { type: 'class', pattern: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/m },
    { type: 'interface', pattern: /^(?:export\s+)?interface\s+(\w+)/m },
    { type: 'type', pattern: /^(?:export\s+)?type\s+(\w+)/m },
  ],
  javascript: [
    { type: 'function', pattern: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/m },
    { type: 'function', pattern: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/m },
    { type: 'function', pattern: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/m },
    { type: 'class', pattern: /^(?:export\s+)?class\s+(\w+)/m },
  ],
  python: [
    { type: 'function', pattern: /^(?:async\s+)?def\s+(\w+)/m },
    { type: 'class', pattern: /^class\s+(\w+)/m },
  ],
  go: [
    { type: 'function', pattern: /^func\s+(?:\([^)]+\)\s*)?(\w+)/m },
    { type: 'type', pattern: /^type\s+(\w+)\s+struct/m },
    { type: 'interface', pattern: /^type\s+(\w+)\s+interface/m },
  ],
  rust: [
    { type: 'function', pattern: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/m },
    { type: 'type', pattern: /^(?:pub\s+)?struct\s+(\w+)/m },
    { type: 'type', pattern: /^(?:pub\s+)?enum\s+(\w+)/m },
    { type: 'interface', pattern: /^(?:pub\s+)?trait\s+(\w+)/m },
  ],
  java: [
    { type: 'function', pattern: /^(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/m },
    { type: 'class', pattern: /^(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/m },
    { type: 'interface', pattern: /^(?:public\s+)?interface\s+(\w+)/m },
  ],
}

/**
 * Find the end of a code block (matching braces/indentation)
 */
function findBlockEnd(lines: string[], startLine: number, language: string): number {
  // For brace-based languages
  if (['typescript', 'javascript', 'java', 'go', 'rust', 'csharp', 'cpp', 'c'].includes(language)) {
    let braceCount = 0
    let foundOpen = false

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i]

      for (const char of line) {
        if (char === '{') {
          braceCount++
          foundOpen = true
        } else if (char === '}') {
          braceCount--
          if (foundOpen && braceCount === 0) {
            return i
          }
        }
      }
    }
  }

  // For indentation-based languages (Python)
  if (language === 'python') {
    const startIndent = lines[startLine].match(/^(\s*)/)?.[1].length || 0

    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim() === '') continue

      const currentIndent = line.match(/^(\s*)/)?.[1].length || 0
      if (currentIndent <= startIndent && line.trim() !== '') {
        return i - 1
      }
    }
  }

  // Default: return a reasonable block size
  return Math.min(startLine + 50, lines.length - 1)
}

/**
 * Extract semantic chunks from code
 */
function extractSemanticChunks(
  content: string,
  filePath: string,
  language: string
): CodeChunk[] {
  const chunks: CodeChunk[] = []
  const lines = content.split('\n')
  const patterns = SEMANTIC_PATTERNS[language] || []
  const usedLines = new Set<number>()

  // Extract all dependencies from the full file first
  const fileDependencies = extractDependencies(content, language)

  // Find all semantic units
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue

    const lineContent = lines[i]

    for (const { type, pattern } of patterns) {
      const match = lineContent.match(pattern)
      if (match) {
        const symbolName = match[1]
        const endLine = findBlockEnd(lines, i, language)
        const chunkLines = lines.slice(i, endLine + 1)
        const chunkContent = chunkLines.join('\n')

        // Skip if too small
        if (chunkContent.length < MIN_CHUNK_SIZE) continue

        // Mark lines as used
        for (let j = i; j <= endLine; j++) {
          usedLines.add(j)
        }

        // Get chunk-specific dependencies, or fall back to file dependencies
        const chunkDeps = extractDependencies(chunkContent, language)
        const dependencies = chunkDeps.length > 0 ? chunkDeps : fileDependencies

        chunks.push({
          content: chunkContent,
          file_path: filePath,
          start_line: i + 1, // 1-indexed
          end_line: endLine + 1,
          language,
          chunk_type: type,
          symbol_name: symbolName,
          dependencies,
        })

        break
      }
    }
  }

  return chunks
}

/**
 * Split remaining content into fixed-size chunks
 */
function splitIntoFixedChunks(
  content: string,
  filePath: string,
  language: string,
  startLine: number
): CodeChunk[] {
  const chunks: CodeChunk[] = []
  const lines = content.split('\n')

  let currentChunk: string[] = []
  let currentStartLine = startLine
  let currentSize = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineSize = line.length + 1 // +1 for newline

    if (currentSize + lineSize > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      // Save current chunk
      const chunkContent = currentChunk.join('\n')
      if (chunkContent.length >= MIN_CHUNK_SIZE) {
        chunks.push({
          content: chunkContent,
          file_path: filePath,
          start_line: currentStartLine,
          end_line: currentStartLine + currentChunk.length - 1,
          language,
          chunk_type: 'other',
          dependencies: extractDependencies(chunkContent, language),
        })
      }

      // Start new chunk with overlap
      const overlapLines = Math.floor(OVERLAP_SIZE / 40) // ~40 chars per line
      currentChunk = currentChunk.slice(-overlapLines)
      currentStartLine = currentStartLine + currentChunk.length - overlapLines
      currentSize = currentChunk.join('\n').length
    }

    currentChunk.push(line)
    currentSize += lineSize
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    const chunkContent = currentChunk.join('\n')
    if (chunkContent.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        content: chunkContent,
        file_path: filePath,
        start_line: currentStartLine,
        end_line: currentStartLine + currentChunk.length - 1,
        language,
        chunk_type: 'other',
        dependencies: extractDependencies(chunkContent, language),
      })
    }
  }

  return chunks
}

/**
 * Handle special config files
 */
function chunkConfigFile(
  content: string,
  filePath: string,
  language: string
): CodeChunk[] {
  const fileName = filePath.split('/').pop() || ''

  // For Prisma schema, chunk by model
  if (fileName === 'schema.prisma' || language === 'prisma') {
    const chunks: CodeChunk[] = []
    const modelRegex = /^model\s+(\w+)\s*\{[\s\S]*?^\}/gm
    let match

    while ((match = modelRegex.exec(content)) !== null) {
      const startLine = content.slice(0, match.index).split('\n').length
      const endLine = startLine + match[0].split('\n').length - 1

      chunks.push({
        content: match[0],
        file_path: filePath,
        start_line: startLine,
        end_line: endLine,
        language: 'prisma',
        chunk_type: 'type',
        symbol_name: match[1],
        dependencies: [],
      })
    }

    // If we found models, return them
    if (chunks.length > 0) return chunks
  }

  // For package.json, return as single chunk
  if (fileName === 'package.json') {
    return [{
      content: content,
      file_path: filePath,
      start_line: 1,
      end_line: content.split('\n').length,
      language: 'json',
      chunk_type: 'config',
      symbol_name: 'package.json',
      dependencies: [],
    }]
  }

  // For other config files, return as single chunk if small enough
  if (content.length <= MAX_CHUNK_SIZE) {
    return [{
      content: content,
      file_path: filePath,
      start_line: 1,
      end_line: content.split('\n').length,
      language,
      chunk_type: 'config',
      dependencies: [],
    }]
  }

  // Fall back to fixed-size chunking
  return splitIntoFixedChunks(content, filePath, language, 1)
}

/**
 * Main chunking function - splits a file into semantic chunks
 */
export function chunkFile(content: string, filePath: string): CodeChunk[] {
  if (!content || content.trim().length === 0) {
    return []
  }

  const language = detectLanguage(filePath)
  const fileName = filePath.split('/').pop() || ''

  // Handle config files specially
  const configFiles = ['package.json', 'tsconfig.json', 'schema.prisma', '.env.example']
  if (configFiles.includes(fileName) || language === 'json' || language === 'yaml') {
    return chunkConfigFile(content, filePath, language)
  }

  // Try semantic chunking first
  const semanticChunks = extractSemanticChunks(content, filePath, language)

  // If we got good semantic chunks, return them
  if (semanticChunks.length > 0) {
    return semanticChunks
  }

  // Fall back to fixed-size chunking
  return splitIntoFixedChunks(content, filePath, language, 1)
}

/**
 * Calculate file hash for change detection
 */
export function calculateFileHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for code
  return Math.ceil(text.length / 4)
}
