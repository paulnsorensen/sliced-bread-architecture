// Legacy debt: reaches past the pricing crust. The adoption baseline records it.
import { discountFor } from '../domains/pricing/discount'

export function discountReport(totals: number[]): string {
  return totals.map((total) => `${total}: -${discountFor(total)}`).join('\n')
}
