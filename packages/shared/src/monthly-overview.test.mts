import { strict as assert } from 'node:assert'

import { getPlannedExpenseTotal } from './expense-utils.ts'
import { getMonthlyOverview } from './monthly-overview.ts'
import { getPlannedWantTotal } from './want-utils.ts'
import type { Transaction } from './types.ts'

const transactions: Transaction[] = [
  { id: 'old-expense', amount: 500, type: 'expense', description: 'food::pending::0::Anterior', date: '2026-08-20' },
  { id: 'current-expense', amount: 80, type: 'expense', description: 'food::pending::0::Actual', date: '2026-09-05' },
  { id: 'old-want', amount: 300, type: 'want', description: 'shopping::pending::Anterior', date: '2026-08-21' },
  { id: 'current-want', amount: 40, type: 'want', description: 'shopping::pending::Actual', date: '2026-09-06' },
]

const overview = getMonthlyOverview([], transactions, [], {
  expenses: 50,
  savings: 30,
  wants: 20,
  rolloverSavings: false,
}, {
  periodStart: '2026-09-01T00:00:00.000Z',
  periodEnd: '2026-09-09',
})

assert.deepEqual(
  overview.periodTransactions.map((transaction) => transaction.id),
  ['current-expense', 'current-want'],
  'el resumen debe exponer solamente las transacciones del periodo actual',
)
assert.equal(getPlannedExpenseTotal(overview.periodTransactions), 80)
assert.equal(getPlannedWantTotal(overview.periodTransactions), 40)

console.log('PASS: la planificacion usa exactamente las transacciones del resumen mensual')

const resetOverview = getMonthlyOverview([], [
  {
    id: 'restored-backdated-expense',
    amount: 25,
    type: 'expense',
    description: 'food::checked::0::Compra restaurada',
    date: '2026-08-02',
    createdAt: '2026-08-02T12:00:00.000Z',
  },
  {
    id: 'planned-future-expense',
    amount: 15,
    type: 'expense',
    description: 'services::pending::0::Pago planificado',
    date: '2026-09-30',
    createdAt: '2026-09-07T12:00:00.000Z',
  },
  {
    id: 'old-saving',
    amount: 50,
    type: 'saving',
    description: 'Ahorro anterior',
    date: '2026-08-02',
    createdAt: '2026-08-02T12:00:00.000Z',
  },
], [], {
  expenses: 50,
  savings: 30,
  wants: 20,
  rolloverSavings: false,
}, {
  periodStart: '2026-08-26T15:56:40.348Z',
  periodEnd: '2026-09-10',
  strictSameDayBoundary: true,
})

assert.deepEqual(
  resetOverview.periodTransactions.map((transaction) => transaction.id),
  ['planned-future-expense'],
  'el ciclo debe excluir gastos anteriores al reset y conservar los planificados para una fecha futura del ciclo',
)
assert.equal(getPlannedExpenseTotal(resetOverview.periodTransactions), 15)
assert.equal(resetOverview.totalExpenses, 0)

console.log('PASS: el reset separa el ciclo anterior sin perder la planificación futura')
