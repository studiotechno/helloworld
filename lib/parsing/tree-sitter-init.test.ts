import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  initTreeSitter,
  parseCode,
  isLanguageSupported,
  cleanupTreeSitter,
  SUPPORTED_LANGUAGES,
} from './tree-sitter-init'

describe('Tree-sitter Initialization', () => {
  beforeAll(async () => {
    await initTreeSitter()
  })

  afterAll(() => {
    cleanupTreeSitter()
  })

  it('should support expected languages', () => {
    expect(SUPPORTED_LANGUAGES).toContain('typescript')
    expect(SUPPORTED_LANGUAGES).toContain('javascript')
    expect(SUPPORTED_LANGUAGES).toContain('python')
    expect(SUPPORTED_LANGUAGES).toContain('go')
    expect(SUPPORTED_LANGUAGES).toContain('rust')
  })

  it('should correctly identify supported languages', () => {
    expect(isLanguageSupported('typescript')).toBe(true)
    expect(isLanguageSupported('python')).toBe(true)
    expect(isLanguageSupported('unknown')).toBe(false)
  })

  it('should parse TypeScript code', async () => {
    const code = `
function greet(name: string): string {
  return \`Hello, \${name}!\`
}

const add = (a: number, b: number) => a + b

class Calculator {
  add(a: number, b: number): number {
    return a + b
  }
}

interface User {
  id: number
  name: string
}
`

    const tree = await parseCode(code, 'typescript')
    expect(tree).not.toBeNull()
    expect(tree!.rootNode).toBeDefined()
    expect(tree!.rootNode.type).toBe('program')

    // Check that we found some nodes
    const functionDeclarations = tree!.rootNode.children.filter(
      (child) => child.type === 'function_declaration'
    )
    expect(functionDeclarations.length).toBeGreaterThan(0)
  })

  it('should parse JavaScript code', async () => {
    const code = `
function hello() {
  console.log('Hello!')
}

const arrow = () => {
  return 42
}

class MyClass {
  constructor() {}
}
`

    const tree = await parseCode(code, 'javascript')
    expect(tree).not.toBeNull()
    expect(tree!.rootNode.type).toBe('program')
  })

  it('should parse Python code', async () => {
    const code = `
def greet(name):
    return f"Hello, {name}!"

class Calculator:
    def add(self, a, b):
        return a + b

async def fetch_data():
    pass
`

    const tree = await parseCode(code, 'python')
    expect(tree).not.toBeNull()
    expect(tree!.rootNode.type).toBe('module')

    // Check for function definitions
    const functionDefs = tree!.rootNode.children.filter(
      (child) => child.type === 'function_definition'
    )
    expect(functionDefs.length).toBeGreaterThan(0)
  })

  it('should return null for unsupported languages', async () => {
    const tree = await parseCode('some code', 'unknown_language')
    expect(tree).toBeNull()
  })
})
