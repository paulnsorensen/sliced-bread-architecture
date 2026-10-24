import { applyDiscount } from '../pricing'
import { roundCents } from '../common/money'
import { lineTotal, type Order, type OrderLine } from './model'
import { validateLines } from './validate'

let sequence = 0

export function placeOrder(customer: string, lines: OrderLine[]): Order {
  const problems = validateLines(lines)
  if (problems.length > 0) {
    throw new Error(problems.join('; '))
  }
  let subtotal = 0
  for (const line of lines) {
    subtotal += lineTotal(line)
  }
  sequence += 1
  return {
    id: `ord-${sequence}`,
    customer,
    lines,
    total: roundCents(applyDiscount(subtotal, customer)),
  }
}
