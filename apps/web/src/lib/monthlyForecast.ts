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
}

function roundMoney(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100
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
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const elapsedDays = Math.max(1, Math.min(now.getDate(), daysInMonth))
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
  }
}
