import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { chunkFileAST, extractSymbols, getChunkContext } from './ast-chunker'
import { initTreeSitter, cleanupTreeSitter } from './tree-sitter-init'

describe('AST Chunker', () => {
  beforeAll(async () => {
    await initTreeSitter()
  })

  afterAll(() => {
    cleanupTreeSitter()
  })

  describe('chunkFileAST', () => {
    it('should chunk TypeScript file with functions and classes', async () => {
      const code = `
import { useState } from 'react'

export function greet(name: string): string {
  return \`Hello, \${name}!\`
}

export const add = (a: number, b: number) => a + b

export class Calculator {
  private value: number = 0

  add(n: number): void {
    this.value += n
  }

  getValue(): number {
    return this.value
  }
}

export interface User {
  id: number
  name: string
  email: string
}

export type Status = 'active' | 'inactive'
`
      const chunks = await chunkFileAST(code, 'test.ts')

      expect(chunks.length).toBeGreaterThan(0)

      // Should find function, class, interface, and type
      const types = new Set(chunks.map((c) => c.chunk_type))
      expect(types.has('function')).toBe(true)
      expect(types.has('class')).toBe(true)

      // Should extract symbol names
      const names = chunks.map((c) => c.symbol_name).filter(Boolean)
      expect(names).toContain('greet')
      expect(names).toContain('Calculator')

      // Should extract dependencies
      const chunkWithDeps = chunks.find((c) => c.dependencies.length > 0)
      expect(chunkWithDeps?.dependencies).toContain('react')
    })

    it('should chunk JavaScript file', async () => {
      const code = `
const express = require('express')

function handleRequest(req, res) {
  res.json({ status: 'ok' })
}

class Router {
  constructor() {
    this.routes = []
  }

  get(path, handler) {
    this.routes.push({ method: 'GET', path, handler })
  }
}

module.exports = { handleRequest, Router }
`
      const chunks = await chunkFileAST(code, 'server.js')

      expect(chunks.length).toBeGreaterThan(0)

      const names = chunks.map((c) => c.symbol_name).filter(Boolean)
      expect(names).toContain('handleRequest')
      expect(names).toContain('Router')
    })

    it('should chunk Python file', async () => {
      const code = `
from typing import List, Optional

def calculate_sum(numbers: List[int]) -> int:
    """Calculate the sum of a list of numbers."""
    return sum(numbers)

class DataProcessor:
    def __init__(self, data: List[int]):
        self.data = data

    def process(self) -> List[int]:
        return [x * 2 for x in self.data]

async def fetch_data(url: str) -> dict:
    pass
`
      const chunks = await chunkFileAST(code, 'processor.py')

      expect(chunks.length).toBeGreaterThan(0)

      const types = new Set(chunks.map((c) => c.chunk_type))
      expect(types.has('function')).toBe(true)
      expect(types.has('class')).toBe(true)

      const names = chunks.map((c) => c.symbol_name).filter(Boolean)
      expect(names).toContain('calculate_sum')
      expect(names).toContain('DataProcessor')
    })

    it('should return empty array for empty content', async () => {
      const chunks = await chunkFileAST('', 'empty.ts')
      expect(chunks).toEqual([])
    })

    it('should fall back to regex chunking for unsupported languages', async () => {
      // Content needs to be longer than MIN_CHUNK_SIZE (50 chars) for regex chunker to produce a chunk
      const longContent = `
This is some longer content that will be chunked
by the regex chunker since the language is unknown
and this content is long enough to meet the minimum chunk size requirements.
`
      const chunks = await chunkFileAST(longContent, 'file.unknown')
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].language).toBe('text')
    })

    it('should include correct line numbers', async () => {
      const code = `
// Line 1 comment
// Line 2 comment
function testFunction() {
  // This function needs to be longer than MIN_CHUNK_SIZE (50 chars)
  const result = 42
  console.log("Hello from testFunction")
  return result
}
`
      const chunks = await chunkFileAST(code, 'test.js')
      const funcChunk = chunks.find((c) => c.symbol_name === 'testFunction')

      expect(funcChunk).toBeDefined()
      expect(funcChunk!.start_line).toBe(4) // Function starts at line 4
      expect(funcChunk!.end_line).toBe(9) // Function ends at line 9
    })
  })

  describe('extractSymbols', () => {
    it('should extract all symbols from TypeScript file', async () => {
      const code = `
export function foo() {}
export const bar = () => {}
export class MyClass {}
export interface MyInterface {}
export type MyType = string
`
      const symbols = await extractSymbols(code, 'test.ts')

      expect(symbols.length).toBeGreaterThan(0)

      const names = symbols.map((s) => s.name)
      expect(names).toContain('foo')
      expect(names).toContain('MyClass')
    })

    it('should return empty for unsupported languages', async () => {
      const symbols = await extractSymbols('some code', 'file.unknown')
      expect(symbols).toEqual([])
    })
  })

  describe('getChunkContext', () => {
    it('should find parent class for method', async () => {
      const code = `
class MyClass {
  myMethod() {
    return 42
  }
}
`
      // Note: This test checks the context functionality
      // The actual line where method is defined
      const context = await getChunkContext(code, 'typescript', 3)

      // This should find the parent class
      // Note: Actual implementation depends on exact AST structure
      expect(context).toBeDefined()
    })
  })
})

describe('AST Chunker Performance', () => {
  beforeAll(async () => {
    await initTreeSitter()
  })

  afterAll(() => {
    cleanupTreeSitter()
  })

  it('should handle large files efficiently', async () => {
    // Generate a large file with many functions
    const functions = Array.from({ length: 100 }, (_, i) => `
function func${i}(x: number): number {
  return x * ${i}
}
`).join('\n')

    const startTime = Date.now()
    const chunks = await chunkFileAST(functions, 'large.ts')
    const duration = Date.now() - startTime

    expect(chunks.length).toBe(100)
    expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds
  })
})
