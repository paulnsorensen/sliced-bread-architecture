#!/usr/bin/env node
// sliced-bread-depth-ratchet: per-slice depth metrics and a baseline ratchet.
// Exit codes: 0 pass (or mode report), 1 gate failure (mode block) or refused tighten, 2 input error.

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { AnalysisError, MEASUREMENT_VERSION, SIZE_AWARE, analyze } from './lib/analyze.mjs'
import {
  BASELINE_FILE,
  BaselineError,
  compare,
  formatReport,
  initBaseline,
  loadBaseline,
  loosening,
  parseBaseline,
  saveBaseline,
  tighten,
} from './lib/ratchet.mjs'
import { ConfigError, loadSlices } from './lib/slices.mjs'

const USAGE = `usage: depth-ratchet.mjs <measure|check|tighten|init|diff-baseline> [options]
  --root <dir>        repository root holding slices.toml (default: cwd)
  --baseline <path>   baseline file (default: <root>/${BASELINE_FILE})
  --json              print structured JSON instead of text
  --adopt-new         tighten: add a baseline for slices that have none
  --accept-denominator-gains
                      tighten: also lower share caps that improved only through internal growth
  --revision <rev>    init/tighten: record the source revision
  --base <git-ref>    diff-baseline: compare the baseline with the one at this revision`

function measure(root) {
  return analyze(root, loadSlices(root))
}

function pct(f) {
  return `${((100 * f.num) / f.den).toFixed(1)}%`
}

function catalog(current) {
  const rows = [
    'slice | shape | M08 crust/slice stmts (share) | M09 surface (v/t/d) | M10 crust/slice CC (share) | M12 unused | dead stmts | module init (crust) | advisory',
  ]
  for (const [name, m] of Object.entries(current)) {
    rows.push(
      [
        name,
        m.shape,
        `${m.M08.crust_logic_statements}/${m.M08.slice_logic_statements} (${pct(m.M08.share)})`,
        `${m.M09.public_surface} (${m.M09.values}/${m.M09.types}/${m.M09.dual})`,
        `${m.M10.crust_complexity}/${m.M10.slice_complexity} (${pct(m.M10.share)})`,
        `${m.M12.unused_exports}${m.M12.names.length ? ' ' + m.M12.names.join(',') : ''}`,
        `${m.dead_code.excluded_statements} (${m.coverage.reachability}${m.coverage.unmeasured_files.length ? `, ${m.coverage.unmeasured_files.length} unmeasured` : ''})`,
        String(m.module_init.crust),
        m.advisory.size_aware ? 'M08.size-aware' : '-',
      ].join(' | '),
    )
  }
  rows.push(
    `size-aware advisory: crust > ${SIZE_AWARE.crustLogicStatements} logic statements and share > ${pct(SIZE_AWARE.share)}; never blocks`,
  )
  return rows.join('\n')
}

function baseAt(root, ref, file) {
  let text
  try {
    text = execFileSync('git', ['show', `${ref}:${file}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const stderr = String(error.stderr ?? '')
    if (/does not exist|exists on disk, but not in/.test(stderr)) return null
    throw new BaselineError(`git show ${ref}:${file} failed: ${stderr.trim() || error.message}`)
  }
  return parseBaseline(text, `${ref}:${file}`)
}

function run(argv) {
  const { values: opts, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      root: { type: 'string' },
      baseline: { type: 'string' },
      json: { type: 'boolean', default: false },
      'adopt-new': { type: 'boolean', default: false },
      'accept-denominator-gains': { type: 'boolean', default: false },
      revision: { type: 'string' },
      base: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  })
  const [command] = positionals
  if (opts.help || !command) {
    console.log(USAGE)
    return opts.help ? 0 : 2
  }
  const root = resolve(opts.root ?? '.')
  const baselinePath = resolve(root, opts.baseline ?? BASELINE_FILE)
  const out = (json, text) => console.log(opts.json ? JSON.stringify(json, null, 2) : text)

  switch (command) {
    case 'measure': {
      const current = measure(root)
      out({ measurement_version: MEASUREMENT_VERSION, slices: current }, catalog(current))
      return 0
    }
    case 'check': {
      const baseline = loadBaseline(baselinePath)
      const report = compare(baseline, measure(root))
      out(report, formatReport(report))
      return report.pass || baseline.mode === 'report' ? 0 : 1
    }
    case 'tighten': {
      const baseline = loadBaseline(baselinePath)
      const result = tighten(baseline, measure(root), {
        adoptNew: opts['adopt-new'],
        acceptDenominator: opts['accept-denominator-gains'],
      })
      if (result.written) {
        saveBaseline(baselinePath, {
          ...result.baseline,
          ...(opts.revision ? { revision: opts.revision } : {}),
        })
      }
      const lines = [
        ...result.changes.map((c) => `${c.slice} ${c.metric} tightened`),
        ...result.held.map(
          (h) =>
            `${h.slice} ${h.metric} held: denominator-driven gain; review it, then rerun with --accept-denominator-gains`,
        ),
      ]
      const text = result.refused
        ? `${formatReport(result.report)}\ntighten refused: fix the regressions first; nothing written`
        : lines.length
          ? lines.join('\n')
          : 'tighten: nothing improved; nothing written'
      out(
        {
          written: result.written,
          refused: result.refused,
          changes: result.changes,
          held: result.held,
          report: result.report,
        },
        text,
      )
      return result.refused ? 1 : 0
    }
    case 'init': {
      const data = initBaseline(baselinePath, measure(root), opts.revision)
      out(data, `wrote ${baselinePath} (mode report, ${Object.keys(data.slices).length} slices)`)
      return 0
    }
    case 'diff-baseline': {
      if (!opts.base) throw new BaselineError('diff-baseline requires --base <git-ref>')
      const head = loadBaseline(baselinePath)
      const rel = baselinePath.startsWith(root + '/')
        ? baselinePath.slice(root.length + 1)
        : baselinePath
      const findings = loosening(baseAt(root, opts.base, rel), head)
      const text = findings.length
        ? findings
            .map(
              (f) =>
                `loosening ${f.kind} ${[f.slice, f.metric, f.detail].filter(Boolean).join(' ')}`,
            )
            .join('\n')
        : 'diff-baseline: no loosening'
      out({ findings }, text)
      return 0
    }
    default:
      console.error(USAGE)
      return 2
  }
}

try {
  process.exitCode = run(process.argv.slice(2))
} catch (error) {
  if (
    error instanceof ConfigError ||
    error instanceof BaselineError ||
    error instanceof AnalysisError ||
    error.code?.startsWith?.('ERR_PARSE_ARGS')
  ) {
    console.error(`depth-ratchet: ${error.message}`)
    process.exitCode = 2
  } else throw error
}
