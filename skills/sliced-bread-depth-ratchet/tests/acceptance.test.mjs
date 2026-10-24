// Acceptance: the real CLI, the real TypeScript compiler API, and real git, on fixture code.
// Run: (cd skills/sliced-bread-depth-ratchet && npm ci && npm test)

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  CALIBRATION_SLICES,
  engineCrust,
  engineEvent,
  engineWeights,
  widgetsCrust,
} from './calibration.mjs'
import { parseSlices } from '../scripts/lib/slices.mjs'

const SKILL = fileURLToPath(new URL('..', import.meta.url))
const FIXTURE = join(SKILL, 'fixtures', 'ts-depth')
const CLI = join(SKILL, 'scripts', 'depth-ratchet.mjs')
const SCRATCH = mkdtempSync(join(tmpdir(), 'depth-ratchet-'))
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
}
const ORDERS = 'src/domains/orders'
const PRICING = 'src/domains/pricing'
let counter = 0

after(() => rmSync(SCRATCH, { recursive: true, force: true }))

const git = (root, ...args) =>
  execFileSync('git', args, { cwd: root, env: GIT_ENV, encoding: 'utf8' })

function cli(root, ...args) {
  const run = spawnSync(process.execPath, [CLI, ...args, '--root', root], { encoding: 'utf8' })
  return { code: run.status, out: run.stdout + run.stderr, stdout: run.stdout }
}

const read = (root, path) => readFileSync(join(root, path), 'utf8')
function write(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), text)
}
function edit(root, path, from, to) {
  const before = read(root, path)
  assert.ok(before.includes(from), `${path} does not contain ${JSON.stringify(from)}`)
  write(root, path, before.split(from).join(to))
}

/** A fresh git repo holding the fixture plus an adopted baseline (block mode unless told otherwise). */
function repo({ mode = 'block' } = {}) {
  const root = join(SCRATCH, `repo-${++counter}`)
  cpSync(FIXTURE, root, { recursive: true })
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', 'fixture')
  const init = cli(root, 'init', '--revision', 'fixture')
  assert.equal(init.code, 0, init.out)
  const baseline = JSON.parse(read(root, 'depth-ratchet.json'))
  baseline.mode = mode
  write(root, 'depth-ratchet.json', JSON.stringify(baseline, null, 2) + '\n')
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', 'adopt depth ratchet')
  return root
}

function measure(root) {
  const run = cli(root, 'measure', '--json')
  assert.equal(run.code, 0, run.out)
  return JSON.parse(run.stdout).slices
}

function check(root) {
  const run = cli(root, 'check', '--json')
  const text = cli(root, 'check')
  return { ...run, report: JSON.parse(run.stdout), text: text.out }
}

/** Every number the tool reports, without labels that legitimately change (unit names, line numbers). */
function numbers(slices) {
  // `files` counts modules (context for the catalog), so splitting a file changes it by design.
  const strip = ({
    dead_code: { units, ...dead },
    coverage: { dynamic_access, ...coverage },
    M12: { names, ...m12 },
    files,
    ...rest
  }) => ({
    ...rest,
    M12: m12,
    dead_code: dead,
    coverage: { ...coverage, dynamic: dynamic_access.length },
  })
  return Object.fromEntries(Object.entries(slices).map(([name, m]) => [name, strip(m)]))
}

const regressed = (report) =>
  report.results.filter((r) => r.status === 'regressed').map((r) => `${r.slice} ${r.metric}`)

function assertFails(root, expected) {
  const result = check(root)
  assert.equal(result.code, 1, result.text)
  for (const id of expected) {
    assert.ok(
      regressed(result.report).includes(id),
      `expected ${id} to regress; got ${regressed(result.report).join(', ')}`,
    )
    const [slice, metric] = id.split(' ')
    assert.match(result.text, new RegExp(`^${slice} ${metric.replace('.', '\\.')} regressed `, 'm'))
  }
  return result
}

function assertUnchanged(root, before, mutate) {
  mutate(root)
  assert.deepEqual(numbers(measure(root)), numbers(before))
  const result = check(root)
  assert.equal(result.code, 0, result.text)
  assert.equal(result.report.pass, true)
}

const lines = (text) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0)

describe('baseline fixture', () => {
  test('measures the hand-counted values', () => {
    const slices = measure(repo())
    assert.deepEqual(slices.orders.M08, {
      crust_logic_statements: 2,
      slice_logic_statements: 25,
      share: { num: 2, den: 25 },
    })
    assert.deepEqual(slices.orders.M10, {
      crust_complexity: 1,
      slice_complexity: 14,
      share: { num: 1, den: 14 },
    })
    assert.deepEqual(slices.orders.M09, { public_surface: 4, values: 2, types: 2, dual: 0 })
    assert.deepEqual(slices.orders.M12, { unused_exports: 0, names: [] })
    assert.deepEqual(slices.pricing.M08, {
      crust_logic_statements: 6,
      slice_logic_statements: 14,
      share: { num: 6, den: 14 },
    })
    assert.deepEqual(slices.pricing.M10, {
      crust_complexity: 3,
      slice_complexity: 9,
      share: { num: 3, den: 9 },
    })
    assert.deepEqual(
      slices.pricing.coverage,
      { reachability: 'static', dynamic_access: [], unmeasured_files: [] },
      'TIERS[tier] has a string-literal union key, so it resolves by name',
    )
  })
})

