// Catalog table: data, not logic.
export const TIERS = {
  gold: { rate: 0.1, floor: 5000 },
  silver: { rate: 0.05, floor: 10000 },
} as const

export type Tier = keyof typeof TIERS
