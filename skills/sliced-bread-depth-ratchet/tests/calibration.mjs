// Deterministic sources for the two doctrine calibration cases
// (skills/sliced-bread-depth/SKILL.md:68-70). The tests write them into a temp repo
// and assert the physical line counts, so the cases stay what the doctrine names.

const PARTS = ['bolt', 'nut', 'washer', 'gear', 'shaft', 'spring', 'pulley', 'bearing']
const FAMILIES = ['steel', 'brass', 'nylon']

/** A 250-line pure-factory leaf slice: one crust file, no internals, one statement per factory. */
export function widgetsCrust() {
  const lines = [
    '// Widgets crust: a pure-factory leaf slice. Every export builds a plain value.',
    '// There is no internal layer, so the crust is 100% of the slice by design.',
    'export interface Part {',
    '  id: string',
    '  kind: string',
    '  family: string',
    '  size: number',
    '  tags: readonly string[]',
    '}',
    '',
  ]
  for (const family of FAMILIES) {
    for (const part of PARTS) {
      const name = `make${cap(family)}${cap(part)}`
      lines.push(
        `export function ${name}(size: number): Part {`,
        '  return {',
        `    id: \`${family}-${part}-\${size}\`,`,
        `    kind: '${part}',`,
        `    family: '${family}',`,
        '    size,',
        `    tags: ['${part}', '${family}'],`,
        '  }',
        '}',
        '',
      )
    }
  }
  lines.pop()
  lines.push(`// ${FAMILIES.length * PARTS.length} factories, no internal modules.`, '')
  return lines.join('\n')
}

const HANDLERS = 58
const WEIGHERS = 31

/** A 900-line service crust that inlines its hot loop and every handler. */
export function engineCrust() {
  const lines = [
    '// Engine crust: owns the tick loop and every event handler inline.',
    '// The deep layer (./weights) is thin, so the crust holds most of the slice.',
    "import { weighAll } from './weights'",
    "import type { EngineEvent } from './event'",
    '',
    "export type { EngineEvent } from './event'",
    '',
    'export class Engine {',
    '  total = 0',
    '  ticks = 0',
    '',
    '  step(events: EngineEvent[]): number {',
    '    this.ticks += 1',
    '    let processed = 0',
    '    for (const event of events) {',
    '      switch (event.kind) {',
  ]
  for (let i = 0; i < HANDLERS; i++)
    lines.push(`        case 'k${i}': processed += this.handle${i}(event); break`)
  lines.push(
    '        default:',
    '          processed += 0',
    '      }',
    '    }',
    '    return processed',
    '  }',
    '',
    '  private bonus(event: EngineEvent): number {',
    '    return weighAll(event)',
    '  }',
    '',
  )
  for (let i = 0; i < HANDLERS; i++) {
    lines.push(
      `  private handle${i}(event: EngineEvent): number {`,
      `    let score = event.weight * ${(i % 7) + 1}`,
      `    if (event.priority > ${i % 5}) {`,
      '      score += this.bonus(event)',
      `    } else if (event.priority === ${i % 3}) {`,
      `      score -= ${(i % 4) + 1}`,
      '    }',
      '    for (const tag of event.tags) {',
      "      if (tag.startsWith('x')) score++",
      '    }',
      '    this.total += score',
      '    return score',
      '  }',
      '',
    )
  }
  lines.push('}', '', '// End of the engine crust.', '')
  return lines.join('\n')
}

export function engineEvent() {
  return [
    'export interface EngineEvent {',
    '  kind: string',
    '  weight: number',
    '  priority: number',
    '  tags: string[]',
    '}',
    '',
  ].join('\n')
}

/** The engine's thin deep layer: small live helpers the crust calls. */
export function engineWeights() {
  const lines = ["import type { EngineEvent } from './event'", '']
  for (let i = 0; i < WEIGHERS; i++) {
    lines.push(
      `function weigh${i}(event: EngineEvent): number {`,
      `  const base = event.weight + ${i}`,
      `  if (event.tags.length > ${i % 4}) return base * 2`,
      '  return base',
      '}',
      '',
    )
  }
  const calls = Array.from({ length: WEIGHERS }, (_, i) => `weigh${i}(event)`).join(' + ')
  lines.push('export function weighAll(event: EngineEvent): number {', `  return ${calls}`, '}', '')
  return lines.join('\n')
}

export const CALIBRATION_SLICES = `
[[slice]]
name = "widgets"
paths = ["src/domains/widgets"]
crust = ["src/domains/widgets/index.ts"]
shape = "thin-facade"
may_depend_on = []
requires = []

[[slice]]
name = "engine"
paths = ["src/domains/engine"]
crust = ["src/domains/engine/index.ts"]
shape = "service"
may_depend_on = []
requires = []
`

function cap(word) {
  return word[0].toUpperCase() + word.slice(1)
}
