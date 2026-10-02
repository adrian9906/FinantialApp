import {
  getFinancialPeriodStart,
  getEffectiveExpenseTotal,
  getEffectiveWantTotal,
  getMonthKey,
  getAdjustedFormulaBudgets,
  getMonthlyOverview,
  type AllocationFormula,
  type IncomeSource,
  type Salary,
  type Transaction,
  type MonthlyPlanningHistory,
} from '@plata/shared'
import { isSavingsIncomeSource } from '@/lib/account-savings'

export interface IncomeAccountView {
  source: IncomeSource
  salary: Salary
}

export function getIncomeCycleMonth(salaries: Salary[], monthlyPlanningHistory: MonthlyPlanningHistory[] = []) {
  if (monthlyPlanningHistory.length > 0) return getFinancialPeriodStart(monthlyPlanningHistory).slice(0, 7)
  return salaries.map((salary) => salary.month).sort()[0]
}

export function getIncomeAccountsForMonth(
  salaries: Salary[],
  sources: IncomeSource[],
  month = getMonthKey(),
  currencyCode?: string,
): IncomeAccountView[] {
  const sourceById = new Map(
    sources
      .filter((source) => !source.archived && !isSavingsIncomeSource(source))
      .map((source) => [source.id, source]),
  )
  const normalizedCurrencyCode = currencyCode?.trim().toUpperCase()

  return salaries
    .filter((salary) => salary.month === month
      && salary.sourceId
      && sourceById.has(salary.sourceId)
      && (!normalizedCurrencyCode || (sourceById.get(salary.sourceId!)?.currencyCode ?? salary.currencyCode ?? 'USD').trim().toUpperCase() === normalizedCurrencyCode))
    .map((salary) => {
      const source = sourceById.get(salary.sourceId!)!
      return { salary: { ...salary, currencyCode: source.currencyCode ?? salary.currencyCode ?? 'USD' }, source }
    })
    .sort((left, right) => left.source.name.localeCompare(right.source.name, 'es'))
}

/** Current-cycle accounts use the latest record for each source, regardless of calendar month. */
export function getIncomeAccountsForCycle(
  salaries: Salary[],
  sources: IncomeSource[],
  monthlyPlanningHistory: MonthlyPlanningHistory[] = [],
  currencyCode?: string,
): IncomeAccountView[] {
  const sourceById = new Map(
    sources
      .filter((source) => !source.archived && !isSavingsIncomeSource(source))
      .map((source) => [source.id, source]),
  )
  const latestBySource = new Map<string, Salary>()
  const cycleMonth = getIncomeCycleMonth(salaries, monthlyPlanningHistory)

  for (const salary of salaries) {
    const sourceId = salary.sourceId ?? 'legacy'
    if (salary.sourceId && !sourceById.has(salary.sourceId)) continue

    const current = latestBySource.get(sourceId)
    const currentIsInCycle = current && (!cycleMonth || current.month <= cycleMonth)
    const salaryIsInCycle = !cycleMonth || salary.month <= cycleMonth
    if (!current
      || (salaryIsInCycle && (!currentIsInCycle || salary.month > current.month))
      || (!currentIsInCycle && !salaryIsInCycle && salary.month < current.month)) {
      latestBySource.set(sourceId, salary)
    }
  }

  const normalizedCurrencyCode = currencyCode?.trim().toUpperCase()
  return [...latestBySource.values()]
    .filter((salary) => {
      const source = salary.sourceId ? sourceById.get(salary.sourceId) : undefined
      const currency = (source?.currencyCode ?? salary.currencyCode ?? 'USD').trim().toUpperCase()
      return !normalizedCurrencyCode || currency === normalizedCurrencyCode
    })
    .map((salary) => {
      const source = salary.sourceId
        ? sourceById.get(salary.sourceId)!
        : { id: 'legacy', name: salary.sourceName ?? 'Ingreso', recurring: true }
      return { salary: { ...salary, currencyCode: source.currencyCode ?? salary.currencyCode ?? 'USD' }, source }
    })
    .sort((left, right) => left.source.name.localeCompare(right.source.name, 'es'))
}

export function getIncomeAccountOverview(
  account: IncomeAccountView | undefined,
  transactions: Transaction[],
  formula: AllocationFormula,
) {
  const periodTransactions = account
    ? transactions.filter((transaction) => transaction.incomeSourceId === account.source.id)
    : []
  const budgets = account
    ? getAdjustedFormulaBudgets(account.salary.amount, formula, Number(account.salary.transferAdjustment ?? 0))
    : { expenses: 0, wants: 0, savings: 0 }
  const budgetExpenses = budgets.expenses
  const budgetWants = budgets.wants

  return {
    periodTransactions,
    budgetExpenses,
    budgetWants,
    totalExpenses: getEffectiveExpenseTotal(periodTransactions),
    totalWants: getEffectiveWantTotal(periodTransactions),
    balance: account ? Number(account.salary.balance ?? account.salary.amount) : 0,
  }
}

export function getIncomeAccountTransferLimit(
  account: IncomeAccountView,
  transactions: Transaction[],
  formula: AllocationFormula,
  period: { periodStart: string; periodEnd?: string; strictSameDayBoundary?: boolean; excludedTransactionIds?: string[] },
) {
  const overview = getMonthlyOverview([account.salary], transactions, [], formula, {
    ...period,
    salaryMonth: account.salary.month,
  })
  return Math.max(0, overview.budgetExpenses + overview.budgetWants - overview.totalExpenses - overview.totalWants)
}
