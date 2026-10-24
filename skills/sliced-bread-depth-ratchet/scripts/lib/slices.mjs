// Strict slices.toml loader. It accepts and rejects the same documents as the
// sliced-bread-guard parser (scripts/sbguard_lib/model.py); error text may differ.

import { readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { parse as parseToml } from 'smol-toml'

export const SLICES_FILE = 'slices.toml'
const SHAPES = new Set(['thin-facade', 'framework-bound', 'service'])
const SUPPRESSIBLE = new Set(['SB-01', 'SB-02', 'SB-03', 'SB-04', 'SB-05', 'SB-06'])
const TOP_KEYS = ['version', 'policy', 'slice', 'spine', 'suppress']
const POLICY_KEYS = [
  'language',
  'unmapped_files',
  'suppressions',
  'test_patterns',
  'ignore',
  'tsconfig',
]
const SLICE_KEYS = ['name', 'paths', 'crust', 'shape', 'may_depend_on', 'requires']
const SPINE_KEYS = ['name', 'paths', 'may_depend_on']
const SUPPRESS_KEYS = ['rule', 'from', 'to', 'reason']
const REGEX_SPECIALS = new Set('.^$*+?()[]{}|\\')

export class ConfigError extends Error {}

export function under(file, prefix) {
  return file === prefix || file.startsWith(prefix + '/')
}

function escape(text) {
  return [...text].map((c) => (REGEX_SPECIALS.has(c) ? '\\' + c : c)).join('')
}

/** Translate globs (`**`, `*`, `?`) into one anchored regex, as the guard does. */
export function globRegex(patterns) {
  const parts = patterns.map((pattern) => {
    let out = ''
    for (let i = 0; i < pattern.length;) {
      if (pattern.startsWith('**/', i)) [out, i] = [out + '(?:.*/|)', i + 3]
      else if (pattern.startsWith('**', i)) [out, i] = [out + '.*', i + 2]
      else if (pattern[i] === '*') [out, i] = [out + '[^/]*', i + 1]
      else if (pattern[i] === '?') [out, i] = [out + '[^/]', i + 1]
      else [out, i] = [out + escape(pattern[i]), i + 1]
    }
    return out
  })
  return new RegExp('^(?:' + parts.join('|') + ')$')
}

function isTable(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function checkKeys(table, allowed, required, where) {
  if (!isTable(table)) throw new ConfigError(`${where}: expected a table`)
  const unknown = Object.keys(table).filter((k) => !allowed.includes(k))
  if (unknown.length)
    throw new ConfigError(`${where}: unknown field(s) ${unknown.sort().join(', ')}`)
  const missing = required.filter((k) => !(k in table))
  if (missing.length)
    throw new ConfigError(`${where}: missing field(s) ${missing.sort().join(', ')}`)
  return table
}

function strings(value, where, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
    throw new ConfigError(`${where}: expected a list of strings`)
  }
  if (!allowEmpty && value.length === 0)
    throw new ConfigError(`${where}: expected at least one entry`)
  if (new Set(value).size !== value.length) throw new ConfigError(`${where}: duplicate entries`)
  return value
}

function repoPath(path, where) {
  const parts = path.split('/')
  const normalized = path !== '' && posix.normalize(path) === path && !path.endsWith('/')
  if (!normalized || path.startsWith('/') || parts.includes('..') || path.includes('\\')) {
    throw new ConfigError(
      `${where}: ${JSON.stringify(path)} must be a normalized repository-relative path`,
    )
  }
  if (/[*?[\]]/.test(path))
    throw new ConfigError(`${where}: ${JSON.stringify(path)} must be a literal path, not a glob`)
  return path
}

function table(data, key) {
  const value = data[key] ?? []
  if (!Array.isArray(value))
    throw new ConfigError(`${SLICES_FILE}: [[${key}]] must be an array of tables`)
  return value
}

export function parseSlices(data) {
  checkKeys(data, TOP_KEYS, ['version', 'policy', 'slice'], SLICES_FILE)
  if (data.version !== 1) throw new ConfigError(`${SLICES_FILE}: version must be 1`)
  const policy = checkKeys(
    data.policy,
    POLICY_KEYS,
    ['language', 'unmapped_files', 'suppressions', 'test_patterns'],
    '[policy]',
  )
  if (policy.language !== 'typescript') {
    throw new ConfigError('[policy] language: only "typescript" has a backend in this version')
  }
  if (policy.unmapped_files !== 'error')
    throw new ConfigError('[policy] unmapped_files: only "error" is supported')
  if (policy.suppressions !== 'human-only')
    throw new ConfigError('[policy] suppressions: only "human-only" is supported')
  if (policy.tsconfig !== undefined) {
    if (typeof policy.tsconfig !== 'string')
      throw new ConfigError('[policy] tsconfig: expected a string')
    repoPath(policy.tsconfig, '[policy] tsconfig')
  }

  const nodes = []
  table(data, 'slice').forEach((raw, index) => {
    const where = `[[slice]] #${index + 1}`
    checkKeys(raw, SLICE_KEYS, SLICE_KEYS, where)
    if (!SHAPES.has(raw.shape))
      throw new ConfigError(`${where}: shape must be one of ${[...SHAPES].sort().join(', ')}`)
    const paths = strings(raw.paths, where, { allowEmpty: false }).map((p) =>
      repoPath(p, `${where} paths`),
    )
    const crust = strings(raw.crust, where, { allowEmpty: false }).map((p) =>
      repoPath(p, `${where} crust`),
    )
    for (const file of crust) {
      if (!paths.some((p) => under(file, p)))
        throw new ConfigError(`${where}: crust ${JSON.stringify(file)} is outside the slice paths`)
    }
    nodes.push({
      name: raw.name,
      kind: 'slice',
      paths,
      crust,
      shape: raw.shape,
      mayDependOn: strings(raw.may_depend_on, `${where} may_depend_on`),
      requires: strings(raw.requires, `${where} requires`),
    })
  })
  table(data, 'spine').forEach((raw, index) => {
    const where = `[[spine]] #${index + 1}`
    checkKeys(raw, SPINE_KEYS, SPINE_KEYS, where)
    const paths = strings(raw.paths, where, { allowEmpty: false }).map((p) =>
      repoPath(p, `${where} paths`),
    )
    nodes.push({
      name: raw.name,
      kind: 'spine',
      paths,
      crust: [],
      mayDependOn: strings(raw.may_depend_on, `${where} may_depend_on`),
      requires: [],
    })
  })

  const names = nodes.map((n) => n.name)
  if (new Set(names).size !== names.length)
    throw new ConfigError(`${SLICES_FILE}: node names must be unique across slices and spine`)
  for (const node of nodes) {
    for (const target of [...node.mayDependOn, ...node.requires]) {
      if (!names.includes(target) || target === node.name) {
        throw new ConfigError(`${node.name}: unknown or self dependency ${JSON.stringify(target)}`)
      }
    }
    for (const target of node.requires) {
      if (!node.mayDependOn.includes(target))
        throw new ConfigError(
          `${node.name}: requires ${JSON.stringify(target)} but may_depend_on omits it`,
        )
    }
  }
  for (const a of nodes) {
    for (const b of nodes) {
      if (a !== b && a.paths.some((p) => b.paths.some((q) => under(p, q)))) {
        throw new ConfigError(`${a.name} and ${b.name}: node paths overlap`)
      }
    }
  }
  table(data, 'suppress').forEach((raw, index) => {
    const where = `[[suppress]] #${index + 1}`
    checkKeys(raw, SUPPRESS_KEYS, SUPPRESS_KEYS, where)
    if (!SUPPRESSIBLE.has(raw.rule))
      throw new ConfigError(`${where}: rule ${JSON.stringify(raw.rule)} cannot be suppressed`)
    if (!String(raw.reason).trim()) throw new ConfigError(`${where}: reason must not be empty`)
  })

  const testPatterns = strings(policy.test_patterns, '[policy] test_patterns', {
    allowEmpty: false,
  })
  const ignore = strings(policy.ignore ?? [], '[policy] ignore')
  const testRegex = globRegex(testPatterns)
  const ignoreRegex = ignore.length ? globRegex(ignore) : null
  return {
    nodes,
    slices: nodes.filter((n) => n.kind === 'slice'),
    tsconfig: policy.tsconfig ?? null,
    isTest: (file) => testRegex.test(file),
    isIgnored: (file) => ignoreRegex !== null && ignoreRegex.test(file),
    owner: (file) => nodes.find((n) => n.paths.some((p) => under(file, p))) ?? null,
  }
}

export function loadSlices(root) {
  let text
  try {
    text = readFileSync(join(root, SLICES_FILE), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') throw new ConfigError(`${SLICES_FILE}: not found in ${root}`)
    throw error
  }
  let data
  try {
    data = parseToml(text)
  } catch (error) {
    throw new ConfigError(`${SLICES_FILE}: invalid TOML (${error.message.split('\n')[0]})`)
  }
  return parseSlices(data)
}
