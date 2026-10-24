import type { Cents } from '../common/money'

export interface OrderLine {
  sku: string
  qty: number
  unit: Cents
}

export interface Order {
  id: string
  customer: string
  lines: OrderLine[]
  total: Cents
}

export function lineTotal(line: OrderLine): Cents {
  return line.qty * line.unit
}