describe('calibration (skills/sliced-bread-depth/SKILL.md:68-70)', () => {
  // The calibration slices arrive after adoption, so they have no baseline (new slices).
  const root = repo()
  write(root, 'src/domains/widgets/index.ts', widgetsCrust())
  write(root, 'src/domains/engine/index.ts', engineCrust())
  write(root, 'src/domains/engine/event.ts', engineEvent())
  write(root, 'src/domains/engine/weights.ts', engineWeights())
  write(root, 'slices.toml', read(root, 'slices.toml') + CALIBRATION_SLICES)
  const slices = measure(root)

  test('the fixtures are the doctrine cases: 250-line and 900-line crusts', () => {
    assert.equal(lines(read(root, 'src/domains/widgets/index.ts')), 250)
    assert.equal(lines(read(root, 'src/domains/engine/index.ts')), 900)
  })

  test('a 250-line pure-factory leaf slice at 100% crust is healthy', () => {
    const w = slices.widgets
    assert.deepEqual(w.M08, {
      crust_logic_statements: 24,
      slice_logic_statements: 24,
      share: { num: 24, den: 24 },
    })
    assert.equal(w.advisory.size_aware, false)
  })

  test('a 900-line crust holding 85% of its slice is flagged', () => {
    const e = slices.engine
    assert.deepEqual(e.M08, {
      crust_logic_statements: 703,
      slice_logic_statements: 828,
      share: { num: 703, den: 828 },
    })
    assert.equal(((100 * 703) / 828).toFixed(1), '84.9')
    assert.equal(e.advisory.size_aware, true)
  })

  test('the size-aware rule is advisory: new slices never fail, even in block mode', () => {
    const result = check(root)
    assert.equal(result.code, 0, result.text)
    assert.deepEqual(
      result.report.advisories.map((a) => a.slice),
      ['engine'],
    )
    assert.match(result.text, /^engine M08\.size-aware advisory: 703 crust logic statements/m)
    assert.match(result.text, /^widgets \* new: no baseline; advisory only/m)
  })
})

describe('should-move mutations fail with slice and metric ID', () => {
  test('inline an internal function into the crust', () => {
    const root = repo()
    write(
      root,
      `${ORDERS}/index.ts`,
      read(root, `${ORDERS}/index.ts`)
        .replace("import { summarize } from './summary'\n", '')
        .replace(
          '  const summary = summarize(order)\n',
          [
            '  const count = order.lines.length',
            "  const noun = count === 1 ? 'line' : 'lines'",
            '  const big = order.lines.some((line) => line.qty > 10)',
            '  const summary = big ? `${count} ${noun}, bulk` : `${count} ${noun}`',
            '',
          ].join('\n'),
        ),
    )
    rmSync(join(root, `${ORDERS}/summary.ts`))
    assertFails(root, [
      'orders M08.crust_logic_statements',
      'orders M08.share',
      'orders M10.crust_complexity',
      'orders M10.share',
    ])
  })

  test('add a branching hot loop to the crust', () => {
    const root = repo()
    edit(
      root,
      `${ORDERS}/index.ts`,
      '  return `${order.id}: ${summary}`',
      [
        '  let weight = 0',
        '  for (const line of order.lines) {',
        '    if (line.qty > 100) weight += line.qty * 2',
        '    else if (line.sku.startsWith("x")) weight -= 1',
        '  }',
        '  return `${order.id}: ${summary} (${weight})`',
      ].join('\n'),
    )
    assertFails(root, ['orders M08.crust_logic_statements', 'orders M10.crust_complexity'])
  })

  test('add exports to the crust (used by app: surface grows, unused stays 0)', () => {
    const root = repo()
    edit(
      root,
      `${ORDERS}/index.ts`,
      "export { placeOrder } from './place'",
      "export { placeOrder } from './place'\nexport { lineTotal } from './model'",
    )
    edit(
      root,
      'src/app/checkout.ts',
      'describeOrder, placeOrder,',
      'describeOrder, lineTotal, placeOrder,',
    )
    edit(
      root,
      'src/app/checkout.ts',
      '  return order.length',
      '  return order.length + lineTotal(order[0])',
    )
    const result = assertFails(root, ['orders M09.public_surface'])
    assert.ok(!regressed(result.report).includes('orders M12.unused_exports'))
  })

  test('add an unused crust export', () => {
    const root = repo()
    edit(
      root,
      `${ORDERS}/index.ts`,
      "export { placeOrder } from './place'",
      "export { placeOrder } from './place'\nexport const ORDER_PREFIX = 'ord-'",
    )
    const result = assertFails(root, ['orders M09.public_surface', 'orders M12.unused_exports'])
    assert.deepEqual(
      result.report.results.find((r) => r.metric === 'M12.unused_exports' && r.slice === 'orders')
        .value,
      1,
    )
    assert.deepEqual(measure(root).orders.M12.names, [`${ORDERS}/index.ts#ORDER_PREFIX`])
  })
})

