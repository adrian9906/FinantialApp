import assert from 'node:assert/strict'
import { applyIncomeMoneyMovement } from './income-money.ts'

let sequence = 0
const makeId = (prefix: string) => `${prefix}-${++sequence}`

const initial = {
  incomeSources: [
    { id: 'salary-source', name: 'Salario', recurring: true },
    { id: 'transfer-source', name: 'Transferencia', recurring: true },
  ],
  salaries: [
    { id: 'salary-usd', amount: 100, balance: 80, month: '2026-09', currencyCode: 'USD', sourceId: 'salary-source', sourceName: 'Salario', kind: 'recurring' as const },
    { id: 'transfer-cup', amount: 10, balance: 10, month: '2026-09', currencyCode: 'CUP', sourceId: 'transfer-source', sourceName: 'Transferencia', kind: 'recurring' as const },
  ],
}

const transferred = applyIncomeMoneyMovement(initial, {
  sourceSalaryId: 'salary-usd',
  amountUsd: 25,
  month: '2026-09',
  destination: { sourceId: 'transfer-source', currencyCode: 'CUP' },
}, makeId)

assert.equal(transferred.salaries.find((entry) => entry.id === 'salary-usd')?.amount, 100)
assert.equal(transferred.salaries.find((entry) => entry.id === 'transfer-cup')?.amount, 10)
assert.equal(transferred.salaries.find((entry) => entry.id === 'salary-usd')?.balance, 55)
assert.equal(transferred.salaries.find((entry) => entry.id === 'transfer-cup')?.balance, 35)
assert.equal(transferred.salaries.find((entry) => entry.id === 'salary-usd')?.transferAdjustment, -25)
assert.equal(transferred.salaries.find((entry) => entry.id === 'transfer-cup')?.transferAdjustment, 25)
assert.equal(transferred.salaries.find((entry) => entry.id === 'transfer-cup')?.currencyCode, 'CUP')

const assigned = applyIncomeMoneyMovement(transferred, {
  amountUsd: 5,
  month: '2026-09',
  destination: { newSourceName: 'Efectivo', currencyCode: 'CUP', recurring: true, balanceMode: 'zero', isCash: true },
}, makeId)

const createdSource = assigned.incomeSources.find((entry) => entry.name === 'Efectivo')
assert.ok(createdSource)
assert.equal(assigned.salaries.find((entry) => entry.sourceId === createdSource.id)?.amount, 5)
assert.equal(assigned.salaries.find((entry) => entry.sourceId === createdSource.id)?.currencyCode, 'CUP')
assert.equal(createdSource.balanceMode, 'zero')
assert.equal(createdSource.isCash, true)
assert.equal(assigned.salaries.find((entry) => entry.sourceId === createdSource.id)?.balanceMode, 'zero')

const movedToNewAccount = applyIncomeMoneyMovement(initial, {
  sourceSalaryId: 'salary-usd',
  amountUsd: 25,
  month: '2026-09',
  destination: { newSourceName: 'Ahorro USD Efectivo', currencyCode: 'USD' },
}, makeId)
const savingsSource = movedToNewAccount.incomeSources.find((entry) => entry.name === 'Ahorro USD Efectivo')
const savingsSalary = movedToNewAccount.salaries.find((entry) => entry.sourceId === savingsSource?.id)
assert.equal(movedToNewAccount.salaries.find((entry) => entry.id === 'salary-usd')?.amount, 100)
assert.equal(movedToNewAccount.salaries.find((entry) => entry.id === 'salary-usd')?.balance, 55)
assert.equal(savingsSalary?.amount, 0)
assert.equal(savingsSalary?.balance, 25)
assert.equal(savingsSalary?.transferAdjustment, 25)

const allocatedToSavings = applyIncomeMoneyMovement(initial, {
  sourceSalaryId: 'salary-usd',
  amountUsd: 25,
  month: '2026-09',
  preserveSourceBalance: true,
  destination: { newSourceName: 'Ahorro USD', currencyCode: 'USD' },
}, makeId)
assert.equal(allocatedToSavings.salaries.find((entry) => entry.id === 'salary-usd')?.amount, 100)
assert.equal(allocatedToSavings.salaries.find((entry) => entry.id === 'salary-usd')?.balance, 80)
assert.equal(allocatedToSavings.salaries.find((entry) => entry.id === 'salary-usd')?.transferAdjustment, undefined)
assert.equal(allocatedToSavings.salaries.find((entry) => entry.sourceName === 'Ahorro USD')?.balance, 25)

assert.throws(() => applyIncomeMoneyMovement(initial, {
  sourceSalaryId: 'salary-usd',
  amountUsd: 101,
  month: '2026-09',
  destination: { sourceId: 'transfer-source', currencyCode: 'CUP' },
}, makeId), /saldo suficiente/)

console.log('Income money movement tests passed')
