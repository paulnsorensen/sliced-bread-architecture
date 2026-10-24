// Per-slice baseline ratchet. Every metric is lower-is-better with tolerance 0.
// check compares each slice to its own approved baseline; tighten only lowers caps.
// No command raises a cap: a human edits the CODEOWNERS-owned file for that.

import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { MEASUREMENT_VERSION, greater } from './analyze.mjs'

export const BASELINE_FILE = 'depth-ratchet.json'
export const MODES = ['report', 'block']

/** Ratchet keys: [id, read current value, is fraction]. Order is the report order. */
export const METRICS = [
  ['M08.crust_logic_statements', (m) => m.M08.crust_logic_statements, false],
  ['M08.share', (m) => m.M08.share, true],
  ['M09.public_surface', (m) => m.M09.public_surface, false],
  ['M10.crust_complexity', (m) => m.M10.crust_complexity, false],
  ['M10.share', (m) => m.M10.share, true],
  ['M12.unused_exports', (m) => m.M12.unused_exports, false],
]
const METRIC_IDS = METRICS.map(([id]) => id)

export class BaselineError extends Error {}

const isCount = (v) => Number.isSafeInteger(v) && v >= 0
const isFraction = (v) =>
  typeof v === 'object' &&
  v !== null &&
  isCount(v.num) &&
  isCount(v.den) &&
  v.den > 0 &&
  Object.keys(v).length === 2

export function validate(data, where) {
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    throw new BaselineError(`${where}: expected an object`)
  const allowed = ['version', 'measurement_version', 'mode', 'revision', 'slices']
  const unknown = Object.keys(data).filter((k) => !allowed.includes(k))
  if (unknown.length) throw new BaselineError(`${where}: unknown field(s) ${unknown.join(', ')}`)
  if (data.version !== 1) throw new BaselineError(`${where}: version must be 1`)
  if (data.measurement_version !== MEASUREMENT_VERSION) {
    throw new BaselineError(
      `${where}: measurement_version ${data.measurement_version} does not match this tool (${MEASUREMENT_VERSION}); ` +
        're-baseline by a reviewed human edit',
    )
  }
  if (!MODES.includes(data.mode))
    throw new BaselineError(`${where}: mode must be one of ${MODES.join(', ')}`)
  if (data.revision !== undefined && typeof data.revision !== 'string')
    throw new BaselineError(`${where}: revision must be a string`)
  if (typeof data.slices !== 'object' || data.slices === null || Array.isArray(data.slices)) {
    throw new BaselineError(`${where}: slices must be an object`)
  }
  for (const [name, entry] of Object.entries(data.slices)) {
    if (typeof entry !== 'object' || entry === null)
      throw new BaselineError(`${where}: slices.${name} must be an object`)
    const keys = Object.keys(entry)
    const missing = METRIC_IDS.filter((id) => !keys.includes(id))
    const extra = keys.filter((k) => !METRIC_IDS.includes(k))
    if (missing.length)
      throw new BaselineError(`${where}: slices.${name} is missing ${missing.join(', ')}`)
    if (extra.length)
      throw new BaselineError(`${where}: slices.${name} has unknown metric(s) ${extra.join(', ')}`)
    for (const [id, , frac] of METRICS) {
      const ok = frac ? isFraction(entry[id]) : isCount(entry[id])
      if (!ok)
        throw new BaselineError(
          `${where}: slices.${name}.${id} must be ${frac ? '{num, den} with den > 0' : 'a non-negative integer'}`,
        )
    }
  }
  return data
}

export function loadBaseline(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') throw new BaselineError(`${path}: baseline not found; run init`)
    throw error
  }
  return parseBaseline(text, path)
}

export function parseBaseline(text, where) {
  let data
  try {
    data = JSON.parse(text)
  } catch (error) {
    throw new BaselineError(`${where}: invalid JSON (${error.message})`)
  }
  return validate(data, where)
}

function sortedSlices(slices) {
  return Object.fromEntries(
    Object.keys(slices)
      .sort()
      .map((name) => [name, slices[name]]),
  )
}