describe('should-not-move mutations leave every metric unchanged', () => {
  const base = repo()
  const before = measure(base)
  const fresh = () => {
    const root = join(SCRATCH, `copy-${++counter}`)
    cpSync(base, root, { recursive: true })
    return root
  }

  test('rename a symbol (internal and crust export, all call sites)', () => {
    assertUnchanged(fresh(), before, (root) => {
      for (const path of [`${ORDERS}/validate.ts`, `${ORDERS}/place.ts`])
        edit(root, path, 'validateLines', 'checkLines')
      for (const path of [
        `${ORDERS}/place.ts`,
        `${ORDERS}/index.ts`,
        `${ORDERS}/order.test.ts`,
        'src/app/checkout.ts',
      ]) {
        edit(root, path, 'placeOrder', 'submitOrder')
      }
    })
  })

  test('reformat every source file with the TypeScript printer (trivia-only change)', () => {
    assertUnchanged(fresh(), before, (root) => {
      const printer = ts.createPrinter({ newLine: ts.NewLineKind.CarriageReturnLineFeed })
      const walk = (dir) =>
        readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
          e.isDirectory()
            ? walk(`${dir}/${e.name}`)
            : e.name.endsWith('.ts')
              ? [`${dir}/${e.name}`]
              : [],
        )
      for (const path of walk('src')) {
        const sf = ts.createSourceFile(path, read(root, path), ts.ScriptTarget.Latest, true)
        const printed = printer.printFile(sf).replace(/\r\n/g, '\r\n\r\n')
        assert.notEqual(printed, read(root, path))
        write(root, path, printed)
      }
    })
  })

  test('split an internal file in two', () => {
    assertUnchanged(fresh(), before, (root) => {
      edit(
        root,
        `${ORDERS}/model.ts`,
        'export function lineTotal(line: OrderLine): Cents {\n  return line.qty * line.unit\n}\n',
        '',
      )
      write(
        root,
        `${ORDERS}/line-total.ts`,
        "import type { Cents } from '../common/money'\nimport type { OrderLine } from './model'\n\n" +
          'export function lineTotal(line: OrderLine): Cents {\n  return line.qty * line.unit\n}\n',
      )
      edit(
        root,
        `${ORDERS}/place.ts`,
        "import { lineTotal, type Order, type OrderLine } from './model'",
        "import { lineTotal } from './line-total'\nimport type { Order, OrderLine } from './model'",
      )
    })
  })

  test('add a test file', () => {
    assertUnchanged(fresh(), before, (root) => {
      write(
        root,
        `${PRICING}/discount.test.ts`,
        "import { applyDiscount } from './discount'\nimport { priceLabel } from './index'\n\n" +
          "for (const customer of ['vip-a', 'club-b', 'c']) {\n  if (applyDiscount(10000, customer) > 10000) throw new Error(customer)\n}\n" +
          "if (priceLabel(105, 'EUR') !== '1,05 EUR') throw new Error('label')\n",
      )
    })
  })
})

describe('gaming mutations are caught', () => {
  test('padding internals with dead code does not lower the share', () => {
    const root = repo()
    const before = measure(root)
    write(
      root,
      `${ORDERS}/padding.ts`,
      'export function padA(n: number): number {\n  let t = 0\n  for (let i = 0; i < n; i++) {\n    if (i % 2) t += padB(i)\n  }\n  return t\n}\n\n' +
        'function padB(n: number): number {\n  return n > 1 ? padA(n - 1) : 0\n}\n',
    )
    write(
      root,
      `${ORDERS}/side-effect.ts`,
      'export function neverCalled(): number {\n  const x = 1\n  return x + 1\n}\n',
    )
    edit(
      root,
      `${ORDERS}/place.ts`,
      "import { validateLines } from './validate'",
      "import { validateLines } from './validate'\nimport './side-effect'",
    )
    edit(
      root,
      `${ORDERS}/validate.ts`,
      '  return problems\n}\n',
      '  function unusedHelper(): number {\n    let n = 0\n    while (n < 10) n++\n    return n\n  }\n  return problems\n}\n\n' +
        'export function legacyValidate(lines: OrderLine[]): boolean {\n  for (const line of lines) {\n    if (line.qty < 0) return false\n  }\n  return true\n}\n',
    )
    const after = measure(root)
    assert.deepEqual(after.orders.M08, before.orders.M08)
    assert.deepEqual(after.orders.M10, before.orders.M10)
    assert.ok(
      after.orders.dead_code.excluded_statements >= 12,
      JSON.stringify(after.orders.dead_code),
    )
    assert.deepEqual(after.orders.dead_code.units, [
      `${ORDERS}/padding.ts#padA`,
      `${ORDERS}/padding.ts#padB`,
      `${ORDERS}/side-effect.ts#neverCalled`,
      `${ORDERS}/validate.ts#legacyValidate`,
      `${ORDERS}/validate.ts#unusedHelper`,
    ])
    assert.equal(check(root).code, 0)
  })

  test('improving one slice while another regresses still fails (no sums)', () => {
    const root = repo()
    const before = measure(root)
    extractPriceLabel(root)
    edit(
      root,
      `${ORDERS}/index.ts`,
      '  return `${order.id}: ${summary}`',
      '  let n = 0\n  for (const line of order.lines) n += line.qty\n  return `${order.id}: ${summary} ${n}`',
    )
    const after = measure(root)
    const total = (s) => s.orders.M08.crust_logic_statements + s.pricing.M08.crust_logic_statements
    assert.ok(total(after) < total(before), 'a sum over slices would have passed this change')
    const result = assertFails(root, ['orders M08.crust_logic_statements'])
    assert.ok(
      result.report.results.some(
        (r) =>
          r.slice === 'pricing' &&
          r.metric === 'M08.crust_logic_statements' &&
          r.status === 'improved',
      ),
    )
  })
})

