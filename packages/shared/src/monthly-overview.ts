import type { AllocationFormula } from './preferences'
import type { Debt, Salary, Transaction } from './types'
import { getEffectiveExpenseTotal } from './expense-utils'
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
  const totalSavings = transactions
    .filter((transaction) => transaction.type === 'saving')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const totalDebtPaid = debts.reduce((sum, debt) => sum + debt.paidAmount, 0)
  const totalSalary = Math.max(0, grossSalary - totalDebtPaid)

  const budgetExpenses = totalSalary * (formula.expenses / 100)
  const budgetSavings = totalSalary * (formula.savings / 100)
  const baseWants = totalSalary * (formula.wants / 100)
  const savingsRollover = formula.rolloverSavings ? Math.max(0, budgetSavings - totalSavings) : 0
  const budgetWants = baseWants + savingsRollover

  return {
    grossSalary,
    totalSalary,
    totalExpenses,
    totalWants,
    totalSavings,
    totalDebtPaid,
    budgetExpenses,
    budgetWants,
    budgetSavings,
    savingsRollover,
    remainingExpenses: budgetExpenses - totalExpenses,
    remainingWants: budgetWants - totalWants,
    remainingSavings: budgetSavings - totalSavings,
  }
}
