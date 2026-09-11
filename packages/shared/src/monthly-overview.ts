import { getFormulaBudgets, type AllocationFormula } from './preferences.js'
import type { Debt, MonthlyPlanningHistory, Salary, Transaction } from './types.js'
import { getEffectiveExpenseTotal } from './expense-utils.js'
import {
  getExpenseTransferTotal,
  getExpenseWithdrawalTotal,
  parseSavingDescription,
  getWantTransferTotal,
  getWantWithdrawalTotal,
} from './saving-utils.js'
import { getEffectiveWantTotal } from './want-utils.js'
import { getMonthKey, getSalaryForMonth, getTotalIncomeForMonth } from './salary-utils.js'

export interface MonthlyOverviewOptions {
  periodStart?: string | null
  periodEnd?: string
  salaryMonth?: string
  strictSameDayBoundary?: boolean
  excludedTransactionIds?: string[]
}

export function getFinancialPeriodStart(
  history: MonthlyPlanningHistory[],
  now = new Date(),
) {
  const nowTime = now.getTime()
  const latestReset = history.reduce<MonthlyPlanningHistory | null>((latest, entry) => {
    const entryTime = Date.parse(entry.createdAt)
    if (!Number.isFinite(entryTime) || entryTime > nowTime) return latest
    if (!latest || entryTime > Date.parse(latest.createdAt)) return entry
    return latest
  }, null)

  return latestReset?.createdAt ?? `${getMonthKey(now)}-01T00:00:00.000Z`
}

/** The next expected reset date, one calendar month after the last reset. */
export function getFinancialPeriodEnd(periodStart: string) {
  const start = new Date(periodStart)
  const nextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  const lastDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(
    nextMonth.getUTCFullYear(),
    nextMonth.getUTCMonth(),
    Math.min(start.getUTCDate(), lastDay),
  ))
}

/**
 * A transaction belongs to the active cobro when it lands on or after the last
 * monthly close. Exported so the planning lists can scope themselves with the
 * exact same rule the totals use, instead of approximating it by month.
 */
export function isInFinancialPeriod(
  entry: { date: string; createdAt?: string },
  periodStart: string,
  strictSameDayBoundary = false,
) {
  const startDate = periodStart.slice(0, 10)
  if (entry.date < startDate) return false
  if (entry.date > startDate) return true
  if (!entry.createdAt) return !strictSameDayBoundary

  const createdAt = Date.parse(entry.createdAt)
  const startTime = Date.parse(periodStart)
  if (!Number.isFinite(createdAt) || !Number.isFinite(startTime)) return !strictSameDayBoundary

  return createdAt >= startTime
}

/**
 * Applies the canonical financial-period boundary to transactions. Consumers
 * that derive planned and actual totals must use this same collection.
 */
export function getTransactionsInFinancialPeriod(
  transactions: Transaction[],
  options: Pick<MonthlyOverviewOptions, 'periodStart' | 'periodEnd' | 'strictSameDayBoundary' | 'excludedTransactionIds'> = {},
) {
  const periodStart = options.periodStart ?? `${getMonthKey()}-01T00:00:00.000Z`
  const excludedTransactionIds = new Set(options.excludedTransactionIds)

  return transactions.filter((transaction) => {
    const isPlanningItem = transaction.type === 'expense' || transaction.type === 'want'

    return !excludedTransactionIds.has(transaction.id)
      && isInFinancialPeriod(transaction, periodStart, options.strictSameDayBoundary)
      // Expense/want lists are plans for the whole active cycle, so an item
      // scheduled later in that cycle must appear in the same collection and
      // total. Other movements remain capped at today's reporting boundary.
      && (isPlanningItem || !options.periodEnd || transaction.date.slice(0, 10) <= options.periodEnd.slice(0, 10))
  })
}