function extractPriceLabel(root) {
  const crust = read(root, `${PRICING}/index.ts`)
  const start = crust.indexOf('export function priceLabel')
  write(
    root,
    `${PRICING}/label.ts`,
    "import type { Cents } from '../common/money'\n\n" + crust.slice(start),
  )
  write(
    root,
    `${PRICING}/index.ts`,
    crust.slice(0, start).replace("import type { Cents } from '../common/money'\n", '') +
      "export { priceLabel } from './label'\n",
  )
}

describe('tighten', () => {
  test('lowers a baseline after a real improvement and the gate then holds the gain', () => {
    const root = repo()
    extractPriceLabel(root)
    const run = cli(root, 'tighten', '--json')
    assert.equal(run.code, 0, run.out)
    const baseline = JSON.parse(read(root, 'depth-ratchet.json'))
    assert.equal(baseline.slices.pricing['M08.crust_logic_statements'], 0)
    assert.deepEqual(baseline.slices.pricing['M10.crust_complexity'], 0)
    assert.equal(
      baseline.slices.orders['M08.crust_logic_statements'],
      2,
      'other slices keep their caps',
    )
    assert.equal(check(root).code, 0)
    git(root, 'checkout', '--', `${PRICING}/index.ts`)
    rmSync(join(root, `${PRICING}/label.ts`))
    assertFails(root, ['pricing M08.crust_logic_statements', 'pricing M10.crust_complexity'])
  })

  test('never raises: refuses on any regression and writes nothing', () => {
    const root = repo()
    const bytes = read(root, 'depth-ratchet.json')
    extractPriceLabel(root)
    edit(
      root,
      `${ORDERS}/index.ts`,
      "export { placeOrder } from './place'",
      "export { placeOrder } from './place'\nexport const EXTRA = 1",
    )
    const run = cli(root, 'tighten')
    assert.equal(run.code, 1)
    assert.match(run.out, /tighten refused/)
    assert.equal(read(root, 'depth-ratchet.json'), bytes)
  })

  test('writes nothing when nothing improved', () => {
    const root = repo()
    const bytes = read(root, 'depth-ratchet.json')
    const run = cli(root, 'tighten')
    assert.equal(run.code, 0)
    assert.match(run.out, /nothing improved/)
    assert.equal(read(root, 'depth-ratchet.json'), bytes)
  })

  test('adopts a new slice only with --adopt-new', () => {
    const root = repo()
    write(root, 'src/domains/widgets/index.ts', widgetsCrust())
    write(
      root,
      'slices.toml',
      read(root, 'slices.toml') +
        CALIBRATION_SLICES.split('[[slice]]')[1].replace(/^/, '[[slice]]'),
    )
    cli(root, 'tighten')
    assert.equal(JSON.parse(read(root, 'depth-ratchet.json')).slices.widgets, undefined)
    assert.equal(cli(root, 'tighten', '--adopt-new').code, 0)
    assert.equal(
      JSON.parse(read(root, 'depth-ratchet.json')).slices.widgets['M08.crust_logic_statements'],
      24,
    )
  })
})

