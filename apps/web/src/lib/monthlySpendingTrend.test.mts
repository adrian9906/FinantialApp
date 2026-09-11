import assert from 'node:assert/strict'

import type { MonthlyPlanningHistory, Transaction, WishlistItem } from '@plata/shared'
import { buildMonthlySpendingTrend } from './monthlySpendingTrend.ts'

const transaction = (id: string, incomeSourceId: string, type: 'expense' | 'want', amount: number): Transaction => ({
  id,
  incomeSourceId,
  amount,
  type,
  description: type === 'expense' ? 'food::checked::0::Producto' : 'personal::checked::Producto',
  date: '2026-09-10',
})

const history: MonthlyPlanningHistory[] = [{
  id: 'agosto',
  month: '2026-08',
  label: 'Agosto 2026',
  createdAt: '2026-09-01T00:00:00.000Z',
  expenses: [
    { amount: 20, itemName: 'A', category: 'food', status: 'checked', date: '2026-08-10', incomeSourceId: 'cuenta-a' },
    { amount: 90, itemName: 'B', category: 'food', status: 'checked', date: '2026-08-11', incomeSourceId: 'cuenta-b' },
  ],
  wants: [],
}]

const wishlist: WishlistItem[] = [
  { id: 'deseo-a', incomeSourceId: 'cuenta-a', name: 'A', price: 30, savedAmount: 30, priority: 'medium', isPurchased: true, purchasedAt: '2026-09-09' },
  { id: 'deseo-b', incomeSourceId: 'cuenta-b', name: 'B', price: 70, savedAmount: 70, priority: 'medium', isPurchased: true, purchasedAt: '2026-09-09' },
]

const result = buildMonthlySpendingTrend({
  history,
  transactions: [transaction('gasto-a', 'cuenta-a', 'expense', 10), transaction('gasto-b', 'cuenta-b', 'expense', 80)],
  wishlist,
  currentPeriodStart: '2026-09-01T00:00:00.000Z',
  currentPeriodEnd: '2026-09-30',
  strictSameDayBoundary: false,
  incomeSourceId: 'cuenta-a',
})

assert.equal(result.series.find((point) => point.label.startsWith('Agosto'))?.gastos, 20)
assert.deepEqual(result.currentTotals, { gastos: 10, gustos: 0, ahorroUsado: 30 })
console.log('PASS: el gráfico mensual no mezcla movimientos ni ahorro usado de otras cuentas.')
