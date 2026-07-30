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
    const totalSavings = Math.max(0, overview.totalSavings)
    const accumulatedSavings = Math.max(0, overview.accumulatedSavings - reservedForPurchasedWishlist)
    const assignedSavingsGoals = savingsGoals.reduce((sum, goal) => sum + goal.currentAmount, 0)
    const freeSavings = Math.max(0, accumulatedSavings - assignedSavingsGoals)
    const wantsEnabled = formula.wants > 0
    const savingsRollover = formula.rolloverSavings && wantsEnabled
      ? Math.max(0, overview.budgetSavings - totalSavings)
      : 0
    const budgetWants = wantsEnabled
      ? (overview.totalSalary * (formula.wants / 100)) + savingsRollover
      : 0

    return {
      ...overview,
      totalSavings,
      accumulatedSavings,
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
