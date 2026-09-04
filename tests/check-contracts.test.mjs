import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONTRACT = 'reference/doctrine-contracts.json'
const SEVERITY_MARKER = 'doctrine:severity-cases'
const GROWTH_MARKER = 'doctrine:growth-cases'
const GROWTH_SUMMARY_MARKER = 'doctrine:growth-summary'
const CATALOG_MARKER = 'skills:catalog'
const LEGACY_ARROWS_MARKER = 'doctrine:arrows'

async function copyContractTree(destination) {
  for (const relative of ['reference', 'scripts', 'skills', 'docs/adr', 'site/src/content/docs']) {
    await cp(join(ROOT, relative), join(destination, relative), { recursive: true })
  }
  await cp(join(ROOT, 'README.md'), join(destination, 'README.md'))
}

async function fixture() {
  return mkdtemp(join(tmpdir(), 'sliced-bread-contracts-'))
}

function runChecker(root) {
  const result = spawnSync(process.execPath, [join(root, 'scripts/check-contracts.mjs')], {
    cwd: root,
    encoding: 'utf8',
  })
  return {
    ...result,
    output: [result.stdout ?? '', result.stderr ?? '', result.error?.message ?? ''].join(''),
  }
}

function block(text, marker) {
  const pairs = [
    [`<!-- ${marker}:start -->`, `<!-- ${marker}:end -->`],
    [`{/* ${marker}:start */}`, `{/* ${marker}:end */}`],
  ]
  const present = pairs.filter(([start, end]) => text.includes(start) || text.includes(end))
  assert.equal(present.length, 1, `missing or ambiguous ${marker} marker pair`)
  const [start, end] = present[0]
  assert.equal(text.split(start).length, 2, `missing ${marker} start marker`)
  assert.equal(text.split(end).length, 2, `missing ${marker} end marker`)
  return text.split(start)[1].split(end)[0].trim()
}

async function replaceBlock(path, marker, replacement) {
  const text = await readFile(path, 'utf8')
  const start = `<!-- ${marker}:start -->`
  const end = `<!-- ${marker}:end -->`
  const startAt = text.indexOf(start)
  const endAt = text.indexOf(end, startAt + start.length)
  assert.notEqual(startAt, -1, `missing ${marker} in ${path}`)
  assert.notEqual(endAt, -1, `missing ${marker} in ${path}`)
  await writeFile(path, `${text.slice(0, startAt)}${start}\n${replacement}\n${text.slice(endAt)}`)
}

