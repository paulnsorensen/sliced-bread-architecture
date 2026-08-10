#!/usr/bin/env node
// Check-only drift guard: asserts every doctrine consumer carries the marker-fenced
// blocks of reference/sliced-bread.md verbatim. Never writes a file.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CANONICAL = 'reference/sliced-bread.md'
const BLOCK_NAMES = ['arrows', 'severity', 'growth-guards']

const CONSUMERS = [
  {
    file: 'site/src/content/docs/reference/sliced-bread.md',
    blocks: ['arrows', 'severity', 'growth-guards'],
  },
  { file: 'skills/sliced-bread-review/SKILL.md', blocks: ['arrows', 'severity', 'growth-guards'] },
  {
    file: 'skills/sliced-bread-audit/sliced-bread-audit.js',
    blocks: ['arrows', 'severity', 'growth-guards'],
  },
  { file: 'skills/sliced-bread-depth/SKILL.md', blocks: ['growth-guards'] },
]

const ROOT = join(import.meta.dirname, '..')

function occurrences(text, marker) {
  const found = []
  for (let at = text.indexOf(marker); at !== -1; at = text.indexOf(marker, at + marker.length)) {
    found.push(at)
  }
  return found
}

function extractBlock(sourceText, blockName) {
  const startMarker = `<!-- doctrine:${blockName}:start -->`
  const endMarker = `<!-- doctrine:${blockName}:end -->`
  const starts = occurrences(sourceText, startMarker)
  const ends = occurrences(sourceText, endMarker)
  if (starts.length !== 1 || ends.length !== 1) {
    throw new Error(
      `expected exactly one ${startMarker} and one ${endMarker}, ` +
        `found ${starts.length} start and ${ends.length} end`,
    )
  }
  if (ends[0] < starts[0]) {
    throw new Error(`${endMarker} appears before ${startMarker}`)
  }
  return sourceText.slice(starts[0] + startMarker.length, ends[0]).trim()
}

function readOrNull(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function main() {
  let canonicalText
  try {
    canonicalText = readFileSync(join(ROOT, CANONICAL), 'utf8')
  } catch (error) {
    console.error(`${CANONICAL}: canonical source is unreadable: ${error.message}`)
    return 1
  }

  const canonicalBlocks = new Map()
  let malformed = false
  for (const name of BLOCK_NAMES) {
    let block
    try {
      block = extractBlock(canonicalText, name)
    } catch (error) {
      console.error(`${CANONICAL}: malformed marker pair for block ${name}: ${error.message}`)
      malformed = true
      continue
    }
    if (block === '') {
      console.error(`${CANONICAL}: block ${name} is empty`)
      malformed = true
      continue
    }
    canonicalBlocks.set(name, block)
  }
  if (malformed) return 1

  let diverged = false
  for (const consumer of CONSUMERS) {
    const text = readOrNull(join(ROOT, consumer.file))
    if (text === null) {
      console.log(`${consumer.file}: skipped (not present)`)
      continue
    }
    for (const name of consumer.blocks) {
      let copy
      try {
        copy = extractBlock(text, name)
      } catch (error) {
        console.error(`${consumer.file}: block ${name}: ${error.message}`)
        diverged = true
        continue
      }
      if (copy !== canonicalBlocks.get(name)) {
        console.error(`${consumer.file}: block ${name} diverged from ${CANONICAL}`)
        diverged = true
      }
    }
  }
  return diverged ? 1 : 0
}

process.exitCode = main()
