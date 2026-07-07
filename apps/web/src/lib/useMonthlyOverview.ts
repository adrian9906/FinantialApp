import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { useMemo } from 'react'
import { getMonthlyOverview, getWishlistReservedAmount, isWishlistPurchased } from '@plata/shared'

export function useMonthlyOverview() {
  const salaries = useFinanceStore((state) => state.salaries)
  const transactions = useFinanceStore((state) => state.transactions)
  const debts = useFinanceStore((state) => state.debts)
  const wishlist = useFinanceStore((state) => state.wishlist)
  const savingsGoals = useFinanceStore((state) => state.savingsGoals)
  const formula = usePreferencesStore((state) => state.formula)

  return useMemo(() => {
    const overview = getMonthlyOverview(salaries, transactions, debts, formula)
    const reservedForPurchasedWishlist = wishlist.reduce(
      (sum, item) => sum + (isWishlistPurchased(item) ? getWishlistReservedAmount(item) : 0),
      0,
    )
    const totalSavings = Math.max(0, overview.totalSavings - reservedForPurchasedWishlist)
    const assignedSavingsGoals = savingsGoals.reduce((sum, goal) => sum + goal.currentAmount, 0)
    const freeSavings = Math.max(0, totalSavings - assignedSavingsGoals)
    const savingsRollover = formula.rolloverSavings ? Math.max(0, overview.budgetSavings - totalSavings) : 0
    const budgetWants = (overview.totalSalary * (formula.wants / 100)) + savingsRollover

    return {
      ...overview,
      totalSavings,
      freeSavings,
      assignedSavingsGoals,
      savingsRollover,
      budgetWants,
      remainingWants: budgetWants - overview.totalWants,
      remainingSavings: overview.budgetSavings - totalSavings,
      reservedForPurchasedWishlist,
    }
  }, [debts, formula, salaries, savingsGoals, transactions, wishlist])
}
