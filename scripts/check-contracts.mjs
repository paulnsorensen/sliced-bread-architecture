#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CONTRACT_PATH = 'reference/doctrine-contracts.json'
const MARKERS = {
  severity: 'doctrine:severity-cases',
  growth: 'doctrine:growth-cases',
}
const EXPECTED_SEVERITY_IDS = [
  'severity-import-exec',
  'severity-static-domain-infra',
  'severity-static-concrete-adapter',
  'severity-other-forbidden-edge',
]
const EXPECTED_GROWTH_IDS = [
  'growth-cycle-event',
  'growth-positional-one-file',
  'growth-single-unpressured',
]
const SEVERITIES = new Set(['blocker', 'high', 'medium', 'low'])
const GROWTH_OUTCOMES = new Set(['allow', 'medium'])
const CASE_FIELDS = ['id', 'given', 'expected', 'rationale']
const CONTRACT_FIELDS = ['schema_version', 'match_policy', 'severity_cases', 'growth_cases']
const CONSUMERS = [
  { file: 'reference/sliced-bread.md', blocks: [MARKERS.severity, MARKERS.growth] },
  {
    file: 'site/src/content/docs/reference/sliced-bread.md',
    blocks: [MARKERS.severity, MARKERS.growth],
  },
  { file: 'skills/sliced-bread-review/SKILL.md', blocks: [MARKERS.severity, MARKERS.growth] },
  {
    file: 'skills/sliced-bread-audit/sliced-bread-audit.js',
    blocks: [MARKERS.severity, MARKERS.growth],
  },
  { file: 'skills/sliced-bread-depth/SKILL.md', blocks: [MARKERS.growth] },
]
const LEGACY_BLOCKS = ['doctrine:arrows', 'doctrine:severity', 'doctrine:growth-guards']
const LEGACY_CONSUMERS = [
  { file: 'site/src/content/docs/reference/sliced-bread.md', blocks: LEGACY_BLOCKS },
  { file: 'skills/sliced-bread-review/SKILL.md', blocks: LEGACY_BLOCKS },
  { file: 'skills/sliced-bread-audit/sliced-bread-audit.js', blocks: LEGACY_BLOCKS },
  { file: 'skills/sliced-bread-depth/SKILL.md', blocks: ['doctrine:growth-guards'] },
]
const AUTHORITY_TERMS = {
  'severity-import-exec':
    /\b(?:import[ -]time|executes? infrastructure|infrastructure work.{0,120}\bimport(?:ed|ing)?)\b/i,
  'severity-static-domain-infra':
    /\b(?:static (?:domain|dependency)|domain model.{0,120}\bstatic dependency|model purity)\b/i,
  'severity-static-concrete-adapter':
    /\b(?:concrete adapter|application service.{0,120}\b(?:imports?|depends on).{0,80}\badapter)\b/i,
  'severity-other-forbidden-edge':
    /\b(?:forbidden (?:dependency )?edge|dependency edge.{0,120}\bforbidden direction|structural inversion)\b/i,
  'growth-cycle-event': /\b(?:event dispatcher|cross[ -]slice cycle|dispatcher.{0,120}\bcycle)\b/i,
  'growth-positional-one-file':
    /\b(?:one[ -]file positional crust|positional crust|internal visibility.{0,120}\bprivacy)\b/i,
  'growth-single-unpressured':
    /\b(?:new abstraction|one concrete consumer|no demonstrated pressure|premature abstraction)\b/i,
}
const AUTHORITY_OUTCOMES = {
  severity: 'blocker|high|medium|low',
  growth: 'allow(?:ed)?|medium',
}
const AUTHORITY_BLOCKS = [
  MARKERS.severity,
  MARKERS.growth,
  'doctrine:severity',
  'doctrine:growth-guards',
]
const CATALOG_FILES = ['skills/README.md', 'site/src/content/docs/skills.md']
const EXPECTED_TOOLS = [
  'sliced-bread-review',
  'sliced-bread-audit',
  'sliced-bread-depth',
  'slice-and-spine-review',
]
const CATALOG_SCOPE_TERMS = {
  'sliced-bread-review': ['bounded diff', 'architecture review'],
  'sliced-bread-audit': ['automated', 'ten-dimension audit', 'files'],
  'sliced-bread-depth': ['deep-module scoring', 'crust shape'],
  'slice-and-spine-review': ['human-led', 'seam review'],
}
const GROWTH_SUMMARY_FILES = ['README.md', 'site/src/content/docs/index.mdx']
const GROWTH_SUMMARY_REQUIREMENTS = [
  'demonstrated pressure',
  'two concrete consumers',
  'cycle breaking event dispatcher',
  'one file positional crust',
]
const AUDIT_PATH = 'skills/sliced-bread-audit/sliced-bread-audit.js'
const AUDIT_DIMENSIONS = [
  'import-direction',
  'crust-integrity',
  'model-purity',
  'growth-justification',
  'event-usage',
  'correctness',
  'security',
  'complexity',
  'deslop',
  'tests',
]

