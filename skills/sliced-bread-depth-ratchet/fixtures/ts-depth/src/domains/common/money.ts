export type Cents = number

export function roundCents(value: number): Cents {
  return Math.round(value)
}
