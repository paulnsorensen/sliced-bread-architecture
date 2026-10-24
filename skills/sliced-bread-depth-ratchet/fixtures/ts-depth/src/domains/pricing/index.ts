// Pricing crust. priceLabel holds logic that belongs in an internal module.
import type { Cents } from '../common/money'

export { applyDiscount } from './discount'
export { TIERS } from './tiers'

export function priceLabel(value: Cents, currency: string): string {
  const units = Math.floor(value / 100)
  const cents = value % 100
  const padded = cents < 10 ? `0${cents}` : `${cents}`
  if (currency === 'EUR') {
    return `${units},${padded} EUR`
  }
  return `${currency} ${units}.${padded}`
}
