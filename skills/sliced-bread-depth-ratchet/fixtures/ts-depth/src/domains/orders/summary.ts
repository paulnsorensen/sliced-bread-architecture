import type { Order } from './model'

export function summarize(order: Order): string {
  const count = order.lines.length
  const noun = count === 1 ? 'line' : 'lines'
  const big = order.lines.some((line) => line.qty > 10)
  return big ? `${count} ${noun}, bulk` : `${count} ${noun}`
}
