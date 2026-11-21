import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIT_SCRIPT = 'skills/sliced-bread-audit/sliced-bread-audit.js'
const AUDIT_README = 'skills/sliced-bread-audit/README.md'
const BUG_TEMPLATE = '.github/ISSUE_TEMPLATE/bug_report.yml'

const read = (file) => readFile(join(ROOT, file), 'utf8')

function argRow(readme, name) {
  const row = readme.split('\n').find((line) => line.startsWith(`| \`${name}\``))
  assert.ok(row, `${AUDIT_README}: missing args table row for ${name}`)
  return row
}

test('audit README documents every arg default and range the script enforces', async () => {
  const [script, readme] = await Promise.all([read(AUDIT_SCRIPT), read(AUDIT_README)])
  const defaults = {
    scope: script.match(/const SCOPE = \(opts\.scope \|\| '([^']+)'\)/)?.[1],
    min_severity: script.match(/const MIN_SEVERITY = opts\.min_severity \|\| '([^']+)'/)?.[1],
    dry_run: script.match(/const DRY_RUN = opts\.dry_run === true/) ? 'false' : undefined,
    max_issues: script.match(/const MAX_ISSUES = .*\? (\d+) :/)?.[1],
    max_candidates: script.match(/const MAX_CANDIDATES = .*\? (\d+) :/)?.[1],
    workers: script.match(/const WORKERS = .*\? (\d+) :/)?.[1],
  }
  for (const [name, value] of Object.entries(defaults)) {
    assert.ok(value, `${AUDIT_SCRIPT}: could not derive the ${name} default`)
    assert.ok(
      argRow(readme, name).includes(`\`${value}\``),
      `${AUDIT_README}: ${name} row must document default \`${value}\``,
    )
  }
  const ranges = [...script.matchAll(/`(\w+) must be an integer from (\d+) to (\d+)/g)]
  assert.ok(ranges.length > 0, `${AUDIT_SCRIPT}: could not derive integer ranges`)
  for (const [, name, low, high] of ranges) {
    assert.ok(
      argRow(readme, name).includes(`from ${low} to ${high}`),
      `${AUDIT_README}: ${name} row must document range from ${low} to ${high}`,
    )
  }
  assert.match(readme, /\{ error: \.\.\. \}/, `${AUDIT_README}: must say invalid args abort`)
})

test('audit README install command uses a repository-root-relative path', async () => {
  const readme = await read(AUDIT_README)
  const copies = readme.split('\n').filter((line) => line.startsWith('cp '))
  assert.ok(copies.length > 0, `${AUDIT_README}: no install command found`)
  for (const line of copies) {
    assert.match(line, /^cp (-r )?skills\//, `${AUDIT_README}: ${line}`)
  }
})

test('bug report template asks only for values this repository can supply', async () => {
  const template = await read(BUG_TEMPLATE)
  assert.doesNotMatch(template, /--version/, `${BUG_TEMPLATE}: the repo ships no CLI`)
  assert.doesNotMatch(template, /latest released version/, `${BUG_TEMPLATE}: there are no releases`)
  assert.match(template, /label: Commit SHA or site URL/)
})
