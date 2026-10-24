// Orders crust: the public seam. A thin facade over the order model.
import { summarize } from './summary'
import type { Order } from './model'

export type { Order, OrderLine } from './model'
export { placeOrder } from './place'

export function describeOrder(order: Order): string {
  const summary = summarize(order)
  return `${order.id}: ${summary}`
}
