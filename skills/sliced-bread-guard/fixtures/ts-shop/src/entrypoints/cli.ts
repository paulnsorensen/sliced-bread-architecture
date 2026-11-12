import { checkout } from '../app/checkout'

export function main(args: string[]): string {
  return String(checkout(args))
}
