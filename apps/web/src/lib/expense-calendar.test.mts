import { strict as assert } from 'node:assert'
import { getCalendarExpenses, getCalendarMovements, getExpenseDay, toCalendarDay } from './expense-calendar.ts'

assert.equal(getExpenseDay('2026-09-15'), '2026-09-15')
assert.equal(getExpenseDay('invalid'), '')
assert.equal(getExpenseDay('2026-01-01T00:30:00Z'), toCalendarDay(new Date('2026-01-01T00:30:00Z')))
const originalTimezone = process.env.TZ
try {
  process.env.TZ = 'America/Havana'
  assert.equal(getExpenseDay('2026-01-01T00:30:00Z'), '2025-12-31')
  assert.equal(getExpenseDay('2026-01-01'), '2026-01-01')
  process.env.TZ = 'Asia/Tokyo'
  assert.equal(getExpenseDay('2026-12-31T23:30:00Z'), '2027-01-01')
} finally {
  if (originalTimezone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimezone
}
assert.equal(toCalendarDay(new Date(2026, 0, 0)), '2025-12-31')
assert.equal(toCalendarDay(new Date(2028, 1, 29)), '2028-02-29')
const transactions = [
  { id: 'paid', amount: 20, date: '2026-09-15', type: 'expense' as const, incomeSourceId: 'a', description: 'food::checked::0::Pan' },
  { id: 'pending', amount: 5, date: '2026-09-15', type: 'expense' as const, incomeSourceId: 'a', description: 'food::pending::0::Leche' },
  { id: 'other', amount: 99, date: '2026-09-15', type: 'expense' as const, incomeSourceId: 'b' },
  { id: 'want', amount: 99, date: '2026-09-15', type: 'want' as const, incomeSourceId: 'a' },
]
const history = [{ id: 'period', month: '2026-08', label: 'Agosto', createdAt: '2026-09-01', wants: [], expenses: [
  { amount: 10, itemName: 'Anterior', category: 'food', status: 'checked' as const, date: '2026-08-31', incomeSourceId: 'a' },
] }]
const entries = getCalendarExpenses(transactions, history, 'a')
assert.equal(entries.length, 3)
assert.equal(entries.find((entry) => entry.archived)?.date, '2026-08-31')
assert.equal(entries.filter((entry) => entry.date === '2026-09-15' && entry.status === 'checked').reduce((sum, entry) => sum + entry.amount, 0), 20)
assert.equal(getCalendarExpenses(transactions, history, '').length, 0)
assert.equal(getCalendarExpenses(transactions.filter((entry) => entry.id !== 'paid'), history, 'a').length, 2)
assert.equal(getCalendarExpenses(transactions.map((entry) => entry.id === 'paid' ? { ...entry, date: '2026-09-16' } : entry), history, 'a').find((entry) => entry.id === 'paid')?.date, '2026-09-16')
console.log('Calendar: dates, account isolation, history, paid/pending and updates passed')

const mixed = getCalendarMovements([...transactions,
  { id: 'saving', amount: 30, date: '2026-09-15', type: 'saving', incomeSourceId: 'a', description: 'transfer::expense' },
  { id: 'saving-other', amount: 100, date: '2026-09-15', type: 'saving', incomeSourceId: 'b' },
], [{ ...history[0], wants: [{ amount: 8, itemName: 'Cine', category: 'entertainment', status: 'pending', date: '2026-08-31', incomeSourceId: 'a' }] }], 'a')
assert.equal(mixed.length, 6)
assert.deepEqual([...new Set(mixed.filter((entry) => entry.date === '2026-09-15').map((entry) => entry.type))].sort(), ['expense', 'saving', 'want'])
assert.equal(mixed.find((entry) => entry.id === 'saving')?.itemName, 'Transferencia de gastos a ahorros')
assert.equal(mixed.find((entry) => entry.itemName === 'Cine')?.archived, true)
assert.equal(mixed.some((entry) => entry.incomeSourceId === 'b'), false)
assert.equal(getCalendarMovements(transactions, history, '').length, 0)
console.log('Calendar: expenses, wants, savings and historical wants passed')
