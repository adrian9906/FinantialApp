import assert from 'node:assert/strict'

import type { IncomeSource, Salary, Transaction } from '@plata/shared'

import { reconcileSavingsAccountTransaction } from './savings-account-ledger.ts'

const sources: IncomeSource[] = [
  { id: 'income-usd', name: 'Salario', recurring: true, currencyCode: 'USD' },
  { id: 'savings-usd', name: 'Ahorro USD', recurring: true, currencyCode: 'USD' },
]
const salaries: Salary[] = [
  { id: 'savings-current', sourceId: 'savings-usd', sourceName: 'Ahorro USD', month: '2026-09', amount: 0, balance: 0 },
]
const deposit: Transaction = { id: 'deposit', type: 'saving', amount: 68, date: '2026-09-29', incomeSourceId: 'income-usd' }
const withdrawal: Transaction = { id: 'withdrawal', type: 'saving', amount: -20, date: '2026-09-29', incomeSourceId: 'income-usd' }

const deposited = reconcileSavingsAccountTransaction(salaries, sources, undefined, deposit)
assert.equal(deposited[0].balance, 68, 'un aporte aumenta el saldo acumulado real')

const withdrawn = reconcileSavingsAccountTransaction(deposited, sources, undefined, withdrawal)
assert.equal(withdrawn[0].balance, 48, 'un retiro disminuye el ahorro total')

const edited = reconcileSavingsAccountTransaction(deposited, sources, deposit, { ...deposit, amount: 50 })
assert.equal(edited[0].balance, 50, 'editar primero revierte el monto anterior y después aplica el nuevo')

const removed = reconcileSavingsAccountTransaction(edited, sources, { ...deposit, amount: 50 }, undefined)
assert.equal(removed[0].balance, 0, 'eliminar un aporte lo quita de la cuenta acumulada')

assert.throws(
  () => reconcileSavingsAccountTransaction(salaries, sources, undefined, withdrawal),
  /suficiente ahorro/,
  'no permite retirar más que el saldo de la cuenta',
)

console.log('Cuenta de ahorro: aportes y retiros actualizan un único saldo acumulado')
