import type { Debt } from '@plata/shared'

export type DebtStrategy = 'snowball' | 'avalanche'

export type DebtPlanItem = {
  id: string
  history: string
  remainingAmount: number
  interest: number
  estimatedMinimum: number
  recommendedExtra: number
  estimatedMonths: number
}

export type DebtPlanSummary = {
  strategy: DebtStrategy
  monthsWithoutExtra: number
  monthsWithExtra: number
  monthsImproved: number
  order: DebtPlanItem[]
}

function getMonthDiff(from: Date, to: Date) {
  const years = to.getFullYear() - from.getFullYear()
  const months = to.getMonth() - from.getMonth()
  return years * 12 + months
}

function getEstimatedMinimumPayment(debt: Debt) {
  const now = new Date()
  const target = new Date(debt.endDate)
  const monthsLeft = Math.max(1, getMonthDiff(now, target) + 1)
  return Math.max(1, debt.remainingAmount / monthsLeft)
}

function sortDebts(debts: Debt[], strategy: DebtStrategy) {
  if (strategy === 'snowball') {
    return [...debts].sort((left, right) => left.remainingAmount - right.remainingAmount || (left.interest ?? 0) - (right.interest ?? 0))
  }

  return [...debts].sort((left, right) => (right.interest ?? 0) - (left.interest ?? 0) || left.remainingAmount - right.remainingAmount)
}

function runSimulation(debts: Debt[], strategy: DebtStrategy, extraMonthlyPayment: number) {
  const working = sortDebts(debts, strategy).map((debt) => ({
    ...debt,
    minimum: getEstimatedMinimumPayment(debt),
    remaining: debt.remainingAmount,
  }))

  let months = 0

  while (working.some((debt) => debt.remaining > 0) && months < 600) {
    months += 1
    let extra = Math.max(0, extraMonthlyPayment)

    for (const debt of working) {
      if (debt.remaining <= 0) continue

      const regularPayment = Math.min(debt.remaining, debt.minimum)
      debt.remaining -= regularPayment
    }

    for (const debt of working) {
      if (extra <= 0) break
      if (debt.remaining <= 0) continue

      const extraPayment = Math.min(debt.remaining, extra)
      debt.remaining -= extraPayment
      extra -= extraPayment
    }
  }

  return months
}

export function buildDebtPlanSummary(debts: Debt[], strategy: DebtStrategy, extraMonthlyPayment: number): DebtPlanSummary {
  const activeDebts = debts.filter((debt) => !debt.isSettled && debt.remainingAmount > 0)
  const ordered = sortDebts(activeDebts, strategy)

  const monthsWithoutExtra = runSimulation(activeDebts, strategy, 0)
  const monthsWithExtra = runSimulation(activeDebts, strategy, extraMonthlyPayment)
  const totalMinimum = ordered.reduce((sum, debt) => sum + getEstimatedMinimumPayment(debt), 0)

  return {
    strategy,
    monthsWithoutExtra,
    monthsWithExtra,
    monthsImproved: Math.max(0, monthsWithoutExtra - monthsWithExtra),
    order: ordered.map((debt, index) => {
      const estimatedMinimum = getEstimatedMinimumPayment(debt)
      return {
        id: debt.id,
        history: debt.history,
        remainingAmount: debt.remainingAmount,
        interest: debt.interest ?? 0,
        estimatedMinimum: Math.round(estimatedMinimum * 100) / 100,
        recommendedExtra: index === 0 ? Math.max(0, extraMonthlyPayment) : 0,
        estimatedMonths: totalMinimum > 0
          ? Math.max(1, Math.ceil(debt.remainingAmount / (estimatedMinimum + (index === 0 ? extraMonthlyPayment : 0))))
          : 0,
      }
    }),
  }
}