async function removeFixture(path) {
  await rm(path, { recursive: true, force: true })
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('DoctrineContractsV1 is a reference-owned ordered projection', async () => {
  const contract = JSON.parse(await readFile(join(ROOT, CONTRACT), 'utf8'))
  assert.deepEqual(Object.keys(contract).sort(), [
    'growth_cases',
    'schema_version',
    'severity_cases',
  ])
  assert.equal(contract.schema_version, 1)
  assert.deepEqual(
    contract.severity_cases.map(({ id, expected }) => [id, expected]),
    [
      ['severity-import-exec', 'blocker'],
      ['severity-static-domain-infra', 'medium'],
      ['severity-static-concrete-adapter', 'medium'],
      ['severity-other-forbidden-edge', 'blocker'],
    ],
  )
  assert.deepEqual(
    contract.growth_cases.map(({ id, expected }) => [id, expected]),
    [
      ['growth-cycle-event', 'allow'],
      ['growth-positional-one-file', 'allow'],
      ['growth-single-unpressured', 'medium'],
    ],
  )

  const root = await fixture()
  try {
    await copyContractTree(root)
    const result = runChecker(root)
    assert.equal(result.status, 0, result.output)
  } finally {
    await removeFixture(root)
  }
})

test('contract schema rejects invalid generic case data', async () => {
  const cases = [
    ['schema_version', (contract) => (contract.schema_version = 2)],
    [
      'severity_cases[1].id',
      (contract) => (contract.severity_cases[1].id = contract.severity_cases[0].id),
    ],
    [
      'severity_cases[0].expected',
      (contract) => (contract.severity_cases[0].expected = 'critical'),
    ],
    ['growth_cases[0].id', (contract) => (contract.growth_cases[0].id = 'severity-wrong-family')],
    ['severity_cases[0]', (contract) => delete contract.severity_cases[0].rationale],
    ['root', (contract) => (contract.extra = true)],
  ]

  for (const [field, mutate] of cases) {
    const root = await fixture()
    try {
      await copyContractTree(root)
      const path = join(root, CONTRACT)
      const contract = JSON.parse(await readFile(path, 'utf8'))
      mutate(contract)
      await writeFile(path, JSON.stringify(contract, null, 2))
      const result = runChecker(root)
      assert.equal(result.status, 1, `${field}: ${result.output}`)
      assert.match(result.output, new RegExp(escapeRegExp(field)))
    } finally {
      await removeFixture(root)
    }
  }
})

test('declared consumers fail closed on missing or divergent blocks', async () => {
  const missingRoot = await fixture()
  try {
    await copyContractTree(missingRoot)
    const missing = 'skills/sliced-bread-review/SKILL.md'
    await unlink(join(missingRoot, missing))
    const result = runChecker(missingRoot)
    assert.equal(result.status, 1)
    assert.match(result.output, new RegExp(escapeRegExp(missing)))
    assert.match(result.output, /file is missing/)
  } finally {
    await removeFixture(missingRoot)
  }

  const divergentRoot = await fixture()
  try {
    await copyContractTree(divergentRoot)
    const relative = 'site/src/content/docs/reference/sliced-bread.md'
    await replaceBlock(join(divergentRoot, relative), SEVERITY_MARKER, 'corrupt')
    const result = runChecker(divergentRoot)
    assert.equal(result.status, 1)
    assert.match(result.output, new RegExp(escapeRegExp(relative)))
    assert.match(result.output, /doctrine:severity-cases/)
  } finally {
    await removeFixture(divergentRoot)
  }

  const growthDivergentRoot = await fixture()
  try {
    await copyContractTree(growthDivergentRoot)
    const relative = 'site/src/content/docs/reference/sliced-bread.md'
    await replaceBlock(join(growthDivergentRoot, relative), GROWTH_MARKER, 'corrupt')
    const result = runChecker(growthDivergentRoot)
    assert.equal(result.status, 1)
    assert.match(result.output, new RegExp(escapeRegExp(relative)))
    assert.match(result.output, /doctrine:growth-cases/)
  } finally {
    await removeFixture(growthDivergentRoot)
  }

  const referenceDivergentRoot = await fixture()
  try {
    await copyContractTree(referenceDivergentRoot)
    await replaceBlock(
      join(referenceDivergentRoot, 'reference/sliced-bread.md'),
      SEVERITY_MARKER,
      'corrupt',
    )
    const result = runChecker(referenceDivergentRoot)
    assert.equal(result.status, 1)
    assert.match(
      result.output,
      /reference\/doctrine-contracts\.json: contract block doctrine:severity-cases: diverges from reference\/sliced-bread\.md/,
    )
  } finally {
    await removeFixture(referenceDivergentRoot)
  }

  const legacyRoot = await fixture()
  try {
    await copyContractTree(legacyRoot)
    const relative = 'site/src/content/docs/reference/sliced-bread.md'
    await replaceBlock(join(legacyRoot, relative), LEGACY_ARROWS_MARKER, 'corrupt')
    const result = runChecker(legacyRoot)
    assert.equal(result.status, 1)
    assert.match(result.output, /doctrine:arrows/)
  } finally {
    await removeFixture(legacyRoot)
  }
})

test('pressure-first growth summary is an exact reference projection', async () => {
  const paths = [
    'reference/sliced-bread.md',
    'README.md',
    'site/src/content/docs/index.mdx',
    'site/src/content/docs/reference/sliced-bread.md',
  ]
  const summaries = await Promise.all(
    paths.map(async (path) =>
      block(await readFile(join(ROOT, path), 'utf8'), GROWTH_SUMMARY_MARKER),
    ),
  )
  assert.deepEqual(summaries, [summaries[0], summaries[0], summaries[0], summaries[0]])
  assert.match(summaries[0], /Demonstrated pressure/)
  assert.match(summaries[0], /normal evidence threshold/)

  const root = await fixture()
  try {
    await copyContractTree(root)
    await replaceBlock(
      join(root, 'README.md'),
      GROWTH_SUMMARY_MARKER,
      'Add abstractions before demonstrated pressure; two consumers are irrelevant.',
    )
    const result = runChecker(root)
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, /README\.md/)
    assert.match(result.output, /doctrine:growth-summary/)
  } finally {
    await removeFixture(root)
  }

  const siteRoot = await fixture()
  try {
    await copyContractTree(siteRoot)
    const relative = 'site/src/content/docs/reference/sliced-bread.md'
    await replaceBlock(
      join(siteRoot, relative),
      GROWTH_SUMMARY_MARKER,
      'Add abstractions before demonstrated pressure; two consumers are irrelevant.',
    )
    const result = runChecker(siteRoot)
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, new RegExp(escapeRegExp(relative)))
    assert.match(result.output, /doctrine:growth-summary/)
  } finally {
    await removeFixture(siteRoot)
  }
})

test('catalog parity is derived from shipped skill directories', async () => {
  const local = block(await readFile(join(ROOT, 'skills/README.md'), 'utf8'), CATALOG_MARKER)
  const site = block(
    await readFile(join(ROOT, 'site/src/content/docs/skills.md'), 'utf8'),
    CATALOG_MARKER,
  )
  assert.equal(local, site)

  const root = await fixture()
  try {
    await copyContractTree(root)
    await mkdir(join(root, 'skills/new-review-tool'))
    const result = runChecker(root)
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, /new-review-tool/)
    assert.match(result.output, /skills:catalog/)
  } finally {
    await removeFixture(root)
  }
})

test('ADR lifecycle supports supersession and rejects incomplete metadata', async () => {
  const adr4 = await readFile(join(ROOT, 'docs/adr/sliced-bread-doctrine-revision-004.md'), 'utf8')
  assert.match(adr4, /^status: superseded$/m)
  assert.match(adr4, /^superseded_by: ADR-006$/m)
  const adr6 = await readFile(join(ROOT, 'docs/adr/sliced-bread-doctrine-revision-006.md'), 'utf8')
  assert.match(adr6, /^status: accepted$/m)
  assert.match(adr6, /^supersedes: ADR-004$/m)

  const invalidRoot = await fixture()
  try {
    await copyContractTree(invalidRoot)
    const path = join(invalidRoot, 'docs/adr/sliced-bread-doctrine-revision-004.md')
    await writeFile(
      path,
      (await readFile(path, 'utf8')).replace('status: superseded', 'status: historical'),
    )
    const result = runChecker(invalidRoot)
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, /ADR field status/)
  } finally {
    await removeFixture(invalidRoot)
  }

  const missingLinkRoot = await fixture()
  try {
    await copyContractTree(missingLinkRoot)
    const path = join(missingLinkRoot, 'docs/adr/sliced-bread-doctrine-revision-004.md')
    await writeFile(path, (await readFile(path, 'utf8')).replace(/^superseded_by:.*\n/m, ''))
    const result = runChecker(missingLinkRoot)
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, /superseded_by/)
  } finally {
    await removeFixture(missingLinkRoot)
  }
})
