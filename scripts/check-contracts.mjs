#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CONTRACT_PATH = 'reference/doctrine-contracts.json'
const REFERENCE_PATH = 'reference/sliced-bread.md'
const MARKERS = {
  severity: 'doctrine:severity-cases',
  growth: 'doctrine:growth-cases',
  growthSummary: 'doctrine:growth-summary',
}
const CASE_FIELDS = ['id', 'given', 'expected', 'rationale']
const CONTRACT_FIELDS = ['schema_version', 'severity_cases', 'growth_cases']
const CASE_FAMILIES = [
  {
    field: 'severity_cases',
    marker: MARKERS.severity,
    idPattern: /^severity-[a-z0-9]+(?:-[a-z0-9]+)*$/,
    outcomes: new Set(['blocker', 'high', 'medium', 'low']),
  },
  {
    field: 'growth_cases',
    marker: MARKERS.growth,
    idPattern: /^growth-[a-z0-9]+(?:-[a-z0-9]+)*$/,
    outcomes: new Set(['allow', 'medium']),
  },
]
const CASE_CONSUMERS = [
  {
    file: 'site/src/content/docs/reference/sliced-bread.md',
    blocks: [MARKERS.severity, MARKERS.growth],
  },
  { file: 'skills/sliced-bread-review/SKILL.md', blocks: [MARKERS.severity, MARKERS.growth] },
  {
    file: 'skills/sliced-bread-audit/sliced-bread-audit.js',
    blocks: [MARKERS.severity, MARKERS.growth],
  },
]
const LEGACY_BLOCKS = ['doctrine:arrows', 'doctrine:severity', 'doctrine:growth-guards']
const LEGACY_CONSUMERS = [
  {
    file: 'site/src/content/docs/reference/sliced-bread.md',
    blocks: [...LEGACY_BLOCKS, MARKERS.growthSummary],
  },
  { file: 'skills/sliced-bread-review/SKILL.md', blocks: LEGACY_BLOCKS },
  // The audit prompt grades against `doctrine:severity-cases`; it no longer projects the legacy severity table.
  {
    file: 'skills/sliced-bread-audit/sliced-bread-audit.js',
    blocks: ['doctrine:arrows', 'doctrine:growth-guards'],
  },
  { file: 'skills/sliced-bread-depth/SKILL.md', blocks: ['doctrine:growth-guards'] },
  { file: 'README.md', blocks: [MARKERS.growthSummary] },
  { file: 'site/src/content/docs/index.mdx', blocks: [MARKERS.growthSummary] },
]
const CATALOG_FILES = ['skills/README.md', 'site/src/content/docs/skills.md']
const DRY_RUN_MARKER = 'doctrine:dry-run'
const DRY_RUN_FILES = ['skills/sliced-bread-audit/README.md', 'site/src/content/docs/skills.md']
const ADR_STATUSES = new Set(['proposed', 'accepted', 'amended', 'superseded', 'deprecated'])
const READ_CACHE = new Map()

function absolutePath(file) {
  return join(ROOT, file)
}

function readRaw(file) {
  if (READ_CACHE.has(file)) return READ_CACHE.get(file)
  let result
  try {
    result = { ok: true, text: readFileSync(absolutePath(file), 'utf8') }
  } catch (error) {
    result = { ok: false, code: error?.code ?? 'UNKNOWN' }
  }
  READ_CACHE.set(file, result)
  return result
}

