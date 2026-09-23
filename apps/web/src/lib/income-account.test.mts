import assert from 'node:assert/strict'

import { createEmptyBootstrapPayload, getSalaryPlanningBase, normalizeBootstrapPayload, type IncomeSource, type Salary, type Transaction } from '@plata/shared'
import { reconcileIncomeAccountCharge } from './income-account.ts'
import { getIncomeAccountOverview, getIncomeAccountsForMonth } from './income-account-view.ts'
import { applyIncomeMoneyMovement } from './income-money.ts'

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
assert.equal(charged.find((salary) => salary.id === 'usd')?.amount, 100, 'el gasto no debe reducir el ingreso original')
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

// A transfer funds the destination's expense budget even when it registered no income.
const emptyTransferAccount: Salary = { id: 'transfer', amount: 0, balance: 0, month: '2026-09', sourceId: 'transfer-source', sourceName: 'Transferencia', currencyCode: 'CUP' }
const transferSource: IncomeSource = { id: 'transfer-source', name: 'Transferencia CUP', recurring: true, isCash: false }
const movedMoney = applyIncomeMoneyMovement(
  { salaries: [salaries[0], emptyTransferAccount], incomeSources: [sources[0], transferSource] },
  { sourceSalaryId: 'usd', amountUsd: 30, month: '2026-09', destination: { sourceId: 'transfer-source', currencyCode: 'CUP' } },
  () => 'unused',
)
const persisted = normalizeBootstrapPayload({ ...createEmptyBootstrapPayload(), ...movedMoney })
const destination = getIncomeAccountsForMonth(persisted.salaries, persisted.incomeSources, '2026-09').find((account) => account.source.id === 'transfer-source')!
const origin = getIncomeAccountsForMonth(persisted.salaries, persisted.incomeSources, '2026-09').find((account) => account.source.id === 'salary')!
const expenseFormula = { expenses: 100, wants: 0, savings: 0, rolloverSavings: false }
assert.equal(getSalaryPlanningBase(destination.salary), 30)
assert.equal(getIncomeAccountOverview(destination, [], expenseFormula).budgetExpenses, 30)
assert.equal(getIncomeAccountOverview(origin, [], expenseFormula).budgetExpenses, 70)
const transferExpense = { ...expense, id: 'expense-transfer', amount: 20, incomeSourceId: 'transfer-source' }
const afterSpending = reconcileIncomeAccountCharge(persisted.salaries, undefined, transferExpense)
assert.equal(afterSpending.find((salary) => salary.id === 'transfer')?.balance, 10)
assert.equal(getIncomeAccountOverview({ ...destination, salary: afterSpending.find((salary) => salary.id === 'transfer')! }, [transferExpense], expenseFormula).budgetExpenses, 30)
const legacy = normalizeBootstrapPayload({
  ...createEmptyBootstrapPayload(),
  salaries: [{ ...emptyTransferAccount, balance: 18 }],
  incomeSources: [transferSource],
})
assert.equal(legacy.salaries[0].transferAdjustment, 18, 'una transferencia anterior también queda disponible')

console.log('Income account charge tests passed')
