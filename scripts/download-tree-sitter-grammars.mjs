#!/usr/bin/env node

/**
 * Download Tree-sitter WASM grammars for supported languages
 * Run with: node scripts/download-tree-sitter-grammars.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GRAMMARS_DIR = path.join(__dirname, '../lib/parsing/grammars')

// Use tree-sitter-wasms from npm (reliable source)
const NPM_GRAMMARS_URL = 'https://unpkg.com/tree-sitter-wasms@0.0.16/out/'

const NPM_GRAMMARS = [
  'tree-sitter-typescript.wasm',
  'tree-sitter-tsx.wasm',
  'tree-sitter-javascript.wasm',
  'tree-sitter-python.wasm',
  'tree-sitter-go.wasm',
  'tree-sitter-rust.wasm',
  'tree-sitter-java.wasm',
  'tree-sitter-c.wasm',
  'tree-sitter-cpp.wasm',
  'tree-sitter-ruby.wasm',
  'tree-sitter-c-sharp.wasm',
  'tree-sitter-kotlin.wasm',
  'tree-sitter-swift.wasm',
  'tree-sitter-bash.wasm',
  'tree-sitter-json.wasm',
  'tree-sitter-yaml.wasm',
  'tree-sitter-html.wasm',
  'tree-sitter-css.wasm',
  'tree-sitter-sql.wasm',
  'tree-sitter-markdown.wasm',
]

async function downloadFile(url, dest) {
  const response = await fetch(url, { redirect: 'follow' })

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  fs.writeFileSync(dest, Buffer.from(buffer))
}

async function main() {
  console.log('Downloading Tree-sitter WASM grammars...\n')

  // Ensure grammars directory exists
  if (!fs.existsSync(GRAMMARS_DIR)) {
    fs.mkdirSync(GRAMMARS_DIR, { recursive: true })
  }

  // Download grammar files
  for (const filename of NPM_GRAMMARS) {
    const url = NPM_GRAMMARS_URL + filename
    const dest = path.join(GRAMMARS_DIR, filename)

    if (fs.existsSync(dest)) {
      console.log(`✓ ${filename} (already exists)`)
      continue
    }

    try {
      console.log(`↓ Downloading ${filename}...`)
      await downloadFile(url, dest)
      console.log(`✓ ${filename}`)
    } catch (error) {
      console.error(`✗ ${filename}: ${error.message}`)
    }
  }

  // Also download the main tree-sitter.wasm from web-tree-sitter
  const treeSitterWasmUrl = 'https://unpkg.com/web-tree-sitter@0.24.7/tree-sitter.wasm'
  const treeSitterWasmDest = path.join(GRAMMARS_DIR, 'tree-sitter.wasm')

  if (!fs.existsSync(treeSitterWasmDest)) {
    try {
      console.log('↓ Downloading tree-sitter.wasm...')
      await downloadFile(treeSitterWasmUrl, treeSitterWasmDest)
      console.log('✓ tree-sitter.wasm')
    } catch (error) {
      console.error(`✗ tree-sitter.wasm: ${error.message}`)
    }
  } else {
    console.log('✓ tree-sitter.wasm (already exists)')
  }

  console.log('\nDone!')
  console.log(`\nGrammars downloaded to: ${GRAMMARS_DIR}`)
}

main().catch(console.error)
