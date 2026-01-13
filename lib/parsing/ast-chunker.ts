/**
 * AST-Based Code Chunker
 *
 * Uses Tree-sitter for accurate AST-based code chunking.
 * Extracts semantic units (functions, classes, interfaces, types)
 * with proper scope detection and dependency extraction.
 */

import Parser from 'web-tree-sitter'
import { parseCode, isLanguageSupported, initTreeSitter } from './tree-sitter-init'
import { CodeChunk, detectLanguage, chunkFile as regexChunkFile } from './chunker'

// Re-export CodeChunk for consumers
export type { CodeChunk } from './chunker'

// Maximum chunk size in characters
const MAX_CHUNK_SIZE = 2000
// Minimum chunk size to avoid tiny chunks
const MIN_CHUNK_SIZE = 50

// Node types that represent semantic code units for each language
const SEMANTIC_NODE_TYPES: Record<string, Record<string, CodeChunk['chunk_type']>> = {
  typescript: {
    function_declaration: 'function',
    arrow_function: 'function',
    method_definition: 'function',
    class_declaration: 'class',
    interface_declaration: 'interface',
    type_alias_declaration: 'type',
    enum_declaration: 'type',
    export_statement: 'other', // Will check child
  },
  tsx: {
    function_declaration: 'function',
    arrow_function: 'function',
    method_definition: 'function',
    class_declaration: 'class',
    interface_declaration: 'interface',
    type_alias_declaration: 'type',
    enum_declaration: 'type',
    jsx_element: 'function', // Treat JSX as function
  },
  javascript: {
    function_declaration: 'function',
    arrow_function: 'function',
    method_definition: 'function',
    class_declaration: 'class',
    generator_function_declaration: 'function',
  },
  python: {
    function_definition: 'function',
    class_definition: 'class',
    decorated_definition: 'function', // Will check child
  },
  go: {
    function_declaration: 'function',
    method_declaration: 'function',
    type_declaration: 'type', // Struct, interface, etc.
  },
  rust: {
    function_item: 'function',
    impl_item: 'class', // Implementation blocks
    struct_item: 'type',
    enum_item: 'type',
    trait_item: 'interface',
  },
  java: {
    method_declaration: 'function',
    constructor_declaration: 'function',
    class_declaration: 'class',
    interface_declaration: 'interface',
    enum_declaration: 'type',
  },
  c: {
    function_definition: 'function',
    struct_specifier: 'type',
    enum_specifier: 'type',
  },
  cpp: {
    function_definition: 'function',
    class_specifier: 'class',
    struct_specifier: 'type',
    enum_specifier: 'type',
  },
}

// Node types that contain the name of the symbol
const NAME_NODE_TYPES: Record<string, string[]> = {
  typescript: ['identifier', 'property_identifier', 'type_identifier'],
  tsx: ['identifier', 'property_identifier', 'type_identifier'],
  javascript: ['identifier', 'property_identifier'],
  python: ['identifier'],
  go: ['identifier', 'field_identifier'],
  rust: ['identifier'],
  java: ['identifier'],
  c: ['identifier'],
  cpp: ['identifier'],
}

/**
 * Find the name of a symbol in an AST node
 */
function findSymbolName(node: Parser.SyntaxNode, language: string): string | undefined {
  const nameTypes = NAME_NODE_TYPES[language] || ['identifier']

  // For variable declarations with arrow functions, get the variable name
  if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
    const declarator = node.childForFieldName('declarator') || node.namedChildren[0]
    if (declarator) {
      const name = declarator.childForFieldName('name')
      if (name) return name.text
    }
  }

  // For export statements, check the declaration
  if (node.type === 'export_statement') {
    const declaration = node.childForFieldName('declaration')
    if (declaration) {
      return findSymbolName(declaration, language)
    }
  }

  // For decorated definitions (Python), get the definition name
  if (node.type === 'decorated_definition') {
    const definition = node.namedChildren.find(
      (c) => c.type === 'function_definition' || c.type === 'class_definition'
    )
    if (definition) {
      return findSymbolName(definition, language)
    }
  }

  // Try direct field name
  const nameNode = node.childForFieldName('name')
  if (nameNode && nameTypes.includes(nameNode.type)) {
    return nameNode.text
  }

  // Search for first identifier in children
  for (const child of node.namedChildren) {
    if (nameTypes.includes(child.type)) {
      return child.text
    }
  }

  return undefined
}

/**
 * Get the appropriate chunk type for a node
 */
