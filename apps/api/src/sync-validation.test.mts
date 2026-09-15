import assert from 'node:assert/strict'
import { getLegacySyncOperation, getSyncValidationFields, parseSyncOperation } from './sync-validation.ts'

function parse(collection: string, value: unknown) {
  return parseSyncOperation({ id: 'operation-1', collection, entityId: 'record-1', baseVersion: null, value })
}

const account = { incomeSourceId: 'source-1', incomeSourceName: 'Cuenta CUP' }
const expense = { id: 'record-1', amount: 5, type: 'expense', description: 'food::pending::0::Pan', date: '2026-09-15', createdAt: '2026-09-15T12:00:00.000Z', isCash: false, ...account }
assert.deepEqual(parse('transactions', expense).value, expense, 'un gasto debe conservar su cuenta y método de pago')
const salary = { id: 'record-1', amount: 400, balance: 395, month: '2026-09', currencyCode: 'CUP', balanceMode: 'zero', sourceId: 'source-1', sourceName: 'Cuenta CUP', kind: 'recurring' }
assert.deepEqual(parse('salaries', salary).value, salary, 'el saldo y moneda no deben desaparecer al validar')
const source = { id: 'record-1', name: 'Cuenta CUP', recurring: true, archived: false, currencyCode: 'CUP', balanceMode: 'zero', isCash: false }
assert.deepEqual(parse('incomeSources', source).value, source)
const planningItem = { amount: 5, itemName: 'Pan', category: 'food', status: 'pending', date: '2026-09-15', ...account }
const history = { id: 'record-1', month: '2026-09', label: 'Septiembre', createdAt: '2026-09-15', expenses: [planningItem], wants: [], savingTransactionIds: [] }
assert.deepEqual(parse('monthlyPlanningHistory', history).value, history)
const wishlist = { id: 'record-1', name: 'Teléfono', price: 100, priority: 'medium', savedAmount: 0, ...account }
assert.deepEqual(parse('wishlist', wishlist).value, wishlist)
assert.equal((parse('wishlist', { ...wishlist, image: '' }).value as { image?: string }).image, undefined)
assert.equal((parse('wishlist', { ...wishlist, image: null }).value as { image?: string }).image, undefined)
assert.deepEqual(parse('transactions', { ...expense, attachments: ['https://res.cloudinary.com/example/image/upload/photo.jpg'] }).value, { ...expense, attachments: ['https://res.cloudinary.com/example/image/upload/photo.jpg'] })
for (const invalid of [{ amount: NaN }, { amount: -1 }, { date: '' }, { date: 'no-date' }, { attachments: ['javascript:alert(1)'] }]) {
  assert.throws(() => parse('transactions', { ...expense, ...invalid }))
}
try {
  parse('transactions', { ...expense, amount: null, date: 'private-value-not-a-date' })
  assert.fail('debe rechazar campos inválidos')
} catch (error) {
  assert.deepEqual(getSyncValidationFields(error), ['amount', 'date'])
  assert.ok(!JSON.stringify(getSyncValidationFields(error)).includes('private-value'))
}
assert.throws(() => parse('transactions', { ...expense, id: 'other-record' }))
assert.equal(parse('transactions', null).value, null)
const legacyExpense = getLegacySyncOperation(parse('transactions', expense))
assert.deepEqual(legacyExpense.value, { id: expense.id, amount: expense.amount, type: expense.type, description: expense.description, date: expense.date, createdAt: expense.createdAt, isCash: expense.isCash })
assert.equal((legacyExpense.value as { amount: number }).amount, 5)
assert.equal((getLegacySyncOperation(parse('salaries', salary)).value as { balance?: number }).balance, undefined)
assert.ok('balance' in salary, 'la compatibilidad no debe mutar el registro original')
console.log('Validación sync: gasto, cuentas, saldo, moneda, planificación, imágenes y errores sin datos personales correctos')