export function getMonthlyOverview(
  salaries: Salary[],
  transactions: Transaction[],
  debts: Debt[],
  formula: AllocationFormula,
  options: MonthlyOverviewOptions = {},
) {
  const periodStart = options.periodStart ?? `${getMonthKey()}-01T00:00:00.000Z`
  const periodEnd = options.periodEnd
  const salaryMonth = options.salaryMonth ?? getMonthKey()
  // Every income registered for the month (all jobs plus any one-off bonus).
  // Falls back to the last known recurring pay when the month has none.
  const registered = getTotalIncomeForMonth(salaries, salaryMonth)
  const grossSalary = registered > 0 ? registered : getSalaryForMonth(salaries, salaryMonth)?.amount ?? 0
  const monthlyTransactions = getTransactionsInFinancialPeriod(transactions, {
    periodStart,
    periodEnd,
    strictSameDayBoundary: options.strictSameDayBoundary,
    excludedTransactionIds: options.excludedTransactionIds,
  })
  const totalExpenses = getEffectiveExpenseTotal(monthlyTransactions)
  const totalWants = getEffectiveWantTotal(monthlyTransactions)
  const transferredFromExpenses = getExpenseTransferTotal(monthlyTransactions)
  const transferredFromWants = getWantTransferTotal(monthlyTransactions)
  const transferredToExpenses = getExpenseWithdrawalTotal(monthlyTransactions)
  const transferredToWants = getWantWithdrawalTotal(monthlyTransactions)
  const accumulatedSavings = transactions
    .filter((transaction) => transaction.type === 'saving')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const totalSavings = monthlyTransactions
    .filter((transaction) => transaction.type === 'saving' && transaction.amount > 0)
    .reduce((sum, transaction) => {
      const parsed = parseSavingDescription(transaction.description)
      return parsed.kind === 'debt-acquisition' || parsed.kind === 'debt-payment'
        ? sum
        : sum + transaction.amount
    }, 0)
  const totalDebtPaid = debts.filter((debt) => debt.direction !== 'receivable').reduce(
    (sum, debt) => sum + (debt.payments ?? [])
        .filter((payment) => isInFinancialPeriod(payment, periodStart, options.strictSameDayBoundary))
        .filter((payment) => !periodEnd || payment.date.slice(0, 10) <= periodEnd.slice(0, 10))
        .reduce((paymentSum, payment) => paymentSum + payment.amount, 0),
    0,
  )
  const totalSalary = grossSalary

  // Savings is taken off the income first; expenses and wants split the rest.
  const baseBudgets = getFormulaBudgets(totalSalary, formula)
  const baseBudgetExpenses = baseBudgets.expenses
  const baseBudgetSavings = baseBudgets.savings
  const budgetExpenses = Math.max(0, baseBudgetExpenses - transferredFromExpenses + transferredToExpenses)
  const baseWants = baseBudgets.wants
  const budgetSavings = baseBudgetSavings + transferredFromExpenses + transferredFromWants
  const budgetWantsBeforeRollover = Math.max(0, baseWants - transferredFromWants + transferredToWants)
  const wantsEnabled = formula.wants > 0
  const savingsRollover = formula.rolloverSavings && wantsEnabled
    ? Math.max(0, budgetSavings - totalSavings)
    : 0
  const budgetWants = wantsEnabled ? budgetWantsBeforeRollover + savingsRollover : 0

  return {
    // Exposed so the planning lists can show exactly the transactions these
    // totals are built from.
    periodStart,
    periodTransactions: monthlyTransactions,
    grossSalary,
    totalSalary,
    totalExpenses,
    totalWants,
    totalSavings,
    accumulatedSavings,
    totalDebtPaid,
    transferredFromExpenses,
    transferredFromWants,
    transferredToExpenses,
    transferredToWants,
    budgetExpenses,
    budgetWants,
    budgetSavings,
    savingsRollover,
    remainingExpenses: budgetExpenses - totalExpenses,
    remainingWants: budgetWants - totalWants,
    remainingSavings: budgetSavings - totalSavings,
  }
}
