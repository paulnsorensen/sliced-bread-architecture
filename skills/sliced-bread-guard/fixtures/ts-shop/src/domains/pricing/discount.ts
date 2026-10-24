import type { Money } from '../common'

export function discountFor(total: Money): Money {
  return total > 100 ? 10 : 0
}
