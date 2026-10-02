import type { IncomeSource, Salary } from '@plata/shared'

import { isSavingsIncomeSource } from '@/lib/account-savings'

export interface ResetIncomeCycleResult {
  salaries: Salary[]
  incomeSources: IncomeSource[]
}

/**
 * Starts a clean planning cycle without rewriting older recurring-income
 * history. Temporary accounts are removed, regular accounts recover their
 * original monthly amount, and real savings balances remain untouched.
 */
export function resetIncomeCycle(
  salaries: Salary[],
  incomeSources: IncomeSource[],
): ResetIncomeCycleResult {
  const sourceById = new Map(incomeSources.map((source) => [source.id, source]))
  const temporarySourceIds = new Set(
    incomeSources.filter((source) => !source.recurring).map((source) => source.id),
  )

  const latestSalaryBySource = new Map<string, Salary>()
  for (const salary of salaries) {
    const key = salary.sourceId ?? 'legacy'
    const current = latestSalaryBySource.get(key)
    if (!current || salary.month > current.month) latestSalaryBySource.set(key, salary)
  }
  const latestSalaryIds = new Set([...latestSalaryBySource.values()].map((salary) => salary.id))

  const retainedSources = incomeSources.filter((source) => !temporarySourceIds.has(source.id))
  const retainedSalaries = salaries
    .filter((salary) => salary.kind !== 'one-off' && !temporarySourceIds.has(salary.sourceId ?? ''))
    .map((salary) => {
      if (!latestSalaryIds.has(salary.id)) return salary

      const source = salary.sourceId ? sourceById.get(salary.sourceId) : undefined
      if (source && isSavingsIncomeSource(source)) return salary

      const startsAtZero = salary.balanceMode === 'zero' || source?.balanceMode === 'zero'
      return {
        ...salary,
        balance: startsAtZero ? 0 : salary.amount,
        transferAdjustment: 0,
      }
    })

  return { salaries: retainedSalaries, incomeSources: retainedSources }
}
