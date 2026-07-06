import type { AllocationFormula } from './preferences'
import type { Debt, Salary, Transaction } from './types'
import { getEffectiveExpenseTotal } from './expense-utils'
import { getExpenseTransferTotal, getWantTransferTotal } from './saving-utils'
import { getEffectiveWantTotal } from './want-utils'

export function getMonthlyOverview(
  salaries: Salary[],
  transactions: Transaction[],
  debts: Debt[],
  formula: AllocationFormula,
) {
  const grossSalary = salaries.reduce((sum, salary) => sum + salary.amount, 0)
  const totalExpenses = getEffectiveExpenseTotal(transactions)
  const totalWants = getEffectiveWantTotal(transactions)
  const transferredFromExpenses = getExpenseTransferTotal(transactions)
  const transferredFromWants = getWantTransferTotal(transactions)
  const totalSavings = transactions
    .filter((transaction) => transaction.type === 'saving')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const totalDebtPaid = debts.reduce((sum, debt) => sum + debt.paidAmount, 0)
  const totalSalary = Math.max(0, grossSalary - totalDebtPaid)

  const baseBudgetExpenses = totalSalary * (formula.expenses / 100)
  const baseBudgetSavings = totalSalary * (formula.savings / 100)
  const budgetExpenses = Math.max(0, baseBudgetExpenses - transferredFromExpenses)
  const baseWants = totalSalary * (formula.wants / 100)
  const budgetSavings = baseBudgetSavings + transferredFromExpenses + transferredFromWants
  const budgetWantsBeforeRollover = Math.max(0, baseWants - transferredFromWants)
  const savingsRollover = formula.rolloverSavings ? Math.max(0, budgetSavings - totalSavings) : 0
  const budgetWants = budgetWantsBeforeRollover + savingsRollover

  return {
    grossSalary,
    totalSalary,
    totalExpenses,
    totalWants,
    totalSavings,
    totalDebtPaid,
    transferredFromExpenses,
    transferredFromWants,
    budgetExpenses,
    budgetWants,
    budgetSavings,
    savingsRollover,
    remainingExpenses: budgetExpenses - totalExpenses,
    remainingWants: budgetWants - totalWants,
    remainingSavings: budgetSavings - totalSavings,
  }
}