describe('modes and diagnostics', () => {
  test('report mode (the default) prints regressions and exits 0', () => {
    const root = repo({ mode: 'report' })
    edit(
      root,
      `${ORDERS}/index.ts`,
      "export { placeOrder } from './place'",
      "export { placeOrder } from './place'\nexport const EXTRA = 1",
    )
    const result = check(root)
    assert.equal(result.code, 0)
    assert.equal(result.report.pass, false)
    assert.match(result.text, /^orders M09\.public_surface regressed 4 -> 5$/m)
    assert.match(result.text, /mode report: not blocking/)
  })

  test('a share regression from shrinking internals names the denominator shrink', () => {
    const root = repo()
    edit(
      root,
      `${ORDERS}/validate.ts`,
      '    } else if (line.qty > 1000) {\n      problems.push(`${line.sku}: quantity too large`)\n    }',
      '    }',
    )
    const result = assertFails(root, ['orders M08.share'])
    assert.ok(!regressed(result.report).includes('orders M08.crust_logic_statements'))
    assert.match(result.text, /denominator-shrink/)
  })

  test('an orphaned baseline slice fails, so renaming a slice cannot drop its baseline', () => {
    const root = repo()
    edit(root, 'slices.toml', 'name = "pricing"', 'name = "prices"')
    edit(
      root,
      'slices.toml',
      '"pricing", "common"]\nrequires = ["pricing"]',
      '"prices", "common"]\nrequires = ["prices"]',
    )
    edit(
      root,
      'slices.toml',
      'may_depend_on = ["orders", "pricing", "common"]',
      'may_depend_on = ["orders", "prices", "common"]',
    )
    const result = check(root)
    assert.equal(result.code, 1, result.text)
    assert.match(result.text, /^pricing \* orphan/m)
  })
})

describe('classification and export provenance', () => {
  test('test-pattern files reached from production code count, transitively', () => {
    const root = repo()
    write(
      root,
      `${ORDERS}/helpers.test.ts`,
      "import { deeper } from './deeper.test'\n\nexport function hidden(n: number): number {\n  const m = deeper(n)\n  return m + 1\n}\n",
    )
    write(
      root,
      `${ORDERS}/deeper.test.ts`,
      'export function deeper(n: number): number {\n  return n * 2\n}\n',
    )
    edit(
      root,
      `${ORDERS}/summary.ts`,
      '  const count = order.lines.length',
      '  const count = hidden(order.lines.length) - 1',
    )
    edit(
      root,
      `${ORDERS}/summary.ts`,
      "import type { Order } from './model'",
      "import type { Order } from './model'\nimport { hidden } from './helpers.test'",
    )
    assert.equal(measure(root).orders.M08.slice_logic_statements, 25 + 3)
  })

  test('an internal-path bypass does not count as use of the crust export', () => {
    const root = repo()
    edit(
      root,
      'src/app/checkout.ts',
      'describeOrder, placeOrder, type Order',
      'describeOrder, type Order',
    )
    edit(
      root,
      'src/app/checkout.ts',
      "import * as pricing from '../domains/pricing'",
      "import * as pricing from '../domains/pricing'\nimport { placeOrder } from '../domains/orders/place'",
    )
    assert.deepEqual(measure(root).orders.M12.names, [`${ORDERS}/index.ts#placeOrder`])
  })

  test('renamed re-exports, export *, namespace access, type imports, and unreferenced bindings', () => {
    const root = repo()
    write(
      root,
      'src/app/index.ts',
      "export { placeOrder as place } from '../domains/orders'\nexport * from '../domains/pricing'\n",
    )
    edit(
      root,
      'src/app/checkout.ts',
      'describeOrder, placeOrder, type Order',
      'describeOrder, type Order',
    )
    edit(
      root,
      'src/app/checkout.ts',
      '  const order: Order = placeOrder(',
      '  const order: Order = place(',
    )
    edit(
      root,
      'src/app/checkout.ts',
      "import * as pricing from '../domains/pricing'",
      "import * as pricing from '../domains/pricing'\nimport { place } from './index'",
    )
    assert.deepEqual(measure(root).orders.M12.names, [])
    edit(
      root,
      'src/app/checkout.ts',
      "export function lineCount(order: import('../domains/orders').OrderLine[]): number",
      'export function lineCount(order: unknown[]): number',
    )
    assert.deepEqual(measure(root).orders.M12.names, [`${ORDERS}/index.ts#OrderLine`])
    edit(root, 'src/app/checkout.ts', '${describeOrder(order)} ', '')
    assert.deepEqual(
      measure(root).orders.M12.names.sort(),
      [`${ORDERS}/index.ts#OrderLine`, `${ORDERS}/index.ts#describeOrder`],
      'an imported but unreferenced binding is not a use',
    )
    rmSync(join(root, 'src/app/index.ts'))
    edit(
      root,
      'src/app/checkout.ts',
      "import { place } from './index'",
      "import { placeOrder as place } from '../domains/orders'",
    )
    edit(root, 'src/app/checkout.ts', "${pricing.priceLabel(order.total, 'USD')} ", '')
    assert.deepEqual(
      measure(root).pricing.M12.names,
      [`${PRICING}/index.ts#priceLabel`],
      'namespace access counts per member',
    )
  })
})

