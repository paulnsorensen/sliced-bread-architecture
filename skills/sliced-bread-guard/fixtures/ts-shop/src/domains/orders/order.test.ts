import { discountFor } from '../pricing'
import { orderTotal } from './order'

if (orderTotal([60, 60]) !== 120 - discountFor(120)) {
  throw new Error('orderTotal applies the pricing discount')
}
