import { describeOrder, placeOrder } from './index'

const order = placeOrder('alice', [{ sku: 'a', qty: 2, unit: 300 }])
if (!describeOrder(order).startsWith('ord-')) {
  throw new Error('unexpected id')
}
