import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { useMemo } from 'react'
import { getEffectiveExpenseTotal } from '@/lib/expense-utils'
import { getEffectiveWantTotal } from '@/lib/want-utils'

export function useMonthlyOverview() {
  const salaries = useFinanceStore((state) => state.salaries)
  const transactions = useFinanceStore((state) => state.transactions)
  const formula = usePreferencesStore((state) => state.formula)

  return useMemo(() => {
    const totalSalary = salaries.reduce((sum, s) => sum + s.amount, 0)
    const totalExpenses = getEffectiveExpenseTotal(transactions)
    const totalWants = getEffectiveWantTotal(transactions)
    const totalSavings = transactions
      .filter((t) => t.type === 'saving')
      .reduce((sum, t) => sum + t.amount, 0)

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
  }, [formula, salaries, transactions])
}