describe('input validation', () => {
  test('slices.toml accepts the guard example and rejects what the guard rejects', () => {
    const guardExample = {
      version: 1,
      policy: {
        language: 'typescript',
        unmapped_files: 'error',
        suppressions: 'human-only',
        test_patterns: ['**/*.test.ts'],
        tsconfig: 'tsconfig.json',
      },
      slice: [
        {
          name: 'orders',
          paths: ['src/domains/orders'],
          crust: ['src/domains/orders/index.ts'],
          shape: 'thin-facade',
          may_depend_on: ['pricing', 'common'],
          requires: ['pricing'],
        },
        {
          name: 'pricing',
          paths: ['src/domains/pricing'],
          crust: ['src/domains/pricing/index.ts'],
          shape: 'thin-facade',
          may_depend_on: ['common'],
          requires: ['common'],
        },
      ],
      spine: [{ name: 'common', paths: ['src/domains/common'], may_depend_on: [] }],
      suppress: [{ rule: 'SB-01', from: 'a', to: 'b', reason: 'approved' }],
    }
    const model = parseSlices(guardExample)
    assert.equal(model.isTest('src/domains/orders/order.test.ts'), true)
    assert.equal(model.isTest('order.test.ts'), true, '**/ matches the root too, as in the guard')
    assert.equal(model.isTest('src/order.ts'), false)
    const variant = (fn) => {
      const copy = structuredClone(guardExample)
      fn(copy)
      return () => parseSlices(copy)
    }
    const rejected = {
      'unknown policy key': (d) => (d.policy.depth_mode = 'block'),
      'unknown slice key': (d) => (d.slice[0].owner = 'me'),
      'version 2': (d) => (d.version = 2),
      'non-typescript language': (d) => (d.policy.language = 'python'),
      'bad shape': (d) => (d.slice[0].shape = 'god-object'),
      'glob in paths': (d) => (d.slice[0].paths = ['src/domains/*']),
      'unnormalized path': (d) => (d.slice[0].paths = ['./src/domains/orders']),
      'parent path': (d) => (d.slice[0].paths = ['../orders']),
      'crust outside paths': (d) => (d.slice[0].crust = ['src/index.ts']),
      'overlapping paths': (d) => (d.spine[0].paths = ['src/domains/orders/common']),
      'requires not in may_depend_on': (d) => (d.slice[1].requires = ['orders']),
      'unknown dependency': (d) => (d.slice[1].may_depend_on = ['billing']),
      'duplicate names': (d) => (d.spine[0].name = 'orders'),
      'unsuppressible rule': (d) => (d.suppress[0].rule = 'SB-07'),
      'empty reason': (d) => (d.suppress[0].reason = ' '),
    }
    for (const [label, fn] of Object.entries(rejected)) assert.throws(variant(fn), undefined, label)
  })

  test('a malformed slices.toml is an input error (exit 2)', () => {
    const root = repo()
    edit(root, 'slices.toml', '[policy]', '[policy]\ndepth_mode = "block"')
    const run = cli(root, 'check')
    assert.equal(run.code, 2)
    assert.match(run.out, /unknown field\(s\) depth_mode/)
  })

  test('a baseline with a missing metric or another measurement version is an input error', () => {
    const root = repo()
    const good = JSON.parse(read(root, 'depth-ratchet.json'))
    const missing = structuredClone(good)
    delete missing.slices.orders['M12.unused_exports']
    write(root, 'depth-ratchet.json', JSON.stringify(missing))
    let run = cli(root, 'check')
    assert.equal(run.code, 2)
    assert.match(run.out, /slices\.orders is missing M12\.unused_exports/)
    write(root, 'depth-ratchet.json', JSON.stringify({ ...good, measurement_version: 0 }))
    run = cli(root, 'check')
    assert.equal(run.code, 2)
    assert.match(run.out, /measurement_version 0 does not match/)
  })
})

describe('diff-baseline', () => {
  test('lists raised caps and a relaxed mode against the base revision, exit 0', () => {
    const root = repo()
    const baseline = JSON.parse(read(root, 'depth-ratchet.json'))
    baseline.mode = 'report'
    baseline.slices.orders['M08.crust_logic_statements'] = 40
    baseline.slices.orders['M08.share'] = { num: 1, den: 2 }
    delete baseline.slices.pricing
    write(root, 'depth-ratchet.json', JSON.stringify(baseline, null, 2))
    const run = cli(root, 'diff-baseline', '--base', 'HEAD', '--json')
    assert.equal(run.code, 0, run.out)
    const kinds = JSON.parse(run.stdout).findings.map((f) =>
      [f.kind, f.slice, f.metric].filter(Boolean).join(' '),
    )
    assert.deepEqual(kinds, [
      'mode-relaxed',
      'cap-raised orders M08.crust_logic_statements',
      'cap-raised orders M08.share',
      'slice-removed pricing',
    ])
  })

  test('reports initialization when the base has no baseline, and exit 2 on a bad ref', () => {
    const root = repo()
    const run = cli(root, 'diff-baseline', '--base', 'HEAD~1', '--json')
    assert.equal(run.code, 0, run.out)
    assert.equal(JSON.parse(run.stdout).findings[0].kind, 'initialization')
    assert.equal(cli(root, 'diff-baseline', '--base', 'no-such-ref').code, 2)
  })
})

/** Re-adopt after a setup change, so the setup is part of the approved baseline. */
function rebaseline(root) {
  rmSync(join(root, 'depth-ratchet.json'))
  assert.equal(cli(root, 'init').code, 0)
  const baseline = JSON.parse(read(root, 'depth-ratchet.json'))
  write(root, 'depth-ratchet.json', JSON.stringify({ ...baseline, mode: 'block' }, null, 2) + '\n')
}

