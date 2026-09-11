import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { useMemo } from 'react'
import {
  getFinancialPeriodStart,
  getMonthKey,
  getMonthlyOverview,
  getSavingsFundingBreakdown,
  getWishlistReservedAmount,
  isWishlistPurchased,
} from '@plata/shared'
import { findSavingsAccount, getAccountAllocationFormula, getSavingsAccountBalance } from '@/lib/account-savings'
import { useActiveIncomeAccount } from '@/lib/useActiveIncomeAccount'

export function useMonthlyOverview() {
  const salaries = useFinanceStore((state) => state.salaries)
  const incomeSources = useFinanceStore((state) => state.incomeSources)
  const transactions = useFinanceStore((state) => state.transactions)
  const debts = useFinanceStore((state) => state.debts)
  const wishlist = useFinanceStore((state) => state.wishlist)
  const savingsGoals = useFinanceStore((state) => state.savingsGoals)
  const monthlyPlanningHistory = useFinanceStore((state) => state.monthlyPlanningHistory)
  const subscriptions = useFinanceStore((state) => state.subscriptions)
  const formula = usePreferencesStore((state) => state.formula)
  const accountSavingsFormulas = usePreferencesStore((state) => state.accountSavingsFormulas)
  const { activeAccount, activeIncomeSourceId } = useActiveIncomeAccount()

  return useMemo(() => {
    const periodStart = getFinancialPeriodStart(monthlyPlanningHistory)
    const periodEnd = new Date().toISOString().slice(0, 10)
    const latestReset = monthlyPlanningHistory.find((entry) => entry.createdAt === periodStart)
    const accountFormula = getAccountAllocationFormula(accountSavingsFormulas, activeIncomeSourceId, formula)
    const accountTransactions = activeIncomeSourceId
      ? transactions.filter((transaction) => transaction.incomeSourceId === activeIncomeSourceId)
      : []
    const accountSalaries = activeAccount ? [activeAccount.salary] : []
    const accountDebts = debts.filter((debt) => debt.incomeSourceId === activeIncomeSourceId)
    const accountWishlist = wishlist.filter((item) => item.incomeSourceId === activeIncomeSourceId)
    const accountSavingsGoals = savingsGoals.filter((goal) => goal.incomeSourceId === activeIncomeSourceId)
    const overview = getMonthlyOverview(accountSalaries, accountTransactions, accountDebts, accountFormula, {
      periodStart,
      periodEnd,
      strictSameDayBoundary: Boolean(latestReset),
      excludedTransactionIds: latestReset?.savingTransactionIds,
    })
    const funding = getSavingsFundingBreakdown(accountTransactions, accountWishlist)
    const savingsSource = activeAccount
      ? findSavingsAccount(
          incomeSources,
          activeAccount.salary.currencyCode ?? activeAccount.source.currencyCode ?? 'USD',
          activeAccount.source.isCash !== false,
        )
      : undefined
    const generatedSavingsBalance = savingsSource
      ? getSavingsAccountBalance(salaries, savingsSource.id, getMonthKey())
      : 0
    const totalSavings = Math.max(0, overview.totalSavings + generatedSavingsBalance)
    const accumulatedSavings = funding.totalBalance + generatedSavingsBalance
    const assignedSavingsGoals = accountSavingsGoals.reduce((sum, goal) => sum + goal.currentAmount, 0)
    const freeSavings = Math.max(0, accumulatedSavings - assignedSavingsGoals)
    const activeSubscriptions = subscriptions.filter((subscription) => subscription.incomeSourceId === activeIncomeSourceId && subscription.status === 'active')
    const monthlySubscriptions = activeSubscriptions.reduce((sum, subscription) => sum + subscription.amount, 0)
    const reservedForPurchasedWishlist = accountWishlist.reduce(
      (sum, item) => sum + (isWishlistPurchased(item) ? getWishlistReservedAmount(item) : 0),
      0,
    )
    const savingsRollover = accountFormula.rolloverSavings && accountFormula.wants > 0
      ? Math.max(0, overview.budgetSavings - totalSavings)
      : 0
    const budgetWants = accountFormula.wants > 0 ? overview.budgetWants + savingsRollover : 0

    return {
      ...overview,
      activeAccount,
      activeIncomeSourceId,
      accountFormula,
      // The same boundary the totals use, so lists and totals never disagree.
      strictSameDayBoundary: Boolean(latestReset),
      excludedTransactionIds: latestReset?.savingTransactionIds ?? [],
      actualExpenses: overview.totalExpenses,
      totalSavings,
      accumulatedSavings,
      freeSavings,
      assignedSavingsGoals,
      savingsRollover,
      budgetExpenses: overview.budgetExpenses,
      budgetWants,
      budgetSavings: overview.budgetSavings,
      remainingExpenses: overview.budgetExpenses - overview.totalExpenses,
      remainingWants: budgetWants - overview.totalWants,
      remainingSavings: overview.budgetSavings - totalSavings,
      reservedForPurchasedWishlist,
      ownSavings: funding.ownBalance,
      borrowedSavings: funding.borrowedBalance,
      borrowedSavingsAcquired: funding.borrowedAcquired,
      borrowedSavingsUsed: funding.borrowedUsed,
      savingsUsages: funding.usages,
      activeSubscriptions,
      monthlySubscriptions,
    }
  }, [accountSavingsFormulas, activeAccount, activeIncomeSourceId, debts, formula, incomeSources, monthlyPlanningHistory, salaries, savingsGoals, subscriptions, transactions, wishlist])
}
