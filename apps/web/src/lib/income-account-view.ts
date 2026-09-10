import {
  getEffectiveExpenseTotal,
  getEffectiveWantTotal,
  type AllocationFormula,
  type IncomeSource,
  type Salary,
  type Transaction,
} from '@plata/shared'

export interface IncomeAccountView {
  source: IncomeSource
  salary: Salary
}

export function getIncomeAccountsForMonth(
  salaries: Salary[],
  sources: IncomeSource[],
  month = new Date().toISOString().slice(0, 7),
): IncomeAccountView[] {
  const sourceById = new Map(sources.filter((source) => !source.archived).map((source) => [source.id, source]))

  return salaries
    .filter((salary) => salary.month === month && salary.sourceId && sourceById.has(salary.sourceId))
    .map((salary) => ({ salary, source: sourceById.get(salary.sourceId!)! }))
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
  const base = account?.salary.amount ?? 0
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
