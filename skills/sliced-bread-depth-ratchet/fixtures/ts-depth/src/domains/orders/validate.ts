import type { OrderLine } from './model'

export function validateLines(lines: OrderLine[]): string[] {
  const problems: string[] = []
  for (const line of lines) {
    if (line.qty <= 0) {
      problems.push(`${line.sku}: quantity must be positive`)
    } else if (line.qty > 1000) {
      problems.push(`${line.sku}: quantity too large`)
    }
    if (!line.sku) problems.push('missing sku')
  }
  return problems
}
