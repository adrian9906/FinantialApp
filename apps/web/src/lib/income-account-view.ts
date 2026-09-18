import {
  getEffectiveExpenseTotal,
  getEffectiveWantTotal,
  getMonthKey,
  getSalaryPlanningBase,
  type AllocationFormula,
  type IncomeSource,
  type Salary,
  type Transaction,
} from '@plata/shared'
import { isSavingsIncomeSource } from '@/lib/account-savings'

export interface IncomeAccountView {
  source: IncomeSource
  salary: Salary
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

export function getIncomeAccountOverview(
  account: IncomeAccountView | undefined,
  transactions: Transaction[],
  formula: AllocationFormula,
) {
  const periodTransactions = account
    ? transactions.filter((transaction) => transaction.incomeSourceId === account.source.id)
    : []
  const base = account ? getSalaryPlanningBase(account.salary) : 0
  const budgetExpenses = base * (formula.expenses / 100)
  const budgetWants = base * (formula.wants / 100)

  return {
    periodTransactions,
    budgetExpenses,
    budgetWants,
    totalExpenses: getEffectiveExpenseTotal(periodTransactions),
    totalWants: getEffectiveWantTotal(periodTransactions),
    balance: account ? Number(account.salary.balance ?? account.salary.amount) : 0,
  }
}
