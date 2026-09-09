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
    { id: 'salary-usd', amount: 100, month: '2026-09', currencyCode: 'USD', sourceId: 'salary-source', sourceName: 'Salario', kind: 'recurring' as const },
    { id: 'transfer-cup', amount: 10, month: '2026-09', currencyCode: 'CUP', sourceId: 'transfer-source', sourceName: 'Transferencia', kind: 'recurring' as const },
  ],
}

const transferred = applyIncomeMoneyMovement(initial, {
  sourceSalaryId: 'salary-usd',
  amountUsd: 25,
  month: '2026-09',
  destination: { sourceId: 'transfer-source', currencyCode: 'CUP' },
}, makeId)

assert.equal(transferred.salaries.find((entry) => entry.id === 'salary-usd')?.amount, 75)
assert.equal(transferred.salaries.find((entry) => entry.id === 'transfer-cup')?.amount, 35)
assert.equal(transferred.salaries.find((entry) => entry.id === 'transfer-cup')?.currencyCode, 'CUP')

const assigned = applyIncomeMoneyMovement(transferred, {
  amountUsd: 5,
  month: '2026-09',
  destination: { newSourceName: 'Efectivo', currencyCode: 'CUP' },
}, makeId)

const createdSource = assigned.incomeSources.find((entry) => entry.name === 'Efectivo')
assert.ok(createdSource)
assert.equal(assigned.salaries.find((entry) => entry.sourceId === createdSource.id)?.amount, 5)
assert.equal(assigned.salaries.find((entry) => entry.sourceId === createdSource.id)?.currencyCode, 'CUP')

assert.throws(() => applyIncomeMoneyMovement(initial, {
  sourceSalaryId: 'salary-usd',
  amountUsd: 101,
  month: '2026-09',
  destination: { sourceId: 'transfer-source', currencyCode: 'CUP' },
}, makeId), /saldo suficiente/)

console.log('Income money movement tests passed')
