import type { AllocationFormula } from './preferences'
import type { Debt, Salary, Transaction } from './types'
import { getEffectiveExpenseTotal } from './expense-utils'
import {
  getExpenseTransferTotal,
  getExpenseWithdrawalTotal,
  getWantTransferTotal,
  getWantWithdrawalTotal,
} from './saving-utils'
import { getEffectiveWantTotal } from './want-utils'
import { getMonthKey, getSalaryForMonth } from './salary-utils'

export function getMonthlyOverview(
  salaries: Salary[],
  transactions: Transaction[],
  debts: Debt[],
  formula: AllocationFormula,
  month = getMonthKey(),
) {
  const grossSalary = getSalaryForMonth(salaries, month)?.amount ?? 0
  const monthlyTransactions = transactions.filter((transaction) => transaction.date.slice(0, 7) === month)
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
    .filter((transaction) => transaction.type === 'saving')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const totalDebtPaid = debts.reduce(
    (sum, debt) => {
      if (debt.isSettled) return sum

      return sum + (debt.payments ?? [])
        .filter((payment) => payment.date.slice(0, 7) === month)
        .reduce((paymentSum, payment) => paymentSum + payment.amount, 0)
    },
    0,
  )
  const totalSalary = Math.max(0, grossSalary - totalDebtPaid)

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
