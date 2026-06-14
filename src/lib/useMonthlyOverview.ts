import { useFinanceStore } from '@/store/financeStore'
import { useMemo } from 'react'

export function useMonthlyOverview() {
  const { salaries, transactions } = useFinanceStore()

  return useMemo(() => {
    const totalSalary = salaries.reduce((sum, s) => (s.received ? sum + s.amount : sum), 0)
    const totalExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
    const totalWants = transactions
      .filter((t) => t.type === 'want')
      .reduce((sum, t) => sum + t.amount, 0)
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
