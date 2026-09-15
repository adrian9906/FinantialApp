import { strict as assert } from 'node:assert'
import { getWidgetTodayExpenses } from './home-widget-summary.ts'

const transactions = [
  { id: 'paid', amount: 20, date: '2026-09-15', type: 'expense' as const, incomeSourceId: 'a', description: 'food::checked::0::Pan' },
  { id: 'pending', amount: 50, date: '2026-09-15', type: 'expense' as const, incomeSourceId: 'a', description: 'food::pending::0::Leche' },
  { id: 'other', amount: 100, date: '2026-09-15', type: 'expense' as const, incomeSourceId: 'b', description: 'food::checked::0::Pan' },
  { id: 'want', amount: 100, date: '2026-09-15', type: 'want' as const, incomeSourceId: 'a' },
  { id: 'old', amount: 100, date: '2026-09-14', type: 'expense' as const, incomeSourceId: 'a', description: 'food::checked::0::Pan' },
  { id: 'invalid', amount: Number.NaN, date: '2026-09-15', type: 'expense' as const, incomeSourceId: 'a', description: 'food::checked::0::Pan' },
]
const history = [{ id: 'cycle', month: '2026-09', label: 'Septiembre', createdAt: '2026-09-15', wants: [], expenses: [
  { amount: 7, itemName: 'Compra archivada', category: 'food', status: 'checked' as const, date: '2026-09-15', incomeSourceId: 'a' },
  { amount: 100, itemName: 'Pendiente', category: 'food', status: 'pending' as const, date: '2026-09-15', incomeSourceId: 'a' },
] }]
assert.equal(getWidgetTodayExpenses(transactions, history, 'a', '2026-09-15'), 27)
assert.equal(getWidgetTodayExpenses(transactions, history, 'b', '2026-09-15'), 100)
assert.equal(getWidgetTodayExpenses(transactions, history, '', '2026-09-15'), 0)
assert.equal(getWidgetTodayExpenses([], [], 'a', '2026-09-15'), 0)
const timezone = process.env.TZ
try {
  process.env.TZ = 'America/Havana'
  const timestamp = [{ ...transactions[0], date: '2026-09-16T00:30:00Z' }]
  assert.equal(getWidgetTodayExpenses(timestamp, [], 'a', '2026-09-15'), 20)
  assert.equal(getWidgetTodayExpenses(timestamp, [], 'a', '2026-09-16'), 0)
} finally {
  if (timezone === undefined) delete process.env.TZ
  else process.env.TZ = timezone
}
console.log('Widget summary: paid expenses, account isolation, history, invalid amounts and local dates passed')
