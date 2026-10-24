import { discountFor } from '@shop/domains/pricing'
import type { Money } from '../common'

export function orderTotal(lines: Money[]): Money {
  const total = lines.reduce((sum, line) => sum + line, 0)
  return total - discountFor(total)
}
