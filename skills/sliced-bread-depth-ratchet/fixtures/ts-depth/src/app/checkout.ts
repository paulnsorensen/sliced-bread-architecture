import { describeOrder, placeOrder, type Order } from '../domains/orders'
import * as pricing from '../domains/pricing'

export function checkout(customer: string, sku: string, qty: number): string {
  const order: Order = placeOrder(customer, [{ sku, qty, unit: 1250 }])
  const tiers = Object.keys(pricing.TIERS).length
  return `${describeOrder(order)} ${pricing.priceLabel(order.total, 'USD')} (${tiers} tiers)`
}

export function lineCount(order: import('../domains/orders').OrderLine[]): number {
  return order.length
}
