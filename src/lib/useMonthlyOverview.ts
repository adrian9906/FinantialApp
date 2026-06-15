import { useFinanceStore } from '@/store/financeStore'
import { useMemo } from 'react'
import { getEffectiveExpenseTotal } from '@/lib/expense-utils'
import { getEffectiveWantTotal } from '@/lib/want-utils'

export function useMonthlyOverview() {
  const { salaries, transactions } = useFinanceStore()

  return useMemo(() => {
    const totalSalary = salaries.reduce((sum, s) => sum + s.amount, 0)
    const totalExpenses = getEffectiveExpenseTotal(transactions)
    const totalWants = getEffectiveWantTotal(transactions)
    const totalSavings = transactions
      .filter((t) => t.type === 'saving')
      .reduce((sum, t) => sum + t.amount, 0)

    const budgetExpenses = totalSalary * 0.5
    const budgetWants = totalSalary * 0.25
    const budgetSavings = totalSalary * 0.25

    return {
      totalSalary,
      totalExpenses,
      totalWants,
      totalSavings,
      budgetExpenses,
      budgetWants,
      budgetSavings,
      remainingExpenses: budgetExpenses - totalExpenses,
      remainingWants: budgetWants - totalWants,
      remainingSavings: budgetSavings - totalSavings,
    }
  }, [salaries, transactions])
}
