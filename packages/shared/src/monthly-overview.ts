import type { AllocationFormula } from './preferences'
import type { Salary, Transaction } from './types'
import { getEffectiveExpenseTotal } from './expense-utils'
import { getEffectiveWantTotal } from './want-utils'

export function getMonthlyOverview(
  salaries: Salary[],
  transactions: Transaction[],
  formula: AllocationFormula,
) {
  const totalSalary = salaries.reduce((sum, salary) => sum + salary.amount, 0)
  const totalExpenses = getEffectiveExpenseTotal(transactions)
  const totalWants = getEffectiveWantTotal(transactions)
  const totalSavings = transactions
    .filter((transaction) => transaction.type === 'saving')
    .reduce((sum, transaction) => sum + transaction.amount, 0)

  const budgetExpenses = totalSalary * (formula.expenses / 100)
  const budgetSavings = totalSalary * (formula.savings / 100)
  const baseWants = totalSalary * (formula.wants / 100)
  const savingsRollover = formula.rolloverSavings ? Math.max(0, budgetSavings - totalSavings) : 0
  const budgetWants = baseWants + savingsRollover

  return {
    totalSalary,
    totalExpenses,
    totalWants,
    totalSavings,
    budgetExpenses,
    budgetWants,
    budgetSavings,
    savingsRollover,
    remainingExpenses: budgetExpenses - totalExpenses,
    remainingWants: budgetWants - totalWants,
    remainingSavings: budgetSavings - totalSavings,
  }
}