function readText(file, errors, detail = 'file') {
  const result = readRaw(file)
  if (!result.ok) {
    errors.push(
      `${file}: ${detail} is ${result.code === 'ENOENT' ? 'missing' : 'unreadable'} (${result.code})`,
    )
  }
  return result
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function sameKeys(value, expected) {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

function occurrences(text, marker) {
  const found = []
  for (let at = text.indexOf(marker); at !== -1; at = text.indexOf(marker, at + marker.length)) {
    found.push(at)
  }
  return found
}

function extractBlock(text, markerName, file, errors) {
  const markerPairs = [
    [`<!-- ${markerName}:start -->`, `<!-- ${markerName}:end -->`],
    [`{/* ${markerName}:start */}`, `{/* ${markerName}:end */}`],
  ]
  const starts = markerPairs.flatMap(([marker]) =>
    occurrences(text, marker).map((at) => ({ at, marker })),
  )
  const ends = markerPairs.flatMap(([, marker]) =>
    occurrences(text, marker).map((at) => ({ at, marker })),
  )
  if (starts.length !== 1 || ends.length !== 1) {
    errors.push(
      `${file}: contract block ${markerName}: expected exactly one marker pair ` +
        `(found ${starts.length} start and ${ends.length} end markers)`,
    )
    return null
  }
  if (ends[0].at < starts[0].at) {
    errors.push(`${file}: contract block ${markerName}: end marker appears before start marker`)
    return null
  }
  const block = text.slice(starts[0].at + starts[0].marker.length, ends[0].at).trim()
  if (!block) {
    errors.push(`${file}: contract block ${markerName}: block is empty`)
    return null
  }
  return block
}

function escapeCell(value) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

function renderCaseBlock(cases) {
  return [
    '| ID | Given | Expected | Rationale |',
    '| --- | --- | --- | --- |',
    ...cases.map(
      ({ id, given, expected, rationale }) =>
        `| \`${escapeCell(id)}\` | ${escapeCell(given)} | \`${escapeCell(expected)}\` | ${escapeCell(rationale)} |`,
    ),
  ].join('\n')
}

function loadContract(errors) {
  const result = readText(CONTRACT_PATH, errors, 'executable projection')
  if (!result.ok) return null

  let contract
  try {
    contract = JSON.parse(result.text)
  } catch (error) {
    errors.push(`${CONTRACT_PATH}: contract field JSON: invalid JSON (${error.message})`)
    return null
  }
  if (!isRecord(contract)) {
    errors.push(`${CONTRACT_PATH}: contract field root: expected an object`)
    return null
  }
  if (!sameKeys(contract, CONTRACT_FIELDS)) {
    errors.push(
      `${CONTRACT_PATH}: contract field root: expected exactly ${CONTRACT_FIELDS.join(', ')}`,
    )
  }
  if (contract.schema_version !== 1) {
    errors.push(`${CONTRACT_PATH}: contract field schema_version: expected 1`)
  }

  const seenIds = new Set()
  for (const { field, idPattern, outcomes } of CASE_FAMILIES) {
    const cases = contract[field]
    if (!Array.isArray(cases) || cases.length === 0) {
      errors.push(`${CONTRACT_PATH}: contract field ${field}: expected a non-empty array`)
      continue
    }
    for (const [index, item] of cases.entries()) {
      const prefix = `${CONTRACT_PATH}: contract field ${field}[${index}]`
      if (!isRecord(item)) {
        errors.push(`${prefix}: expected an object`)
        continue
      }
      if (!sameKeys(item, CASE_FIELDS)) {
        errors.push(`${prefix}: expected exactly ${CASE_FIELDS.join(', ')}`)
      }
      for (const key of ['id', 'given', 'rationale']) {
        if (typeof item[key] !== 'string' || item[key].trim() === '') {
          errors.push(`${prefix}.${key}: expected a non-empty string`)
        }
      }
      if (typeof item.id === 'string') {
        if (!idPattern.test(item.id)) errors.push(`${prefix}.id: invalid case family or format`)
        if (seenIds.has(item.id)) errors.push(`${prefix}.id: duplicate case ID ${item.id}`)
        seenIds.add(item.id)
      }
      if (typeof item.expected !== 'string' || !outcomes.has(item.expected)) {
        errors.push(`${prefix}.expected: unrecognized outcome ${JSON.stringify(item.expected)}`)
      }
    }
  }

  return errors.some((error) => error.startsWith(`${CONTRACT_PATH}:`)) ? null : contract
}

function firstDivergence(expected, actual) {
  const expectedLines = expected.split('\n')
  const actualLines = actual.split('\n')
  const length = Math.max(expectedLines.length, actualLines.length)
  for (let index = 0; index < length; index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      return ` (expected: ${expectedLines[index] ?? '<missing>'} | actual: ${actualLines[index] ?? '<missing>'})`
    }
  }
  return ''
}

function checkProjections(consumers, expectedByMarker, sourceLabel, errors) {
  for (const consumer of consumers) {
    const result = readText(consumer.file, errors)
    if (!result.ok) continue
    for (const marker of consumer.blocks) {
      const actual = extractBlock(result.text, marker, consumer.file, errors)
      const expected = expectedByMarker.get(marker)
      if (actual !== null && expected != null && actual !== expected) {
        errors.push(
          `${consumer.file}: contract block ${marker}: diverges from ${sourceLabel}` +
            firstDivergence(expected, actual),
        )
      }
    }
  }
}

function checkCaseConsumers(contract, errors, checked) {
  const rendered = new Map(
    CASE_FAMILIES.map(({ field, marker }) => [marker, renderCaseBlock(contract[field])]),
  )
  const expectedByMarker = new Map(rendered)
  const reference = readText(REFERENCE_PATH, errors, 'canonical doctrine')
  if (reference.ok) {
    for (const marker of rendered.keys()) {
      const referenceBlock = extractBlock(reference.text, marker, REFERENCE_PATH, errors)
      if (referenceBlock === null) continue
      expectedByMarker.set(marker, referenceBlock)
      const renderedBlock = rendered.get(marker)
      if (referenceBlock !== renderedBlock) {
        errors.push(
          `${CONTRACT_PATH}: contract block ${marker}: diverges from ${REFERENCE_PATH}` +
            firstDivergence(referenceBlock, renderedBlock),
        )
      }
    }
  }
  checkProjections(CASE_CONSUMERS, expectedByMarker, REFERENCE_PATH, errors)
  checked.push(`checked reference-owned case projections (${CASE_CONSUMERS.length + 1} consumers)`)
}

function checkLegacyConsumers(errors, checked) {
  const canonical = readText(REFERENCE_PATH, errors, 'canonical doctrine')
  if (!canonical.ok) return
  const markers = [...LEGACY_BLOCKS, MARKERS.growthSummary]
  const expectedByMarker = new Map(
    markers.map((marker) => [marker, extractBlock(canonical.text, marker, REFERENCE_PATH, errors)]),
  )
  checkProjections(LEGACY_CONSUMERS, expectedByMarker, REFERENCE_PATH, errors)
  checked.push('checked authored doctrine blocks (arrows, severity, growth guards, growth summary)')
}

function parseCatalog(block, file, errors) {
  const lines = block.split('\n').filter((line) => line.trim())
  if (lines.length < 3 || !/^\|\s*Tool\s*\|\s*Scope\s*\|$/.test(lines[0])) {
    errors.push(`${file}: contract block skills:catalog: invalid Tool/Scope header`)
    return []
  }
  if (!/^\|(?:\s*:?-+:?\s*\|){2}$/.test(lines[1])) {
    errors.push(`${file}: contract block skills:catalog: invalid delimiter row`)
    return []
  }
  const tools = []
  for (const line of lines.slice(2)) {
    const match = /^\|\s*`([^`]+)`\s*\|\s*(\S(?:.*\S)?)\s*\|$/.exec(line)
    if (!match) {
      errors.push(`${file}: contract block skills:catalog: malformed row ${JSON.stringify(line)}`)
      continue
    }
    tools.push(match[1])
  }
  if (new Set(tools).size !== tools.length) {
    errors.push(`${file}: contract block skills:catalog: duplicate tool row`)
  }
  return tools
}

function shippedTools(errors) {
  try {
    return readdirSync(absolutePath('skills'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  } catch (error) {
    errors.push(`skills: skill directory is unreadable (${error.message})`)
    return []
  }
}

function checkCatalog(errors, checked) {
  const expectedTools = shippedTools(errors)
  const blocks = []
  for (const file of CATALOG_FILES) {
    const result = readText(file, errors)
    if (!result.ok) continue
    const catalog = extractBlock(result.text, 'skills:catalog', file, errors)
    if (catalog === null) continue
    const tools = parseCatalog(catalog, file, errors)
    const actual = [...tools].sort()
    if (actual.join('\0') !== expectedTools.join('\0')) {
      const missing = expectedTools.filter((tool) => !actual.includes(tool))
      const extra = actual.filter((tool) => !expectedTools.includes(tool))
      errors.push(
        `${file}: contract block skills:catalog: rows must match shipped skill directories ` +
          `(missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`,
      )
    }
    blocks.push({ file, catalog })
  }
  if (blocks.length === CATALOG_FILES.length) {
    for (const entry of blocks.slice(1)) {
      if (entry.catalog !== blocks[0].catalog) {
        errors.push(`${entry.file}: contract block skills:catalog: diverges from ${blocks[0].file}`)
      }
    }
  }
  checked.push(`checked skill catalog projections (${expectedTools.length} shipped tools)`)
}

function checkDryRunSentence(errors, checked) {
  const blocks = []
  for (const file of DRY_RUN_FILES) {
    const result = readText(file, errors)
    if (!result.ok) continue
    const block = extractBlock(result.text, DRY_RUN_MARKER, file, errors)
    if (block !== null) blocks.push({ file, block })
  }
  if (blocks.length === DRY_RUN_FILES.length) {
    for (const entry of blocks.slice(1)) {
      if (entry.block !== blocks[0].block) {
        errors.push(
          `${entry.file}: contract block ${DRY_RUN_MARKER}: diverges from ${blocks[0].file}`,
        )
      }
    }
  }
  checked.push('checked dry_run sentence projection (2 files)')
}

function sectionBody(text, heading) {
  const pattern = /^##\s+(.+?)\s*$/gm
  const headings = []
  let match
  while ((match = pattern.exec(text)) !== null) {
    headings.push({ name: match[1], start: match.index, end: pattern.lastIndex })
  }
  const current = headings.find(({ name }) => name === heading)
  if (!current) return null
  const next = headings.find(({ start }) => start > current.start)
  return text.slice(current.end, next ? next.start : text.length).trim()
}

function isIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function frontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match) return null
  const fields = new Map()
  for (const line of match[1].split('\n')) {
    const field = /^([a-z_]+):\s*(.+)$/.exec(line)
    if (field) fields.set(field[1], field[2].trim())
  }
  return fields
}

function checkAdrs(errors, checked) {
  let entries
  try {
    entries = readdirSync(absolutePath('docs/adr'), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    errors.push(`docs/adr: ADR directory is unreadable (${error.message})`)
    return
  }

  for (const entry of entries) {
    const file = `docs/adr/${entry.name}`
    const result = readText(file, errors, 'ADR')
    if (!result.ok) continue
    const fields = frontmatter(result.text)
    if (!fields) {
      errors.push(`${file}: ADR field frontmatter: missing YAML frontmatter`)
      continue
    }
    const status = fields.get('status')
    if (!ADR_STATUSES.has(status)) {
      errors.push(`${file}: ADR field status: expected ${[...ADR_STATUSES].join('|')}`)
    }
    for (const field of ['date', 'last_verified']) {
      if (!isIsoDate(fields.get(field) ?? '')) {
        errors.push(`${file}: ADR field ${field}: expected ISO date YYYY-MM-DD`)
      }
    }
    if (status === 'superseded' && !fields.get('superseded_by')) {
      errors.push(`${file}: ADR field superseded_by: required when status is superseded`)
    }
    for (const field of ['superseded_by', 'amended_by', 'supersedes', 'amends']) {
      const value = fields.get(field)
      if (value && !/^ADR-\d{3}(?:\s*,\s*ADR-\d{3})*$/.test(value)) {
        errors.push(`${file}: ADR field ${field}: expected ADR-NNN reference list`)
      }
    }
    for (const heading of ['Confirmation', 'References']) {
      if (!sectionBody(result.text, heading)) {
        errors.push(`${file}: ADR section ${heading}: missing or empty section`)
      }
    }
  }
  checked.push(`checked ADR lifecycle metadata (${entries.length} files)`)
}

function main() {
  const errors = []
  const checked = []
  const contract = loadContract(errors)
  if (contract) {
    checkCaseConsumers(contract, errors, checked)
  } else {
    checked.push('skipped case-projection checks (contract invalid)')
  }
  checkLegacyConsumers(errors, checked)
  checkCatalog(errors, checked)
  checkDryRunSentence(errors, checked)
  checkAdrs(errors, checked)

  for (const line of checked) console.log(line)
  if (errors.length) {
    for (const error of errors) console.error(error)
    return 1
  }
  console.log('all declared consistency contracts hold')
  return 0
}

process.exitCode = main()
