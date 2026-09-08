import type { MonthlyPlanningHistory } from '@plata/shared'

function completedAmount(entry: MonthlyPlanningHistory) {
  return [...entry.expenses, ...entry.wants].reduce(
    (sum, item) => item.status === 'checked' ? sum + Math.max(0, item.amount) : sum,
    0,
  )
}

function shouldReplace(current: MonthlyPlanningHistory, candidate: MonthlyPlanningHistory) {
  const currentCompleted = completedAmount(current)
  const candidateCompleted = completedAmount(candidate)
  if (candidateCompleted !== currentCompleted) return candidateCompleted > currentCompleted

  const currentItems = current.expenses.length + current.wants.length
  const candidateItems = candidate.expenses.length + candidate.wants.length
  if (candidateItems !== currentItems) return candidateItems > currentItems

  return Date.parse(candidate.createdAt) > Date.parse(current.createdAt)
}

/**
 * A sync retry or repeated reset can leave more than one snapshot for the same
 * closing day. Keep the most complete one so lists, reports and charts all read
 * the same financial cycle.
 */
export function getCanonicalPlanningHistory(history: MonthlyPlanningHistory[]) {
  const byClosingDay = new Map<string, MonthlyPlanningHistory>()

  history.forEach((entry) => {
    const closingDay = entry.createdAt.slice(0, 10) || entry.id
    const current = byClosingDay.get(closingDay)
    if (!current || shouldReplace(current, entry)) byClosingDay.set(closingDay, entry)
  })

  return [...byClosingDay.values()].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
}
