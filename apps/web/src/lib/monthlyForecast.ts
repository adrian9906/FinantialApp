export type BudgetForecast = {
  current: number
  budget: number
  projected: number
  difference: number
  progress: number
  status: 'no-data' | 'on-track' | 'watch' | 'over'
}

type MonthlyForecastInput = {
  currentExpenses: number
  currentWants: number
  plannedExpenses: number
  plannedWants: number
  budgetExpenses: number
  budgetWants: number
  totalSalary: number
  totalDebtPaid: number
  totalSavings: number
  budgetSavings: number
  now?: Date
  periodStart?: string
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function buildBucketForecast(current: number, planned: number, budget: number, elapsedDays: number, daysInMonth: number): BudgetForecast {
  const paceProjection = elapsedDays > 0 ? (current / elapsedDays) * daysInMonth : current
  const projected = roundMoney(Math.max(current, planned, paceProjection))
  const difference = roundMoney(budget - projected)
  const progress = budget > 0 ? Math.round((projected / budget) * 100) : projected > 0 ? 100 : 0
  const status = current === 0 && planned === 0
    ? 'no-data'
    : difference < 0
      ? 'over'
      : progress >= 90
        ? 'watch'
        : 'on-track'

  return { current, budget, projected, difference, progress, status }
}

export function buildMonthlyForecast(input: MonthlyForecastInput) {
  const now = input.now ?? new Date()
  const start = input.periodStart ? new Date(input.periodStart) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const nextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  const lastDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate()
  const cycleEnd = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), Math.min(start.getUTCDate(), lastDay)))
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const daysInMonth = Math.max(1, Math.round((cycleEnd.getTime() - startDay) / 86_400_000))
  const elapsedDays = Math.max(1, Math.min(Math.floor((today - startDay) / 86_400_000) + 1, daysInMonth))
  const remainingDays = Math.max(0, daysInMonth - elapsedDays)
  const expenses = buildBucketForecast(
    input.currentExpenses,
    input.plannedExpenses,
    input.budgetExpenses,
    elapsedDays,
    daysInMonth,
  )
  const wants = buildBucketForecast(
    input.currentWants,
    input.plannedWants,
    input.budgetWants,
    elapsedDays,
    daysInMonth,
  )
  const protectedSavings = Math.max(input.totalSavings, input.budgetSavings)
  const projectedCommitted = input.totalDebtPaid + expenses.projected + wants.projected + protectedSavings
  const safeRemaining = roundMoney(Math.max(0, input.totalSalary - projectedCommitted))
  const projectedBalance = roundMoney(input.totalSalary - projectedCommitted)
  const safePerDay = remainingDays > 0 ? roundMoney(safeRemaining / remainingDays) : safeRemaining

  return {
    expenses,
    wants,
    elapsedDays,
    remainingDays,
    daysInMonth,
    protectedSavings,
    projectedCommitted: roundMoney(projectedCommitted),
    projectedBalance,
    safeRemaining,
    safePerDay,
    periodStart: start.toISOString(),
    cycleEndsAt: cycleEnd.toISOString(),
  }
}
