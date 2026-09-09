import {
  getWishlistReservedAmount,
  isInFinancialPeriod,
  isWishlistPurchased,
  parseExpenseDescription,
  parseWantDescription,
  type MonthlyPlanningHistory,
  type Transaction,
  type WishlistItem,
} from '@plata/shared'

import { getCanonicalPlanningHistory } from '@/lib/planningHistory'

export type MonthlySpendingCategory = 'gastos' | 'gustos' | 'ahorroUsado'

export type MonthlySpendingTrendPoint = Record<MonthlySpendingCategory, number> & {
  label: string
  period: string
}

const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' })
const fullDateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function nextMonthKey(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const next = new Date(Date.UTC(year, month, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
}

function formatMonth(monthKey: string, showYear: boolean) {
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return monthKey
  const name = monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)))
  const label = name.charAt(0).toUpperCase() + name.slice(1)
  return showYear ? `${label} ${year}` : label
}

function sumCompletedCycle(cycle: MonthlyPlanningHistory, type: 'expenses' | 'wants') {
  return cycle[type].reduce(
    (sum, entry) => entry.status === 'checked' ? sum + Math.max(0, entry.amount) : sum,
    0,
  )
}

export function buildMonthlySpendingTrend({
  history,
  transactions,
  wishlist,
  currentPeriodStart,
  currentPeriodEnd,
  strictSameDayBoundary,
  excludedTransactionIds = [],
}: {
  history: MonthlyPlanningHistory[]
  transactions: Transaction[]
  wishlist: WishlistItem[]
  currentPeriodStart: string
  currentPeriodEnd: string
  strictSameDayBoundary: boolean
  excludedTransactionIds?: string[]
}) {
  const currentStartKey = currentPeriodStart.slice(0, 10)
  const currentEndKey = currentPeriodEnd.slice(0, 10)
  const currentMonthKey = currentEndKey.slice(0, 7)
  const excludedIds = new Set(excludedTransactionIds)
  const totals = new Map<string, Omit<MonthlySpendingTrendPoint, 'label'>>()

  const ensureMonth = (monthKey: string, period = formatMonth(monthKey, true)) => {
    const current = totals.get(monthKey) ?? { period, gastos: 0, gustos: 0, ahorroUsado: 0 }
    totals.set(monthKey, current)
    return current
  }

  const closedCycles = getCanonicalPlanningHistory(history)
    .filter((cycle) => Number.isFinite(Date.parse(cycle.createdAt)) && Date.parse(cycle.createdAt) <= Date.parse(currentPeriodStart))

  closedCycles.forEach((cycle) => {
    const month = ensureMonth(cycle.month, cycle.label)
    month.gastos += sumCompletedCycle(cycle, 'expenses')
    month.gustos += sumCompletedCycle(cycle, 'wants')
  })

  const currentTotals: Record<MonthlySpendingCategory, number> = {
    gastos: 0,
    gustos: 0,
    ahorroUsado: 0,
  }

  transactions.forEach((transaction) => {
    if (
      excludedIds.has(transaction.id)
      || !isInFinancialPeriod(transaction, currentPeriodStart, strictSameDayBoundary)
      || transaction.date.slice(0, 10) > currentEndKey
    ) return

    if (transaction.type === 'expense' && parseExpenseDescription(transaction.description).status === 'checked') {
      currentTotals.gastos += Math.max(0, transaction.amount)
    }
    if (transaction.type === 'want' && parseWantDescription(transaction.description).status === 'checked') {
      currentTotals.gustos += Math.max(0, transaction.amount)
    }
  })

  wishlist.forEach((item) => {
    if (!isWishlistPurchased(item) || !item.purchasedAt) return
    const amount = getWishlistReservedAmount(item)
    if (amount <= 0) return

    const purchasedDate = item.purchasedAt.slice(0, 10)
    if (purchasedDate >= currentStartKey && purchasedDate <= currentEndKey) {
      currentTotals.ahorroUsado += amount
      return
    }

    if (Date.parse(item.purchasedAt) < Date.parse(currentPeriodStart)) {
      const historicalMonth = totals.get(purchasedDate.slice(0, 7))
      if (historicalMonth) historicalMonth.ahorroUsado += amount
    }
  })

  const currentMonth = ensureMonth(
    currentMonthKey,
    `Desde ${fullDateFormatter.format(new Date(`${currentStartKey}T00:00:00.000Z`))}`,
  )
  currentMonth.gastos += currentTotals.gastos
  currentMonth.gustos += currentTotals.gustos
  currentMonth.ahorroUsado += currentTotals.ahorroUsado

  const populatedMonths = [...totals.keys()].filter((monthKey) => monthKey <= currentMonthKey).sort()
  const firstMonth = populatedMonths[0] ?? currentMonthKey
  const monthKeys: string[] = []
  for (let monthKey = firstMonth; monthKey <= currentMonthKey; monthKey = nextMonthKey(monthKey)) {
    monthKeys.push(monthKey)
  }
  const showYear = new Set(monthKeys.map((monthKey) => monthKey.slice(0, 4))).size > 1
  const series = monthKeys.map((monthKey) => ({
    label: formatMonth(monthKey, showYear),
    ...ensureMonth(monthKey),
  }))

  return { series, currentTotals }
}