function getChunkType(
  node: Parser.SyntaxNode,
  language: string
): CodeChunk['chunk_type'] | null {
  const nodeTypes = SEMANTIC_NODE_TYPES[language]
  if (!nodeTypes) return null

  // Special case for export statements - check the declaration
  if (node.type === 'export_statement') {
    const declaration = node.childForFieldName('declaration')
    if (declaration) {
      if (declaration.type in nodeTypes) {
        return nodeTypes[declaration.type]
      }
      // Check for lexical_declaration with arrow function
      if (declaration.type === 'lexical_declaration' || declaration.type === 'variable_declaration') {
        const declarator = declaration.namedChildren[0]
        if (declarator) {
          const value = declarator.childForFieldName('value')
          if (value?.type === 'arrow_function') {
            return 'function'
          }
        }
      }
    }
    return null
  }

  // Check if this node type is a semantic unit
  if (node.type in nodeTypes) {
    // Special case for decorated definitions - check the definition
    if (node.type === 'decorated_definition') {
      const definition = node.namedChildren.find((c) => c.type in nodeTypes)
      if (definition) {
        return nodeTypes[definition.type]
      }
    }

    return nodeTypes[node.type]
  }

  // Check for variable declarations with arrow functions
  if (
    (node.type === 'lexical_declaration' || node.type === 'variable_declaration') &&
    ['typescript', 'tsx', 'javascript'].includes(language)
  ) {
    const declarator = node.namedChildren[0]
    if (declarator) {
      const value = declarator.childForFieldName('value')
      if (value && value.type === 'arrow_function') {
        return 'function'
      }
    }
  }

  return null
}

/**
 * Extract import statements and their dependencies
 */
