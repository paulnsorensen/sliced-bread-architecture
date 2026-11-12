import type { Money } from '../common'

export function priceOf(sku: string): Money {
  return sku.length * 10
}
