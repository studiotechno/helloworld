/**
 * Tree-sitter Initialization Module
 *
 * Initializes the Tree-sitter parser and loads language grammars.
 * WASM files are loaded from the tree-sitter-wasms npm package.
 */

import Parser from 'web-tree-sitter'
import path from 'path'
import fs from 'fs'

// Type aliases for 0.20.x API
type Language = Parser.Language
type Tree = Parser.Tree

// Singleton parser instance
let parser: Parser | null = null
let isInitialized = false

// Loaded language grammars
const languages: Map<string, Language> = new Map()

// Map from our language names to grammar file names
const LANGUAGE_TO_GRAMMAR: Record<string, string> = {
  typescript: 'tree-sitter-typescript',
  tsx: 'tree-sitter-tsx',
  javascript: 'tree-sitter-javascript',
  python: 'tree-sitter-python',
  go: 'tree-sitter-go',
  rust: 'tree-sitter-rust',
  java: 'tree-sitter-java',
  c: 'tree-sitter-c',
  cpp: 'tree-sitter-cpp',
  csharp: 'tree-sitter-c_sharp',
  ruby: 'tree-sitter-ruby',
  php: 'tree-sitter-php',
  kotlin: 'tree-sitter-kotlin',
  swift: 'tree-sitter-swift',
  bash: 'tree-sitter-bash',
  shell: 'tree-sitter-bash',
  json: 'tree-sitter-json',
  html: 'tree-sitter-html',
  css: 'tree-sitter-css',
}

// Languages that are supported by Tree-sitter
export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_TO_GRAMMAR)

/**
 * Get the path to a grammar WASM file
 */
function getGrammarPath(grammarName: string): string {
  // Try node_modules path first (for server-side)
  const nodeModulesPath = path.join(
    process.cwd(),
    'node_modules',
    'tree-sitter-wasms',
    'out',
    `${grammarName}.wasm`
  )

  if (fs.existsSync(nodeModulesPath)) {
    return nodeModulesPath
  }

  // Fallback to local grammars directory
  const localPath = path.join(
    process.cwd(),
    'lib',
    'parsing',
    'grammars',
    `${grammarName}.wasm`
  )

  if (fs.existsSync(localPath)) {
    return localPath
  }

  throw new Error(`Grammar not found: ${grammarName}`)
}

/**
 * Initialize Tree-sitter parser
 * Must be called before using any parsing functions
 */
export async function initTreeSitter(): Promise<void> {
  if (isInitialized) {
    return
  }

  // Get the path to the tree-sitter.wasm file
  const wasmDir = path.join(process.cwd(), 'node_modules', 'web-tree-sitter')

  // Initialize the Parser with the WASM file location
  await Parser.init({
    locateFile: (scriptName: string) => {
      // Return the full path to the WASM file in node_modules
      return path.join(wasmDir, scriptName)
    },
  })

  parser = new Parser()
  isInitialized = true

  console.log('[Tree-sitter] Initialized parser')
}

/**
 * Load a specific language grammar
 * Grammars are loaded lazily on first use
 */
export async function loadLanguage(language: string): Promise<Language | null> {
  // Check if already loaded
  if (languages.has(language)) {
    return languages.get(language)!
  }

  // Check if language is supported
  const grammarName = LANGUAGE_TO_GRAMMAR[language]
  if (!grammarName) {
    console.warn(`[Tree-sitter] Unsupported language: ${language}`)
    return null
  }

  // Ensure parser is initialized
  if (!isInitialized) {
    await initTreeSitter()
  }

  try {
    const grammarPath = getGrammarPath(grammarName)
    const lang = await Parser.Language.load(grammarPath)
    languages.set(language, lang)
    console.log(`[Tree-sitter] Loaded grammar: ${language}`)
    return lang
  } catch (error) {
    console.error(`[Tree-sitter] Failed to load grammar for ${language}:`, error)
    return null
  }
}

/**
 * Get the parser instance
 * Throws if not initialized
 */
export function getParser(): Parser {
  if (!parser) {
    throw new Error('Tree-sitter not initialized. Call initTreeSitter() first.')
  }
  return parser
}

/**
 * Get a loaded language grammar
 * Returns null if language not loaded or not supported
 */
export function getLanguage(language: string): Language | undefined {
  return languages.get(language)
}

/**
 * Check if a language is supported by Tree-sitter
 */
export function isLanguageSupported(language: string): boolean {
  return language in LANGUAGE_TO_GRAMMAR
}

/**
 * Parse code with Tree-sitter
 * Automatically loads the language grammar if not already loaded
 */
export async function parseCode(
  code: string,
  language: string
): Promise<Tree | null> {
  // Ensure parser is initialized
  if (!isInitialized) {
    await initTreeSitter()
  }

  // Load language if needed
  const lang = await loadLanguage(language)
  if (!lang) {
    return null
  }

  // Set language and parse
  parser!.setLanguage(lang)
  return parser!.parse(code)
}

/**
 * Cleanup Tree-sitter resources
 */
export function cleanupTreeSitter(): void {
  if (parser) {
    parser.delete()
    parser = null
  }
  languages.clear()
  isInitialized = false
}
