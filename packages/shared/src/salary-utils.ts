import type { IncomeSource, Salary } from './types.js'

export function getMonthKey(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function addMonthsToKey(monthKey: string, amount: number) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + amount, 1)
  return getMonthKey(date)
}

/** Legacy records have no source; they behave as one recurring income. */
export const LEGACY_INCOME_KEY = 'legacy'

export function getIncomeKey(salary: Salary) {
  return salary.sourceId ?? LEGACY_INCOME_KEY
}

export function isRecurringIncome(salary: Salary) {
  // Legacy entries carried forward, so an unset kind keeps that behaviour.
  return (salary.kind ?? 'recurring') === 'recurring'
}

/**
 * Keeps one entry per income source per month, newest first. A month may now
 * hold several incomes (one per job, plus any one-off bonus).
 */
export function normalizeSalaryHistory(salaries: Salary[]) {
  const byMonthAndSource = new Map<string, Salary>()

  for (const salary of salaries) {
    const key = `${salary.month}/${getIncomeKey(salary)}/${salary.kind === 'one-off' ? salary.id : ''}`
    if (!byMonthAndSource.has(key)) byMonthAndSource.set(key, salary)
  }

  return [...byMonthAndSource.values()].sort(
    (a, b) => b.month.localeCompare(a.month)
      || (a.sourceName ?? '').localeCompare(b.sourceName ?? ''),
  )
}

/** Every income registered for a month, across all sources. */
export function getIncomesForMonth(salaries: Salary[], month = getMonthKey()) {
  return normalizeSalaryHistory(salaries).filter((salary) => salary.month === month)
}

/** Total income for a month: the base for the allocation formula. */
export function getTotalIncomeForMonth(salaries: Salary[], month = getMonthKey()) {
  return getIncomesForMonth(salaries, month).reduce((sum, salary) => sum + salary.amount, 0)
}

/** Money assigned to this account's formula after transfers, without changing income. */
export function getSalaryPlanningBase(salary: Salary) {
  return Math.max(0, salary.amount + Number(salary.transferAdjustment ?? 0))
}

/**
 * The income in effect for a month. Falls back to the most recent earlier
 * entry so a month with nothing registered still reports the last known pay,
 * matching how the app behaved with a single salary.
 */
export function getSalaryForMonth(salaries: Salary[], month = getMonthKey()) {
  const normalized = normalizeSalaryHistory(salaries)
  const current = normalized.filter((salary) => salary.month === month)
  if (current.length > 0) {
    const total = current.reduce((sum, salary) => sum + salary.amount, 0)
    return { ...current[0], amount: total }
  }

  const previous = normalized.find((salary) => salary.month < month)
  if (!previous) return null

  // Only recurring income is assumed to still be there; a past bonus is not.
  const previousMonth = normalized.filter(
    (salary) => salary.month === previous.month && isRecurringIncome(salary),
  )
  if (previousMonth.length === 0) return null

  return {
    ...previousMonth[0],
    amount: previousMonth.reduce(
      (sum, salary) => sum + (salary.balanceMode === 'zero' ? 0 : salary.amount),
      0,
    ),
  }
}

/**
 * Copies recurring income into the months that have none. One-off entries
 * (a bonus) stay in the month they happened.
 */
export function carrySalaryForwardToMonth(
  salaries: Salary[],
  targetMonth: string,
  createId: () => string,
) {
  const normalized = normalizeSalaryHistory(salaries)
  const recurring = normalized.filter(isRecurringIncome)
  if (recurring.length === 0) return normalized

  const latestMonth = recurring[0].month
  if (latestMonth >= targetMonth) return normalized

  const sources = recurring.filter((salary) => salary.month === latestMonth)
  const covered = new Set(
    normalized.map((salary) => `${salary.month}/${getIncomeKey(salary)}`),
  )

  const carried: Salary[] = []
  const previousBySource = new Map(sources.map((source) => [getIncomeKey(source), source]))
  let month = addMonthsToKey(latestMonth, 1)

  while (month <= targetMonth) {
    for (const source of sources) {
      const key = `${month}/${getIncomeKey(source)}`
      if (covered.has(key)) {
        const existing = normalized.find((salary) => salary.month === month && getIncomeKey(salary) === getIncomeKey(source))
        if (existing) previousBySource.set(getIncomeKey(source), existing)
        continue
      }
      covered.add(key)
      const previous = previousBySource.get(getIncomeKey(source))!
      const income = source.balanceMode === 'zero' ? 0 : source.amount
      // A monthly income is new money; the account's unspent balance remains
      // available. Accounts without automatic income retain their money too.
      // Legacy entries have no recorded balance, so do not invent a remainder.
      const next: Salary = {
        ...source,
        id: createId(),
        month,
        amount: income,
        balance: (previous.balance ?? 0) + income,
        // Keep only transferred money that is still in the account. It is
        // spendable next month without becoming a second income payment.
        transferAdjustment: Math.min(
          Math.max(0, previous.balance ?? 0),
          Math.max(0, previous.transferAdjustment ?? 0),
        ),
      }
      carried.push(next)
      previousBySource.set(getIncomeKey(source), next)
    }
    month = addMonthsToKey(month, 1)
  }

  return normalizeSalaryHistory([...carried, ...normalized])
}

/** Sources still selectable when registering income. */
export function getActiveIncomeSources(sources: IncomeSource[]) {
  return sources.filter((source) => !source.archived)
}
