import { priceOf } from '../domains/catalog'
import { orderTotal } from '../domains/orders'

export function checkout(skus: string[]): number {
  return orderTotal(skus.map(priceOf))
}
