import assert from 'node:assert/strict'
import { serializeWishlist, writeSyncRecord } from './api.js'
import { isWishlistPurchased, type SyncOperation } from '@plata/shared'
import type { Prisma } from './generated/prisma/client.js'

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

let stored: { comprado: boolean; fecha: Date } | null = null
const tx = {
  deseo: {
    findFirst: async () => stored,
    deleteMany: async () => { stored = null },
    create: async ({ data }: { data: { comprado: boolean; fecha: Date } }) => { stored = data },
  },
} as unknown as Prisma.TransactionClient
const operation: SyncOperation = {
  id: 'sync-purchase', collection: 'wishlist', entityId: 'wish', baseVersion: null,
  value: { ...purchased, purchasedAt: '2026-07-01T03:41:08.613Z' },
}
async function syncPurchase(value = operation.value) {
  await writeSyncRecord('owner', { ...operation, value }, tx)
  return (stored as unknown as { comprado: boolean; fecha: Date }).fecha.toISOString()
}
assert.equal(await syncPurchase(), '2026-07-01T03:41:08.613Z', 'una compra histórica conserva su fecha al importarse')
assert.equal(await syncPurchase({ ...purchased, purchasedAt: '2026-10-09T00:00:00.000Z' }),
  '2026-07-01T03:41:08.613Z', 'una copia antigua con fecha corrupta no vuelve a gastar los ahorros')
assert.equal(await syncPurchase({ ...purchased, purchasedAt: undefined }),
  '2026-07-01T03:41:08.613Z', 'un cliente sin fecha conserva la compra existente')
await syncPurchase({ ...pending })
assert.equal(await syncPurchase({ ...purchased, purchasedAt: '2026-10-09T00:00:00.000Z' }),
  '2026-10-09T00:00:00.000Z', 'una compra nueva sí utiliza la fecha de compra nueva')
console.log('Sincronización: las compras antiguas conservan su fecha y las nuevas mantienen su descuento')