export function saveBaseline(path, data) {
  const text = JSON.stringify({ ...data, slices: sortedSlices(data.slices) }, null, 2) + '\n'
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`)
  try {
    writeFileSync(tmp, text, 'utf8')
    renameSync(tmp, path)
  } finally {
    rmSync(tmp, { force: true })
  }
}

export function snapshot(metrics) {
  return Object.fromEntries(METRICS.map(([id, read]) => [id, structuredClone(read(metrics))]))
}

const worse = (frac, value, cap) => (frac ? greater(value, cap) : value > cap)
const show = (frac, v) =>
  frac ? `${v.num}/${v.den} (${v.den ? ((100 * v.num) / v.den).toFixed(1) : '0.0'}%)` : String(v)

/** Compare current metrics with the baseline. Returns the structured report. */
export function compare(baseline, current) {
  const results = []
  const advisories = []
  for (const name of Object.keys(current).sort()) {
    const metrics = current[name]
    const caps = baseline.slices[name]
    if (metrics.advisory.size_aware) {
      advisories.push({
        slice: name,
        metric: 'M08.size-aware',
        crust: metrics.M08.crust_logic_statements,
        share: metrics.M08.share,
      })
    }
    if (!caps) {
      results.push({ slice: name, metric: '*', status: 'new' })
      continue
    }
    for (const [id, read, frac] of METRICS) {
      const value = read(metrics)
      const cap = caps[id]
      const status = worse(frac, value, cap)
        ? 'regressed'
        : worse(frac, cap, value)
          ? 'improved'
          : 'pass'
      const row = { slice: name, metric: id, status, value, baseline: cap }
      if (status === 'regressed' && frac && value.num <= cap.num && value.den < cap.den) {
        row.diagnostic =
          'denominator-shrink: crust share rose because live internal code shrank, not because the crust grew'
      }
      results.push(row)
    }
  }
  for (const name of Object.keys(baseline.slices).sort()) {
    if (!(name in current)) results.push({ slice: name, metric: '*', status: 'orphan' })
  }
  const failed = results.filter((r) => r.status === 'regressed' || r.status === 'orphan')
  const coverage = Object.keys(current)
    .sort()
    .map((name) => ({
      slice: name,
      unmeasured: current[name].coverage.unmeasured_files,
      dynamic: current[name].coverage.dynamic_access.length,
    }))
    .filter((c) => c.unmeasured.length || c.dynamic)
  return { mode: baseline.mode, pass: failed.length === 0, results, advisories, coverage }
}

export function formatReport(report) {
  const lines = []
  for (const r of report.results) {
    const frac = typeof r.value === 'object'
    if (r.status === 'regressed' || r.status === 'improved') {
      lines.push(
        `${r.slice} ${r.metric} ${r.status} ${show(frac, r.baseline)} -> ${show(frac, r.value)}`,
      )
      if (r.diagnostic) lines.push(`  ${r.diagnostic}`)
    } else if (r.status === 'orphan') {
      lines.push(`${r.slice} * orphan: baseline names a slice that slices.toml no longer declares`)
    } else if (r.status === 'new') {
      lines.push(`${r.slice} * new: no baseline; advisory only (adopt with tighten --adopt-new)`)
    }
  }
  for (const a of report.advisories) {
    lines.push(
      `${a.slice} ${a.metric} advisory: ${a.crust} crust logic statements, share ${show(true, a.share)} (never blocks)`,
    )
  }
  for (const c of report.coverage ?? []) {
    const parts = []
    if (c.unmeasured.length) parts.push(`unmeasured files ${c.unmeasured.join(', ')}`)
    if (c.dynamic) parts.push(`reachability partial (${c.dynamic} dynamic access(es))`)
    lines.push(`${c.slice} coverage: ${parts.join('; ')}`)
  }
  const verdict = report.pass
    ? 'pass'
    : report.mode === 'block'
      ? 'FAIL (mode block)'
      : 'regressions reported (mode report: not blocking)'
  lines.push(`depth-ratchet: ${verdict}`)
  return lines.join('\n')
}

/** A share that improved only because the denominator grew: the crust did not shrink. */
const denominatorDriven = (r) => typeof r.value === 'object' && r.value.num >= r.baseline.num

/**
 * Lower caps to improved values. Refuses, and writes nothing, on any regression or orphan.
 * A denominator-driven share gain is held unless acceptDenominator is set: internal growth
 * (or padding) lowers a share with no crust change, and a cap set from it can later block
 * the removal of that code. A human decides those.
 */
export function tighten(baseline, current, { adoptNew = false, acceptDenominator = false } = {}) {
  const report = compare(baseline, current)
  if (!report.pass) return { written: false, refused: true, report, changes: [], held: [] }
  const slices = structuredClone(baseline.slices)
  const changes = []
  const held = []
  for (const r of report.results) {
    if (r.status === 'improved' && denominatorDriven(r) && !acceptDenominator) {
      held.push({ slice: r.slice, metric: r.metric, from: r.baseline, to: r.value })
    } else if (r.status === 'improved') {
      slices[r.slice][r.metric] = structuredClone(r.value)
      changes.push({ slice: r.slice, metric: r.metric, from: r.baseline, to: r.value })
    } else if (r.status === 'new' && adoptNew) {
      slices[r.slice] = snapshot(current[r.slice])
      changes.push({ slice: r.slice, metric: '*', from: null, to: slices[r.slice] })
    }
  }
  return {
    written: changes.length > 0,
    refused: false,
    report,
    changes,
    held,
    baseline: { ...baseline, slices },
  }
}

export function initBaseline(path, current, revision) {
  if (existsSync(path))
    throw new BaselineError(`${path}: baseline exists; init never overwrites it`)
  const slices = Object.fromEntries(Object.entries(current).map(([name, m]) => [name, snapshot(m)]))
  const data = { version: 1, measurement_version: MEASUREMENT_VERSION, mode: 'report', slices }
  if (revision) data.revision = revision
  saveBaseline(path, data)
  return data
}

/** Loosening between a base baseline and the head baseline. Used to brief human reviewers. */
export function loosening(base, head) {
  if (base === null)
    return [
      { kind: 'initialization', detail: 'no baseline at the base revision; the whole file is new' },
    ]
  const findings = []
  if (base.mode === 'block' && head.mode === 'report')
    findings.push({ kind: 'mode-relaxed', detail: 'block -> report' })
  if (base.measurement_version !== head.measurement_version) {
    findings.push({
      kind: 'measurement-changed',
      detail: `${base.measurement_version} -> ${head.measurement_version}`,
    })
  }
  for (const name of Object.keys(base.slices).sort()) {
    const before = base.slices[name]
    const after = head.slices[name]
    if (!after) {
      findings.push({ kind: 'slice-removed', slice: name })
      continue
    }
    for (const [id, , frac] of METRICS) {
      if (!(id in after)) findings.push({ kind: 'metric-removed', slice: name, metric: id })
      else if (worse(frac, after[id], before[id])) {
        findings.push({
          kind: 'cap-raised',
          slice: name,
          metric: id,
          from: before[id],
          to: after[id],
        })
      }
    }
  }
  return findings
}