const SUMMARY_CLASS = [
  "import type { Order } from './model'",
  '',
  'class Summary {',
  '  render(order: Order): string {',
  '    const count = order.lines.length',
  "    const noun = count === 1 ? 'line' : 'lines'",
  '    const big = order.lines.some((line) => line.qty > 10)',
  '    return big ? `${count} ${noun}, bulk` : `${count} ${noun}`',
  '  }',
  '}',
  '',
  'export function summarize(order: Order): string {',
  '  return new Summary().render(order)',
  '}',
  '',
].join('\n')

describe('red-team regressions (advisor round 2)', () => {
  test('dead object literals and wrapped dead functions are excluded (attempts 1-2)', () => {
    const root = repo()
    const before = measure(root)
    edit(
      root,
      `${ORDERS}/summary.ts`,
      "import type { Order } from './model'\n",
      "import type { Order } from './model'\n\n" +
        'const dead = {\n  a(x: number) {\n    let n = x\n    if (n > 0) n++\n    return n\n  },\n  b: (x: number) => (x > 0 ? x : -x),\n}\n' +
        'const wrapped = ((x: number) => {\n  let n = x\n  if (n > 0) n++\n  return n\n})\n' +
        'const asserted = ((x: number) => x + 1) satisfies (x: number) => number\n',
    )
    const after = measure(root)
    assert.deepEqual(after.orders.M08, before.orders.M08)
    assert.deepEqual(after.orders.M10, before.orders.M10)
    for (const name of ['dead', 'wrapped', 'asserted']) {
      assert.ok(after.orders.dead_code.units.includes(`${ORDERS}/summary.ts#${name}`), name)
    }
  })

  test('an exported object getter on the crust still regresses every crust key (attempt 14)', () => {
    const root = repo()
    edit(
      root,
      `${ORDERS}/index.ts`,
      "export { placeOrder } from './place'",
      "export { placeOrder } from './place'\nexport const api = {\n  get value() {\n    if (Date.now() > 0) return 1\n    return 0\n  },\n}",
    )
    assertFails(root, [
      'orders M08.crust_logic_statements',
      'orders M09.public_surface',
      'orders M10.crust_complexity',
      'orders M12.unused_exports',
    ])
  })

  test('static class field initializers in the crust show in module_init (attempt 9)', () => {
    const root = repo()
    edit(
      root,
      `${ORDERS}/index.ts`,
      "export { placeOrder } from './place'",
      "export { placeOrder } from './place'\n\nclass CrustPolicy {\n  static score = Date.now() > 0 ? 10 : 30\n  static label = 'fixed'\n}\nvoid CrustPolicy",
    )
    assert.equal(
      measure(root).orders.module_init.crust,
      2,
      'one static initializer plus the void statement',
    )
  })

  test('static initializers in a top-level class expression count too, and keep the class live (round 3)', () => {
    const root = repo()
    edit(
      root,
      `${ORDERS}/index.ts`,
      "export { placeOrder } from './place'",
      "export { placeOrder } from './place'\n\nconst C = class {\n  static score = Date.now() > 0 ? 1 : 2\n}\nvoid C",
    )
    assert.equal(
      measure(root).orders.module_init.crust,
      2,
      'the static initializer plus the void statement',
    )
    const internal = repo()
    const before = measure(internal)
    edit(
      internal,
      `${ORDERS}/summary.ts`,
      "import type { Order } from './model'\n",
      "import type { Order } from './model'\n\nconst Registry = class {\n  static ready = Date.now() > 0\n  static boot(): number {\n    let n = 0\n    if (Registry.ready) n++\n    return n\n  }\n}\n",
    )
    const after = measure(internal)
    assert.ok(
      !after.orders.dead_code.units.includes(`${ORDERS}/summary.ts#Registry`),
      'a class expression that runs code at definition is module code, not a reference-reached unit',
    )
    assert.equal(after.orders.module_init.slice, before.orders.module_init.slice + 1)
  })

  test('a crust that uses `export =` is rejected as unsupported input (attempt 16)', () => {
    const root = repo()
    write(
      root,
      `${ORDERS}/index.ts`,
      "import { placeOrder } from './place'\n\nconst api = { placeOrder }\nexport = api\n",
    )
    const run = cli(root, 'check')
    assert.equal(run.code, 2)
    assert.match(run.out, /uses `export =`/)
  })

  test('a literal-typed computed key resolves the method: no false positive (attempt 18)', () => {
    const root = repo()
    write(root, `${ORDERS}/summary.ts`, SUMMARY_CLASS)
    rebaseline(root)
    edit(
      root,
      `${ORDERS}/summary.ts`,
      '  return new Summary().render(order)',
      "  const key = 'render'\n  return new Summary()[key](order)",
    )
    const after = measure(root)
    assert.equal(after.orders.dead_code.excluded_statements, 0)
    assert.equal(after.orders.coverage.reachability, 'static')
    assert.equal(check(root).code, 0)
  })

  test('reflection marks reachability partial and is printed by check (attempt 19)', () => {
    const root = repo()
    write(root, `${ORDERS}/summary.ts`, SUMMARY_CLASS)
    rebaseline(root)
    edit(
      root,
      `${ORDERS}/summary.ts`,
      '  return new Summary().render(order)',
      "  return Reflect.get(new Summary(), 'render')(order)",
    )
    const after = measure(root)
    assert.equal(after.orders.coverage.reachability, 'partial')
    assert.match(after.orders.coverage.dynamic_access[0], /summary\.ts:\d+ Reflect\.get$/)
    assert.match(
      check(root).text,
      /^orders coverage: reachability partial \(1 dynamic access\(es\)\)$/m,
    )
  })

  test('renaming an unused method that shares a name with an array method changes nothing (attempt 21)', () => {
    const root = repo()
    const deadClass =
      'class Dead {\n  some(x: number) {\n    let n = x\n    if (n > 0) n++\n    return n\n  }\n}\n'
    write(root, `${ORDERS}/summary.ts`, read(root, `${ORDERS}/summary.ts`) + '\n' + deadClass)
    rebaseline(root)
    const before = measure(root)
    assert.equal(
      before.orders.M08.slice_logic_statements,
      25,
      'Dead.some is dead despite order.lines.some(...)',
    )
    edit(root, `${ORDERS}/summary.ts`, '  some(x: number)', '  unused(x: number)')
    assert.deepEqual(numbers(measure(root)), numbers(before))
    assert.equal(check(root).code, 0)
  })

  test('tighten holds a denominator-driven share gain until a human accepts it (attempt 7)', () => {
    const root = repo()
    const bytes = read(root, 'depth-ratchet.json')
    write(
      root,
      `${ORDERS}/pad.ts`,
      'export function pad(): number {\n  let n = 0\n  for (let i = 0; i < 10; i++) {\n    n += i\n  }\n  return n\n}\n',
    )
    edit(
      root,
      `${ORDERS}/index.ts`,
      '  const summary = summarize(order)',
      '  const summary = (pad(), summarize(order))',
    )
    edit(
      root,
      `${ORDERS}/index.ts`,
      "import { summarize } from './summary'",
      "import { summarize } from './summary'\nimport { pad } from './pad'",
    )
    const held = cli(root, 'tighten')
    assert.equal(held.code, 0, held.out)
    assert.match(held.out, /^orders M08\.share held: denominator-driven gain/m)
    assert.match(held.out, /^orders M10\.share held: denominator-driven gain/m)
    assert.equal(
      read(root, 'depth-ratchet.json'),
      bytes,
      'nothing else improved, so nothing is written',
    )
    assert.equal(cli(root, 'tighten', '--accept-denominator-gains').code, 0)
    assert.deepEqual(JSON.parse(read(root, 'depth-ratchet.json')).slices.orders['M08.share'], {
      num: 2,
      den: 29,
    })
  })

  test('a crust that re-exports from JavaScript names the unmeasured file (attempt 11)', () => {
    const root = repo()
    write(
      root,
      `${ORDERS}/escape.js`,
      'export function describeOrder(order) {\n  let n = 0\n  for (const line of order.lines) {\n    if (line.qty > 0) n += line.qty\n  }\n  return String(n)\n}\n',
    )
    write(
      root,
      `${ORDERS}/escape.d.ts`,
      "export declare function describeOrder(order: import('./model').Order): string\n",
    )
    write(
      root,
      `${ORDERS}/index.ts`,
      "export type { Order, OrderLine } from './model'\nexport { placeOrder } from './place'\nexport { describeOrder } from './escape.js'\n",
    )
    const after = measure(root)
    assert.deepEqual(after.orders.coverage.unmeasured_files, [
      `${ORDERS}/escape.d.ts`,
      `${ORDERS}/escape.js`,
    ])
    assert.match(
      check(root).text,
      /^orders coverage: unmeasured files src\/domains\/orders\/escape\.d\.ts, src\/domains\/orders\/escape\.js$/m,
    )
  })

  test('controls: self-recursive dead code stays dead; a test-pattern re-export still counts (attempts 6, 10)', () => {
    const root = repo()
    const before = measure(root)
    edit(
      root,
      `${ORDERS}/summary.ts`,
      "import type { Order } from './model'\n",
      "import type { Order } from './model'\n\nfunction dead(n: number): number {\n  if (n > 0) return dead(n - 1)\n  return 0\n}\n",
    )
    assert.deepEqual(measure(root).orders.M08, before.orders.M08)
    write(
      root,
      `${ORDERS}/hidden.test.ts`,
      'export function hidden(x: number): number {\n  if (x > 0) return 1\n  return 0\n}\n',
    )
    edit(
      root,
      `${ORDERS}/index.ts`,
      "export { placeOrder } from './place'",
      "export { placeOrder } from './place'\nexport { hidden } from './hidden.test'",
    )
    assertFails(root, ['orders M09.public_surface', 'orders M12.unused_exports'])
  })
})