const READ_OK = 'ok'
const READ_MISSING = 'missing'
const READ_ERROR = 'error'
const READ_CACHE = new Map()

function readText(file, errors, detail = 'file') {
  if (READ_CACHE.has(file)) return READ_CACHE.get(file)

  let result
  try {
    result = { kind: READ_OK, text: readFileSync(absolutePath(file), 'utf8') }
  } catch (error) {
    const code = error?.code ?? 'UNKNOWN'
    if (code !== 'ENOENT') {
      errors.push(`${file}: ${detail} is unreadable (${code}): ${error.message}`)
    }
    result = { kind: code === 'ENOENT' ? READ_MISSING : READ_ERROR, code }
  }
  READ_CACHE.set(file, result)
  return result
}

function absolutePath(file) {
  return join(ROOT, file)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function sameKeys(value, expected) {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && expected.every((key) => actual.includes(key))
}

function occurrences(text, marker) {
  const found = []
  for (let at = text.indexOf(marker); at !== -1; at = text.indexOf(marker, at + marker.length)) {
    found.push(at)
  }
  return found
}

function extractBlock(text, markerName, file, errors) {
  const startMarker = `<!-- ${markerName}:start -->`
  const endMarker = `<!-- ${markerName}:end -->`
  const starts = occurrences(text, startMarker)
  const ends = occurrences(text, endMarker)
  if (starts.length !== 1 || ends.length !== 1) {
    errors.push(
      `${file}: contract block ${markerName}: expected exactly one marker pair ` +
        `(found ${starts.length} start and ${ends.length} end markers)`,
    )
    return null
  }
  if (ends[0] < starts[0]) {
    errors.push(`${file}: contract block ${markerName}: end marker appears before start marker`)
    return null
  }
  const block = text.slice(starts[0] + startMarker.length, ends[0]).trim()
  if (!block) {
    errors.push(`${file}: contract block ${markerName}: block is empty`)
    return null
  }
  return block
}

function withoutMarkedBlock(text, markerName) {
  const startMarker = `<!-- ${markerName}:start -->`
  const endMarker = `<!-- ${markerName}:end -->`
  const start = text.indexOf(startMarker)
  const end = text.indexOf(endMarker)
  if (start === -1 || end < start) return text
  const after = end + endMarker.length
  const masked = text.slice(start, after).replaceAll(/[^\n]/g, ' ')
  return text.slice(0, start) + masked + text.slice(after)
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

function loadAndValidateContract(errors) {
  const result = readText(CONTRACT_PATH, errors, 'executable contract')
  if (result.kind !== READ_OK) {
    if (result.kind === READ_MISSING) {
      errors.push(`${CONTRACT_PATH}: executable contract is missing (ENOENT)`)
    }
    return null
  }
  const text = result.text

  let contract
  try {
    contract = JSON.parse(text)
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
  if (contract.match_policy !== 'first-match') {
    errors.push(`${CONTRACT_PATH}: contract field match_policy: expected first-match`)
  }

  const seenIds = new Set()
  const validateCases = (field, expectedIds, outcomes) => {
    const cases = contract[field]
    if (!Array.isArray(cases) || cases.length === 0) {
      errors.push(`${CONTRACT_PATH}: contract field ${field}: expected a non-empty array`)
      return []
    }
    const ids = []
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
      if (typeof item.expected !== 'string' || !outcomes.has(item.expected)) {
        errors.push(`${prefix}.expected: unrecognized outcome ${JSON.stringify(item.expected)}`)
      }
      if (typeof item.id === 'string') {
        ids.push(item.id)
        if (seenIds.has(item.id)) {
          errors.push(`${prefix}.id: duplicate case ID ${item.id}`)
        }
        seenIds.add(item.id)
      }
    }
    if (ids.length !== expectedIds.length || ids.some((id, index) => id !== expectedIds[index])) {
      errors.push(
        `${CONTRACT_PATH}: contract field ${field}: expected ordered IDs ${expectedIds.join(', ')}`,
      )
    }
    return cases
  }

  const severityCases = validateCases('severity_cases', EXPECTED_SEVERITY_IDS, SEVERITIES)
  const growthCases = validateCases('growth_cases', EXPECTED_GROWTH_IDS, GROWTH_OUTCOMES)
  return errors.some((error) => error.startsWith(`${CONTRACT_PATH}:`))
    ? null
    : { severityCases, growthCases }
}

function checkConsumers(contract, errors, checked) {
  const rendered = {
    [MARKERS.severity]: renderCaseBlock(contract.severityCases),
    [MARKERS.growth]: renderCaseBlock(contract.growthCases),
  }
  for (const consumer of CONSUMERS) {
    const result = readText(consumer.file, errors)
    if (result.kind !== READ_OK) {
      if (result.kind === READ_MISSING) {
        for (const block of consumer.blocks) {
          errors.push(
            `${consumer.file}: contract block ${block}: declared consumer is missing (ENOENT)`,
          )
        }
      }
      continue
    }
    const text = result.text
    for (const block of consumer.blocks) {
      const actual = extractBlock(text, block, consumer.file, errors)
      if (actual !== null && actual !== rendered[block]) {
        errors.push(
          `${consumer.file}: contract block ${block}: rendered block diverges from JSON contract`,
        )
      }
    }
  }
  checked.push(`checked contract ${MARKERS.severity} (${contract.severityCases.length} cases)`)
  checked.push(`checked contract ${MARKERS.growth} (${contract.growthCases.length} cases)`)
}

function authorityStatements(text) {
  const statements = []
  const boundary = /(?:\n[ \t]*\n)|[.!?](?:[*_`'")\]}]*,?)?(?=\s|$)/g
  let start = 0
  for (let match = boundary.exec(text); match !== null; match = boundary.exec(text)) {
    const end = match.index + match[0].length
    const statement = text.slice(start, end)
    if (statement.trim()) {
      statements.push({
        line: text.slice(0, start).split('\n').length,
        text: statement,
      })
    }
    start = end
  }
  const trailing = text.slice(start)
  if (trailing.trim()) {
    statements.push({
      line: text.slice(0, start).split('\n').length,
      text: trailing,
    })
  }
  return statements
}

function normalizeAuthorityStatement(text) {
  return text
    .toLowerCase()
    .replaceAll(/[‐‑‒–—]/g, '-')
    .replaceAll(/[*_`]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

function hasOutcomeMapping(statement, family) {
  const outcome = `(?:${AUTHORITY_OUTCOMES[family]})`
  const forward = new RegExp(
    `(?:\\b(?:is|are|be|becomes?|remains?|stays?|grad(?:e|es|ed)|rat(?:e|es|ed)|` +
      `classif(?:y|ies|ied)|consider(?:s|ed)?|treat(?:s|ed)?|map(?:s|ped)?|` +
      `expect(?:s|ed)?|return(?:s|ed)?|yield(?:s|ed)?|count(?:s|ed)?|` +
      `warrant(?:s|ed)?|rank(?:s|ed)?|means?|outcome|severity)\\b` +
      `\\s*(?:as|to|is|:)?|[-:=]+>?)\\s*\\b${outcome}\\b`,
    'i',
  )
  const reverse = new RegExp(
    `\\b${outcome}\\b\\s+\\b(?:is|to|appl(?:y|ies|ied)|grade|rating|severity|outcome|for|when|means?)\\b`,
    'i',
  )
  return forward.test(statement) || reverse.test(statement)
}

function checkOutcomeAuthority(contract, errors, checked) {
  const families = [
    { name: 'severity', field: 'severityCases', marker: MARKERS.severity },
    { name: 'growth', field: 'growthCases', marker: MARKERS.growth },
  ]
  const declaredIds = new Set(families.flatMap(({ field }) => contract[field].map(({ id }) => id)))
  for (const id of declaredIds) {
    if (!Object.hasOwn(AUTHORITY_TERMS, id)) {
      errors.push(`${CONTRACT_PATH}: authority term registry is missing case ${id}`)
    }
  }
  for (const id of Object.keys(AUTHORITY_TERMS)) {
    if (!declaredIds.has(id)) {
      errors.push(`${CONTRACT_PATH}: authority term registry has unknown case ${id}`)
    }
  }

  for (const consumer of CONSUMERS.filter(({ file }) => file.startsWith('skills/'))) {
    const result = readText(consumer.file, errors)
    if (result.kind !== READ_OK) continue
    let unmarked = result.text
    for (const marker of AUTHORITY_BLOCKS) {
      unmarked = withoutMarkedBlock(unmarked, marker)
    }
    const statements = authorityStatements(unmarked).map(({ line, text }) => ({
      line,
      text: normalizeAuthorityStatement(text),
    }))
    for (const family of families.filter(({ marker }) => consumer.blocks.includes(marker))) {
      for (const { id } of contract[family.field]) {
        const term = AUTHORITY_TERMS[id]
        const mapping = statements.find(
          ({ text }) => term.test(text) && hasOutcomeMapping(text, family.name),
        )
        if (mapping) {
          errors.push(
            `${consumer.file}:${mapping.line}: unmarked ${family.name} outcome mapping for ${id} ` +
              `must use contract block ${family.marker}`,
          )
        }
      }
    }
  }
  checked.push('checked contract severity and growth authority (no unmarked case outcomes)')
}

function checkLegacyConsumers(errors, checked) {
  const canonicalFile = 'reference/sliced-bread.md'
  const canonicalResult = readText(canonicalFile, errors, 'canonical doctrine')
  if (canonicalResult.kind !== READ_OK) {
    if (canonicalResult.kind === READ_MISSING) {
      errors.push(`${canonicalFile}: canonical doctrine is missing (ENOENT)`)
    }
    return
  }
  const canonicalText = canonicalResult.text
  const canonicalBlocks = new Map()
  for (const block of LEGACY_BLOCKS) {
    canonicalBlocks.set(block, extractBlock(canonicalText, block, canonicalFile, errors))
  }
  for (const consumer of LEGACY_CONSUMERS) {
    const result = readText(consumer.file, errors)
    if (result.kind !== READ_OK) {
      if (result.kind === READ_MISSING) {
        for (const block of consumer.blocks) {
          errors.push(
            `${consumer.file}: contract block ${block}: declared consumer is missing (ENOENT)`,
          )
        }
      }
      continue
    }
    const text = result.text
    for (const block of consumer.blocks) {
      const actual = extractBlock(text, block, consumer.file, errors)
      const expected = canonicalBlocks.get(block)
      if (actual !== null && expected !== null && actual !== expected) {
        errors.push(`${consumer.file}: contract block ${block}: diverges from ${canonicalFile}`)
      }
    }
  }
  checked.push('checked authored doctrine blocks (arrows, severity, growth guards)')
}

function checkCatalog(errors, checked) {
  const blocks = []
  for (const file of CATALOG_FILES) {
    const result = readText(file, errors)
    if (result.kind !== READ_OK) {
      if (result.kind === READ_MISSING) {
        errors.push(`${file}: contract block skills:catalog: declared catalog is missing (ENOENT)`)
      }
      continue
    }
    const text = result.text
    const block = extractBlock(text, 'skills:catalog', file, errors)
    if (block === null) continue
    const nonEmptyLines = block.split('\n').filter((line) => line.trim() !== '')
    const parseCells = (line) => {
      const cells = line
        .trim()
        .split('|')
        .map((cell) => cell.trim())
      if (cells[0] === '') cells.shift()
      if (cells.at(-1) === '') cells.pop()
      return cells
    }
    const metadata = nonEmptyLines.slice(0, 2).map(parseCells)
    const header =
      metadata[0]?.length === 2 && metadata[0][0] === 'Tool' && metadata[0][1] === 'Scope'
    const delimiter = metadata[1]?.length === 2 && metadata[1].every((cell) => /^-+$/.test(cell))
    if (!header) {
      errors.push(
        `${file}: contract block skills:catalog: first non-empty row must be the Tool/Scope header`,
      )
    }
    if (!delimiter) {
      errors.push(
        `${file}: contract block skills:catalog: second non-empty row must be the delimiter`,
      )
    }

    const rows = []
    for (const [index, line] of nonEmptyLines.entries()) {
      const cells = parseCells(line)
      if (index < 2) continue
      if (cells.length !== 2) {
        errors.push(
          `${file}: contract block skills:catalog: malformed table row ${JSON.stringify(line)}`,
        )
        rows.push({ tool: null, description: '' })
        continue
      }
      const [firstCell, rawDescription] = cells
      const headerShaped = firstCell.toLowerCase() === 'tool'
      const delimiterShaped = cells.every((cell) => /^-+$/.test(cell))
      if (headerShaped || delimiterShaped) {
        errors.push(
          `${file}: contract block skills:catalog: header or delimiter row is only valid in the first two non-empty rows`,
        )
        rows.push({ tool: null, description: '' })
        continue
      }
      const description = rawDescription.toLowerCase()
      if (!/^`[^`]+`$/.test(firstCell)) {
        errors.push(
          `${file}: contract block skills:catalog: tool cell must be backtick-formatted (${JSON.stringify(firstCell)})`,
        )
        rows.push({ tool: null, description })
        continue
      }
      rows.push({ tool: firstCell.slice(1, -1), description })
    }
    const tools = rows.map(({ tool }) => tool)
    if (
      tools.length !== EXPECTED_TOOLS.length ||
      tools.some((tool, index) => tool !== EXPECTED_TOOLS[index])
    ) {
      errors.push(
        `${file}: contract block skills:catalog: expected exactly four tools ` +
          `(${EXPECTED_TOOLS.join(', ')})`,
      )
    }
    for (const { tool, description } of rows) {
      if (!tool) continue
      if (!description) {
        errors.push(`${file}: contract block skills:catalog: tool ${tool} has an empty description`)
        continue
      }
      for (const term of CATALOG_SCOPE_TERMS[tool] ?? []) {
        if (!description.includes(term)) {
          errors.push(
            `${file}: contract block skills:catalog: tool ${tool} scope description missing ${JSON.stringify(term)}`,
          )
        }
      }
    }
    blocks.push({ file, block })
  }
  if (blocks.length === CATALOG_FILES.length && blocks[0].block !== blocks[1].block) {
    errors.push(`${blocks[1].file}: contract block skills:catalog: diverges from ${blocks[0].file}`)
  }
  checked.push('checked contract skills:catalog (exact four-tool parity)')
}

function normalizeSummary(text) {
  return text
    .toLowerCase()
    .replaceAll(/[‐‑‒–—-]/g, ' ')
    .replaceAll(/\s+/g, ' ')
}

function checkGrowthSummaries(errors, checked) {
  for (const file of GROWTH_SUMMARY_FILES) {
    const result = readText(file, errors)
    if (result.kind !== READ_OK) {
      if (result.kind === READ_MISSING) {
        errors.push(`${file}: growth summary is missing (ENOENT)`)
      }
      continue
    }
    const summary = normalizeSummary(result.text)
    for (const phrase of GROWTH_SUMMARY_REQUIREMENTS) {
      if (!summary.includes(phrase)) {
        errors.push(`${file}: growth summary field guidance: missing ${JSON.stringify(phrase)}`)
      }
    }
    const pressureAt = summary.indexOf('demonstrated pressure')
    const consumersAt = summary.indexOf('two concrete consumers')
    if (pressureAt !== -1 && consumersAt !== -1 && pressureAt > consumersAt) {
      errors.push(
        `${file}: growth summary field guidance: demonstrated pressure must precede two concrete consumers`,
      )
    }
  }
  checked.push('checked contract growth summaries (pressure-first exceptions)')
}

function checkAudit(errors, checked) {
  const result = readText(AUDIT_PATH, errors)
  if (result.kind !== READ_OK) {
    if (result.kind === READ_MISSING) {
      errors.push(`${AUDIT_PATH}: audit source is missing (ENOENT)`)
    }
    return
  }
  const text = result.text
  const match = text.match(/const\s+dimensions\s*=\s*\[([\s\S]*?)\n\s*\]/)
  const dimensions = match ? [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]) : []
  if (!match) {
    errors.push(`${AUDIT_PATH}: audit field dimensions: missing const dimensions declaration`)
  } else if (dimensions.join('\u0000') !== AUDIT_DIMENSIONS.join('\u0000')) {
    errors.push(
      `${AUDIT_PATH}: audit field dimensions: expected ten dimensions ` +
        `(${AUDIT_DIMENSIONS.join(', ')})`,
    )
  }
  for (const label of ['architecture_findings', 'quality_findings']) {
    if (!text.includes(label)) {
      errors.push(`${AUDIT_PATH}: audit field ${label}: missing separate output label`)
    }
  }
  checked.push('checked contract audit dimensions and output labels (10 dimensions)')
}

function sectionBody(text, heading) {
  const headingPattern = /^##\s+(.+?)\s*$/gm
  const headings = []
  let match
  while ((match = headingPattern.exec(text)) !== null) {
    headings.push({ name: match[1], start: match.index, end: headingPattern.lastIndex })
  }
  const current = headings.find((item) => item.name === heading)
  if (!current) return null
  const next = headings.find((item) => item.start > current.start)
  return text.slice(current.end, next ? next.start : text.length).trim()
}

function isIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function checkAdrs(errors, checked) {
  const directory = absolutePath('docs/adr')
  let entries
  try {
    entries = readdirSync(directory, { withFileTypes: true }).filter(
      (entry) => entry.isFile() && entry.name.endsWith('.md'),
    )
  } catch (error) {
    errors.push(`docs/adr: ADR directory is unreadable: ${error.message}`)
    return
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = `docs/adr/${entry.name}`
    const result = readText(file, errors, 'ADR')
    if (result.kind !== READ_OK) {
      if (result.kind === READ_MISSING) {
        errors.push(`${file}: ADR is missing (ENOENT)`)
      }
      continue
    }
    const text = result.text
    const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---\n/)
    const fields = new Map()
    if (!frontmatterMatch) {
      errors.push(`${file}: ADR field frontmatter: missing YAML frontmatter`)
    } else {
      for (const line of frontmatterMatch[1].split('\n')) {
        const field = line.match(/^([a-z_]+):\s*(.+)$/)
        if (field) fields.set(field[1], field[2].trim())
      }
    }
    if (fields.get('status') !== 'accepted') {
      errors.push(`${file}: ADR field status: expected accepted`)
    }
    for (const field of ['date', 'last_verified']) {
      const value = fields.get(field)
      if (!value || !isIsoDate(value)) {
        errors.push(`${file}: ADR field ${field}: expected ISO date YYYY-MM-DD`)
      }
    }
    for (const heading of ['Confirmation', 'References']) {
      const body = sectionBody(text, heading)
      if (!body) {
        errors.push(`${file}: ADR section ${heading}: missing or empty section`)
      }
    }
  }
  checked.push(`checked contract ADR metadata and sections (${entries.length} files)`)
}

function main() {
  const errors = []
  const checked = []
  const contract = loadAndValidateContract(errors)
  if (contract) {
    checked.push('checked contract schema: doctrine-contracts.v1')
    checkConsumers(contract, errors, checked)
    checkOutcomeAuthority(contract, errors, checked)
  }
  checkLegacyConsumers(errors, checked)
  checkCatalog(errors, checked)
  checkGrowthSummaries(errors, checked)
  checkAudit(errors, checked)
  checkAdrs(errors, checked)

  if (errors.length > 0) {
    for (const error of errors) console.error(error)
    return 1
  }
  for (const line of checked) console.log(line)
  console.log('all declared consistency contracts hold')
  return 0
}

process.exitCode = main()
