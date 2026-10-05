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
import { getAccountAllocationFormula, getSavingsAccountBalances } from '@/lib/account-savings'
import { getIncomeCycleMonth } from '@/lib/income-account-view'
import { useActiveIncomeAccount } from '@/lib/useActiveIncomeAccount'

export function useMonthlyOverview() {
  const salaries = useFinanceStore((state) => state.salaries)
  const incomeSources = useFinanceStore((state) => state.incomeSources)
  const transactions = useFinanceStore((state) => state.transactions)
  const debts = useFinanceStore((state) => state.debts)
  const wishlist = useFinanceStore((state) => state.wishlist)
  const monthlyPlanningHistory = useFinanceStore((state) => state.monthlyPlanningHistory)
  const subscriptions = useFinanceStore((state) => state.subscriptions)
  const formula = usePreferencesStore((state) => state.formula)
  const accountSavingsFormulas = usePreferencesStore((state) => state.accountSavingsFormulas)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)
  const { activeAccount, activeIncomeSourceId } = useActiveIncomeAccount()

  return useMemo(() => {
    const cycleMonth = getIncomeCycleMonth(salaries, monthlyPlanningHistory)
    const periodStart = monthlyPlanningHistory.length > 0
      ? getFinancialPeriodStart(monthlyPlanningHistory)
      : `${cycleMonth ?? getMonthKey()}-01T00:00:00.000Z`
    const periodEnd = new Date().toISOString().slice(0, 10)
    const latestReset = monthlyPlanningHistory.find((entry) => entry.createdAt === periodStart)
    const accountFormula = getAccountAllocationFormula(accountSavingsFormulas, activeIncomeSourceId, formula)
    const accountTransactions = activeIncomeSourceId
      ? transactions.filter((transaction) => transaction.incomeSourceId === activeIncomeSourceId)
      : []
    const accountSalaries = activeAccount ? [activeAccount.salary] : []
    const accountDebts = debts.filter((debt) => debt.incomeSourceId === activeIncomeSourceId)
    const overview = getMonthlyOverview(accountSalaries, accountTransactions, accountDebts, accountFormula, {
      periodStart,
      periodEnd,
      strictSameDayBoundary: Boolean(latestReset),
      excludedTransactionIds: latestReset?.savingTransactionIds,
    })
    const savingsCurrency = (activeAccount?.salary.currencyCode ?? activeAccount?.source.currencyCode ?? activeCurrencyCode).trim().toUpperCase()
    const sourceById = new Map(incomeSources.map((source) => [source.id, source]))
    const currencyTransactions = transactions.filter((transaction) =>
      (sourceById.get(transaction.incomeSourceId ?? '')?.currencyCode ?? 'USD').trim().toUpperCase() === savingsCurrency)
    const currencyWishlist = wishlist.filter((item) => (item.sourceCurrency ?? 'USD').trim().toUpperCase() === savingsCurrency)
    const funding = getSavingsFundingBreakdown(currencyTransactions, currencyWishlist)
    const generatedSavingsBalance = getSavingsAccountBalances(salaries, incomeSources, savingsCurrency, getMonthKey())
    const reservedForPurchasedWishlist = currencyWishlist.reduce(
      (sum, item) => sum + (isWishlistPurchased(item) ? getWishlistReservedAmount(item) : 0),
      0,
    )
    const totalSavings = Math.max(0, overview.totalSavings)
    const accumulatedSavings = Math.max(0, generatedSavingsBalance - reservedForPurchasedWishlist)
    const borrowedSavings = Math.min(accumulatedSavings, Math.max(0, funding.borrowedBalance))
    const ownSavings = Math.max(0, accumulatedSavings - borrowedSavings)
    const assignedSavingsGoals = 0
    const freeSavings = accumulatedSavings
    const activeSubscriptions = subscriptions.filter((subscription) => subscription.incomeSourceId === activeIncomeSourceId && subscription.status === 'active')
    const monthlySubscriptions = activeSubscriptions.reduce((sum, subscription) => sum + subscription.amount, 0)
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
      ownSavings,
      borrowedSavings,
      borrowedSavingsAcquired: funding.borrowedAcquired,
      borrowedSavingsUsed: funding.borrowedUsed,
      savingsUsages: funding.usages,
      activeSubscriptions,
      monthlySubscriptions,
    }
  }, [accountSavingsFormulas, activeAccount, activeCurrencyCode, activeIncomeSourceId, debts, formula, incomeSources, monthlyPlanningHistory, salaries, subscriptions, transactions, wishlist])
}
