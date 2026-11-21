import { TIERS, type Tier } from './tiers'

function tierOf(customer: string): Tier | null {
  if (customer.startsWith('vip-')) return 'gold'
  return customer.startsWith('club-') ? 'silver' : null
}

export function applyDiscount(subtotal: number, customer: string): number {
  const tier = tierOf(customer)
  if (tier === null) return subtotal
  const { rate, floor } = TIERS[tier]
  return subtotal >= floor ? subtotal * (1 - rate) : subtotal
}
