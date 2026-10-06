import assert from 'node:assert/strict'
import { serializeWishlist } from './api.js'
import { isWishlistPurchased } from '@plata/shared'

const entry = {
  id: 'wish', cantidad: 200, aportado: 0, comprado: false, fecha: new Date('2026-10-01'),
  items: [{ nombre: 'Meta', precio: 200, prioridad: 'high', foto: null, tienda: null, urlReferencia: null, moneda: 'USD' }],
}
const pending = serializeWishlist(entry)
assert.equal(pending.isPurchased, false, 'un deseo financiado no es una compra')
assert.equal(pending.savedAmount, 0, 'el servidor no convierte dinero asignado en dinero gastado')
assert.equal(pending.purchasedAt, undefined)
assert.equal(isWishlistPurchased({ price: 200, savedAmount: 200 }), false,
  'las reservas antiguas sin confirmación no gastan ahorros')
const purchased = serializeWishlist({ ...entry, comprado: true })
assert.equal(purchased.isPurchased, true)
assert.equal(purchased.savedAmount, 200, 'una compra confirmada sí conserva el descuento')
console.log('Deseos: solo las compras explícitas consumen ahorros')
