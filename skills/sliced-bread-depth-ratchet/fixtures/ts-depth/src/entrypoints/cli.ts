import { checkout } from '../app/checkout'

console.log(checkout(process.argv[2] ?? 'guest', 'sku-1', 3))
