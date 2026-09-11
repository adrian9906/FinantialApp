import {
  getMonthlyOverview,
  type AllocationFormula,
  type Debt,
  type MonthlyPlanningHistory,
  type Reminder,
  type Salary,
  type Transaction,
} from '@plata/shared'

import { buildFinancialScore, type FinancialScoreSummary } from '@/lib/financialInsights'
import { buildSnapshotTransactions } from '@/lib/reporting'
import { buildUnnecessarySpendingInsights } from '@/lib/unnecessary-spending'

const scoreDateFormatter = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' })

export type FinancialScoreHistoryPoint = {
  id: string
  label: string
  shortLabel: string
  score: number
  status: FinancialScoreSummary['status']
  closedAt: string
  isCurrent: boolean
}

function inferFirstCycleStart(value: string) {
  const date = new Date(value)
  date.setUTCMonth(date.getUTCMonth() - 1)
  return date.toISOString()
}

function getDebtStateAt(debt: Debt, periodEnd: string): Debt | null {
  if (debt.startDate.slice(0, 10) > periodEnd.slice(0, 10)) return null

  const payments = (debt.payments ?? []).filter((payment) => payment.date.slice(0, 10) <= periodEnd.slice(0, 10))
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const remainingAmount = Math.max(0, debt.amount - paidAmount)

  return {
    ...debt,
    payments,
    paidAmount,
    remainingAmount,
    progress: debt.amount > 0 ? Math.min(100, Math.round((paidAmount / debt.amount) * 100)) : 100,
    isSettled: remainingAmount <= 0,
  }
}

export function buildFinancialScoreHistory({
  history,
  salaries,
  transactions,
  debts,
  reminders,
  formula,
  currentScore,
  currentPeriodEnd,
  incomeSourceId,
}: {
  history: MonthlyPlanningHistory[]
  salaries: Salary[]
  transactions: Transaction[]
  debts: Debt[]
  reminders: Reminder[]
  formula: AllocationFormula
  currentScore: FinancialScoreSummary
  currentPeriodEnd: string
  incomeSourceId?: string
}): FinancialScoreHistoryPoint[] {
  const sortedHistory = [...history].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  const closedCycles = sortedHistory.map((snapshot, index): FinancialScoreHistoryPoint => {
    const periodStart = sortedHistory[index - 1]?.createdAt ?? inferFirstCycleStart(snapshot.createdAt)
    const periodEnd = snapshot.createdAt
    const savingIds = new Set(snapshot.savingTransactionIds ?? [])
    const snapshotTransactions = [
      ...buildSnapshotTransactions(snapshot).filter((transaction) => !incomeSourceId || transaction.incomeSourceId === incomeSourceId),
      ...transactions.filter((transaction) => savingIds.has(transaction.id) && (!incomeSourceId || transaction.incomeSourceId === incomeSourceId)),
    ]
    const historicalDebts = debts.flatMap((debt) => {
      const state = getDebtStateAt(debt, periodEnd)
      return state ? [state] : []
    })
    const historicalReminders = reminders.filter((reminder) => reminder.date.slice(0, 10) <= periodEnd.slice(0, 10))
    const overview = getMonthlyOverview(salaries, snapshotTransactions, historicalDebts, formula, {
      periodStart,
      periodEnd,
      salaryMonth: snapshot.month,
      strictSameDayBoundary: true,
    })
    const unnecessarySpending = buildUnnecessarySpendingInsights(
      snapshotTransactions,
      snapshot.month,
      periodStart,
      periodEnd,
    )
    const score = buildFinancialScore({
      overview: { ...overview, freeSavings: overview.accumulatedSavings },
      debts: historicalDebts,
      reminders: historicalReminders,
      unnecessarySpending,
      asOf: periodEnd,
    })

    return {
      id: snapshot.id,
      label: snapshot.label,
      shortLabel: scoreDateFormatter.format(new Date(snapshot.createdAt)),
      score: score.score,
      status: score.status,
      closedAt: snapshot.createdAt,
      isCurrent: false,
    }
  })

  const currentPoint: FinancialScoreHistoryPoint = {
    id: 'current-cycle',
    label: 'Ciclo actual',
    shortLabel: 'Actual',
    score: currentScore.score,
    status: currentScore.status,
    closedAt: currentPeriodEnd,
    isCurrent: true,
  }

  return [...closedCycles, currentPoint].slice(-7)
}
