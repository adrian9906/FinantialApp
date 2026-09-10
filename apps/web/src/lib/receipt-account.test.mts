import assert from 'node:assert/strict'

import type { IncomeSource, Salary } from '@plata/shared'
import {
  getAccountPaymentMethod,
  getEligibleReceiptAccounts,
  getMissingReceiptAccountMessage,
  getReceiptCurrencyCodes,
  resolveReceiptAccountId,
} from './receipt-account.ts'

function account(id: string, currencyCode: string, isCash: boolean) {
  const source: IncomeSource = { id, name: `Cuenta ${id}`, recurring: true, isCash }
  const salary: Salary = { id: `${id}-salary`, amount: 100, balance: 100, month: '2026-09', sourceId: id, currencyCode }
  return { source, salary }
}

const usdCash = account('usd-cash', 'USD', true)
const cupCash = account('cup-cash', 'CUP', true)
const cupTransfer = account('cup-transfer', 'CUP', false)
const cupTransfer2 = account('cup-transfer-2', 'CUP', false)
const accounts = [usdCash, cupCash, cupTransfer, cupTransfer2]

// El recibo se carga a una sola cuenta: moneda y forma de pago deciden cuales sirven.
assert.deepEqual(
  getEligibleReceiptAccounts(accounts, 'CUP', 'transfer').map((entry) => entry.source.id),
  ['cup-transfer', 'cup-transfer-2'],
  'CUP + transferencia no debe incluir cuentas de efectivo ni de otra moneda',
)
assert.deepEqual(
  getEligibleReceiptAccounts(accounts, 'CUP', 'cash').map((entry) => entry.source.id),
  ['cup-cash'],
)
assert.deepEqual(getEligibleReceiptAccounts(accounts, 'cup', 'transfer').length, 2, 'la moneda no distingue mayusculas')
console.log('PASS 1: solo se ofrecen cuentas de la moneda y forma de pago elegidas')

// Una cuenta de transferencia no puede recibir un gasto en efectivo.
assert.equal(getAccountPaymentMethod(cupTransfer), 'transfer')
assert.equal(getAccountPaymentMethod(cupCash), 'cash')
assert.deepEqual(getEligibleReceiptAccounts([cupTransfer], 'CUP', 'cash'), [], 'una cuenta de transferencia no acepta efectivo')
console.log('PASS 2: una cuenta de transferencia no acepta efectivo')

// Con varias cuentas el usuario elige, y su eleccion se respeta mientras sea valida.
const eligible = getEligibleReceiptAccounts(accounts, 'CUP', 'transfer')
assert.equal(resolveReceiptAccountId(eligible, 'cup-transfer-2'), 'cup-transfer-2', 'respeta la cuenta elegida')
assert.equal(resolveReceiptAccountId(eligible, 'usd-cash'), 'cup-transfer', 'si la eleccion ya no sirve usa la primera valida')
assert.equal(resolveReceiptAccountId(eligible, ''), 'cup-transfer')
console.log('PASS 3: se respeta la cuenta elegida y hay un valor por defecto')

// Sin cuenta compatible hay que avisar y bloquear en vez de cargar a otra cuenta.
assert.equal(resolveReceiptAccountId(getEligibleReceiptAccounts(accounts, 'EUR', 'cash'), ''), '')
const message = getMissingReceiptAccountMessage('cup', 'transfer')
assert.match(message, /CUP/)
assert.match(message, /Transferencia/)
console.log('PASS 4: sin cuenta compatible se avisa y no se elige ninguna')

// El selector de moneda solo debe ofrecer monedas que tengan cuentas.
assert.deepEqual(getReceiptCurrencyCodes(accounts), ['CUP', 'USD'])
assert.deepEqual(getReceiptCurrencyCodes([]), [])
console.log('PASS 5: solo se ofrecen monedas con cuentas existentes')

console.log('Seleccion de cuenta para recibos correcta.')
