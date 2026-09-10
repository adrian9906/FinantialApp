import assert from 'node:assert/strict'

import type { IncomeSource, Salary, Transaction } from '@plata/shared'
import { reconcileIncomeAccountCharge } from './income-account.ts'
import { getIncomeAccountsForMonth } from './income-account-view.ts'

const salaries: Salary[] = [
  { id: 'usd', amount: 100, balance: 100, month: '2026-09', sourceId: 'salary', sourceName: 'Salario', currencyCode: 'USD' },
  { id: 'cup', amount: 20, balance: 20, month: '2026-09', sourceId: 'cash', sourceName: 'Efectivo', currencyCode: 'CUP' },
]

const sources: IncomeSource[] = [
  { id: 'salary', name: 'Salario All Novu', recurring: true, isCash: true },
  { id: 'cash', name: 'Efectivo CUP', recurring: true, isCash: true },
]

assert.deepEqual(
  getIncomeAccountsForMonth(salaries, sources, '2026-09', 'USD').map((account) => account.source.id),
  ['salary'],
  'USD solo debe mostrar cuentas USD',
)
assert.deepEqual(
  getIncomeAccountsForMonth(salaries, sources, '2026-09', 'CUP').map((account) => account.source.id),
  ['cash'],
  'CUP solo debe mostrar cuentas CUP',
)

const expense: Transaction = {
  id: 'expense-1',
  amount: 10,
  type: 'expense',
  description: 'food::pending::Compra',
  date: '2026-09-10',
  incomeSourceId: 'salary',
  incomeSourceName: 'Salario',
}

const charged = reconcileIncomeAccountCharge(salaries, undefined, expense)
assert.equal(charged.find((salary) => salary.id === 'usd')?.balance, 90)
assert.equal(charged.find((salary) => salary.id === 'cup')?.balance, 20)

const edited = reconcileIncomeAccountCharge(charged, expense, { ...expense, amount: 25 })
assert.equal(edited.find((salary) => salary.id === 'usd')?.balance, 75)

const moved = reconcileIncomeAccountCharge(edited, { ...expense, amount: 25 }, {
  ...expense,
  amount: 15,
  incomeSourceId: 'cash',
  incomeSourceName: 'Efectivo',
})
assert.equal(moved.find((salary) => salary.id === 'usd')?.balance, 100)
assert.equal(moved.find((salary) => salary.id === 'cup')?.balance, 5)

const removed = reconcileIncomeAccountCharge(moved, {
  ...expense,
  amount: 15,
  incomeSourceId: 'cash',
  incomeSourceName: 'Efectivo',
}, undefined)
assert.equal(removed.find((salary) => salary.id === 'cup')?.balance, 20)

assert.throws(
  () => reconcileIncomeAccountCharge(salaries, undefined, { ...expense, amount: 101 }),
  /saldo suficiente/,
)

console.log('Income account charge tests passed')
