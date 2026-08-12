import type { AllocationFormula } from './preferences'
import type { Debt, MonthlyPlanningHistory, Salary, Transaction } from './types'
import { getEffectiveExpenseTotal } from './expense-utils'
import {
  getExpenseTransferTotal,
  getExpenseWithdrawalTotal,
  parseSavingDescription,
  getWantTransferTotal,
  getWantWithdrawalTotal,
} from './saving-utils'
import { getEffectiveWantTotal } from './want-utils'
import { getMonthKey, getSalaryForMonth } from './salary-utils'

export interface MonthlyOverviewOptions {
  periodStart?: string | null
  salaryMonth?: string
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

function isInFinancialPeriod(
  entry: { date: string; createdAt?: string },
  periodStart: string,
) {
  const startDate = periodStart.slice(0, 10)
  if (entry.date < startDate) return false
  if (entry.date > startDate || !entry.createdAt) return true

  const createdAt = Date.parse(entry.createdAt)
  const startTime = Date.parse(periodStart)
  return !Number.isFinite(createdAt) || !Number.isFinite(startTime) || createdAt >= startTime
}

export function getMonthlyOverview(
  salaries: Salary[],
  transactions: Transaction[],
  debts: Debt[],
  formula: AllocationFormula,
  options: MonthlyOverviewOptions = {},
) {
  const periodStart = options.periodStart ?? `${getMonthKey()}-01T00:00:00.000Z`
  const salaryMonth = options.salaryMonth ?? getMonthKey()
  const grossSalary = getSalaryForMonth(salaries, salaryMonth)?.amount ?? 0
  const monthlyTransactions = transactions.filter((transaction) => isInFinancialPeriod(transaction, periodStart))
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
  const totalDebtPaid = debts.reduce(
    (sum, debt) => sum + (debt.payments ?? [])
        .filter((payment) => isInFinancialPeriod(payment, periodStart))
        .reduce((paymentSum, payment) => paymentSum + payment.amount, 0),
    0,
  )
  const totalSalary = grossSalary

  const baseBudgetExpenses = totalSalary * (formula.expenses / 100)
  const baseBudgetSavings = totalSalary * (formula.savings / 100)
  const budgetExpenses = Math.max(0, baseBudgetExpenses - transferredFromExpenses + transferredToExpenses)
  const baseWants = totalSalary * (formula.wants / 100)
  const budgetSavings = baseBudgetSavings + transferredFromExpenses + transferredFromWants
  const budgetWantsBeforeRollover = Math.max(0, baseWants - transferredFromWants + transferredToWants)
  const wantsEnabled = formula.wants > 0
  const savingsRollover = formula.rolloverSavings && wantsEnabled
    ? Math.max(0, budgetSavings - totalSavings)
    : 0
  const budgetWants = wantsEnabled ? budgetWantsBeforeRollover + savingsRollover : 0

  return {
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