function extractImports(tree: Parser.Tree, language: string): string[] {
  const imports: string[] = []
  const cursor = tree.walk()

  const visit = (): void => {
    const node = cursor.currentNode()

    // TypeScript/JavaScript imports
    if (
      ['typescript', 'tsx', 'javascript'].includes(language) &&
      (node.type === 'import_statement' || node.type === 'import')
    ) {
      const source = node.childForFieldName('source')
      if (source) {
        // Remove quotes from string
        const path = source.text.replace(/['"]/g, '')
        imports.push(path)
      }
    }

    // Python imports
    if (language === 'python') {
      if (node.type === 'import_statement' || node.type === 'import_from_statement') {
        const moduleName = node.childForFieldName('module_name')
        if (moduleName) {
          imports.push(moduleName.text)
        } else {
          // Simple import
          const name = node.childForFieldName('name')
          if (name) {
            imports.push(name.text)
          }
        }
      }
    }

    // Go imports
    if (language === 'go' && node.type === 'import_spec') {
      const path = node.childForFieldName('path')
      if (path) {
        imports.push(path.text.replace(/"/g, ''))
      }
    }

    // Traverse children
    if (cursor.gotoFirstChild()) {
      do {
        visit()
      } while (cursor.gotoNextSibling())
      cursor.gotoParent()
    }
  }

  visit()
  return [...new Set(imports)]
}

/**
 * Check if a node is a top-level semantic unit
 */
function isTopLevelSemanticUnit(
  node: Parser.SyntaxNode,
  language: string
): boolean {
  const nodeTypes = SEMANTIC_NODE_TYPES[language]
  if (!nodeTypes) return false

  // Root node types
  const rootTypes = ['program', 'module', 'translation_unit', 'source_file']

  // Handle export_statement specially - we want to check if it's at root level
  // and contains a semantic declaration
  if (node.type === 'export_statement') {
    const parent = node.parent
    if (!parent || !rootTypes.includes(parent.type)) return false

    // Check if it contains a semantic declaration
    const declaration = node.childForFieldName('declaration')
    if (declaration && declaration.type in nodeTypes) {
      return true
    }
    return false
  }

  // Check if this is a recognized semantic type
  if (!(node.type in nodeTypes)) {
    // Check for variable declarations with functions
    if (
      (node.type === 'lexical_declaration' || node.type === 'variable_declaration') &&
      ['typescript', 'tsx', 'javascript'].includes(language)
    ) {
      const declarator = node.namedChildren[0]
      if (declarator) {
        const value = declarator.childForFieldName('value')
        if (value?.type === 'arrow_function') {
          // Check if at root level
          const parent = node.parent
          if (parent && rootTypes.includes(parent.type)) return true
          // Or inside an export statement at root level
          if (parent?.type === 'export_statement' && parent.parent && rootTypes.includes(parent.parent.type)) {
            return true
          }
        }
      }
    }
    return false
  }

  // Check if it's a direct child of the program/module root
  const parent = node.parent
  if (!parent) return false

  if (rootTypes.includes(parent.type)) {
    return true
  }

  // Also consider export statements at root level
  if (parent.type === 'export_statement' && parent.parent) {
    return rootTypes.includes(parent.parent.type)
  }

  return false
}

/**
 * Extract AST-based chunks from code
 */
async function extractASTChunks(
  content: string,
  filePath: string,
  language: string
): Promise<CodeChunk[]> {
  const chunks: CodeChunk[] = []

  // Parse the code
  const tree = await parseCode(content, language)
  if (!tree) {
    return []
  }

  // Extract file-level dependencies
  const fileDependencies = extractImports(tree, language)

  // Walk the tree to find semantic units
  const cursor = tree.walk()
  const processedRanges: Array<{ start: number; end: number }> = []

  const visit = (): void => {
    const node = cursor.currentNode()

    // Check if this node is a semantic unit
    const chunkType = getChunkType(node, language)
    if (chunkType && isTopLevelSemanticUnit(node, language)) {
      const startLine = node.startPosition.row
      const endLine = node.endPosition.row

      // Check if we've already processed this range
      const alreadyProcessed = processedRanges.some(
        (r) => startLine >= r.start && endLine <= r.end
      )

      if (!alreadyProcessed) {
        const chunkContent = node.text
        const symbolName = findSymbolName(node, language)

        // Only create chunk if it meets size requirements
        if (chunkContent.length >= MIN_CHUNK_SIZE) {
          // If chunk is too large, we'll need to split it
          if (chunkContent.length > MAX_CHUNK_SIZE) {
            // For now, still include it but mark it (can be split later)
            chunks.push({
              content: chunkContent,
              file_path: filePath,
              start_line: startLine + 1, // 1-indexed
              end_line: endLine + 1,
              language,
              chunk_type: chunkType,
              symbol_name: symbolName,
              dependencies: fileDependencies,
            })
          } else {
            chunks.push({
              content: chunkContent,
              file_path: filePath,
              start_line: startLine + 1,
              end_line: endLine + 1,
              language,
              chunk_type: chunkType,
              symbol_name: symbolName,
              dependencies: fileDependencies,
            })
          }

          processedRanges.push({ start: startLine, end: endLine })
        }
      }
    }

    // Traverse children
    if (cursor.gotoFirstChild()) {
      do {
        visit()
      } while (cursor.gotoNextSibling())
      cursor.gotoParent()
    }
  }

  visit()

  // Clean up
  tree.delete()

  return chunks
}

/**
 * Main AST-based chunking function
 * Falls back to regex-based chunking for unsupported languages
 */
export async function chunkFileAST(
  content: string,
  filePath: string
): Promise<CodeChunk[]> {
  if (!content || content.trim().length === 0) {
    return []
  }

  const language = detectLanguage(filePath)

  // Check if Tree-sitter supports this language
  if (!isLanguageSupported(language)) {
    // Fall back to regex-based chunking
    return regexChunkFile(content, filePath)
  }

  // Initialize Tree-sitter if needed
  await initTreeSitter()

  // Try AST-based chunking
  const chunks = await extractASTChunks(content, filePath, language)

  // If we got chunks, return them
  if (chunks.length > 0) {
    return chunks
  }

  // Fall back to regex-based chunking if AST extraction failed
  return regexChunkFile(content, filePath)
}

/**
 * Get semantic context for a chunk (parent scope info)
 * Useful for adding context to embeddings
 */
export async function getChunkContext(
  content: string,
  language: string,
  startLine: number
): Promise<{ parentClass?: string; parentModule?: string }> {
  if (!isLanguageSupported(language)) {
    return {}
  }

  const tree = await parseCode(content, language)
  if (!tree) {
    return {}
  }

  const context: { parentClass?: string; parentModule?: string } = {}

  // Find the node at the given line
  const targetRow = startLine - 1 // Convert to 0-indexed
  let node: Parser.SyntaxNode | null = tree.rootNode.descendantForPosition({ row: targetRow, column: 0 })

  // Walk up the tree to find parent class/module
  while (node) {
    if (node.type === 'class_declaration' || node.type === 'class_definition') {
      const name = findSymbolName(node, language)
      if (name) {
        context.parentClass = name
      }
    }

    if (node.type === 'module' || node.type === 'namespace_definition') {
      const name = findSymbolName(node, language)
      if (name) {
        context.parentModule = name
      }
    }

    // Safe assignment - null parent terminates the loop on next iteration
    node = node.parent ?? null
  }

  tree.delete()
  return context
}

/**
 * Extract all symbols from a file (for indexing)
 */
export async function extractSymbols(
  content: string,
  filePath: string
): Promise<
  Array<{
    name: string
    type: CodeChunk['chunk_type']
    line: number
  }>
> {
  const language = detectLanguage(filePath)

  if (!isLanguageSupported(language)) {
    return []
  }

  const tree = await parseCode(content, language)
  if (!tree) {
    return []
  }

  const symbols: Array<{
    name: string
    type: CodeChunk['chunk_type']
    line: number
  }> = []

  const cursor = tree.walk()

  const visit = (): void => {
    const node = cursor.currentNode()
    const chunkType = getChunkType(node, language)

    if (chunkType) {
      const name = findSymbolName(node, language)
      if (name) {
        symbols.push({
          name,
          type: chunkType,
          line: node.startPosition.row + 1,
        })
      }
    }

    if (cursor.gotoFirstChild()) {
      do {
        visit()
      } while (cursor.gotoNextSibling())
      cursor.gotoParent()
    }
  }

  visit()
  tree.delete()

  return symbols
}
