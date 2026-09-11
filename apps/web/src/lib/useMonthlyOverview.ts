import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { useMemo } from 'react'
import {
  getFinancialPeriodStart,
  getFormulaBudgets,
  getMonthKey,
  getMonthlyOverview,
  getSavingsFundingBreakdown,
  getWishlistReservedAmount,
  isWishlistPurchased,
} from '@plata/shared'
import { getAccountAllocationFormula, isSavingsIncomeSource } from '@/lib/account-savings'

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

  return useMemo(() => {
    const periodStart = getFinancialPeriodStart(monthlyPlanningHistory)
    const periodEnd = new Date().toISOString().slice(0, 10)
    const latestReset = monthlyPlanningHistory.find((entry) => entry.createdAt === periodStart)
    const overview = getMonthlyOverview(salaries, transactions, debts, formula, {
      periodStart,
      periodEnd,
      strictSameDayBoundary: Boolean(latestReset),
      excludedTransactionIds: latestReset?.savingTransactionIds,
    })
    const reservedForPurchasedWishlist = wishlist.reduce(
      (sum, item) => sum + (isWishlistPurchased(item) ? getWishlistReservedAmount(item) : 0),
      0,
    )
    const funding = getSavingsFundingBreakdown(transactions, wishlist)
    const totalSavings = Math.max(0, overview.totalSavings)
    const accumulatedSavings = funding.totalBalance
    const assignedSavingsGoals = savingsGoals.reduce((sum, goal) => sum + goal.currentAmount, 0)
    const freeSavings = Math.max(0, accumulatedSavings - assignedSavingsGoals)
    const month = getMonthKey()
    const sourceById = new Map(incomeSources.map((source) => [source.id, source]))
    const accountBudgets = salaries.reduce<Array<{
      salary: typeof salaries[number]
      formula: typeof formula
      budgets: ReturnType<typeof getFormulaBudgets>
    }>>((entries, salary) => {
      if (salary.month !== month) return entries
      const source = salary.sourceId ? sourceById.get(salary.sourceId) : undefined
      if (source && isSavingsIncomeSource(source)) return entries
      const accountFormula = getAccountAllocationFormula(accountSavingsFormulas, salary.sourceId, formula)
      entries.push({ salary, formula: accountFormula, budgets: getFormulaBudgets(salary.amount, accountFormula) })
      return entries
    }, [])
    const baseBudgetExpenses = accountBudgets.reduce((sum, entry) => sum + entry.budgets.expenses, 0)
    const baseBudgetSavings = accountBudgets.reduce((sum, entry) => sum + entry.budgets.savings, 0)
    const baseBudgetWants = accountBudgets.reduce((sum, entry) => sum + entry.budgets.wants, 0)
    const totalSalary = accountBudgets.reduce((sum, entry) => sum + entry.salary.amount, 0)
    const budgetExpenses = Math.max(0, baseBudgetExpenses - overview.transferredFromExpenses + overview.transferredToExpenses)
    const budgetSavings = baseBudgetSavings + overview.transferredFromExpenses + overview.transferredFromWants
    const wantsEnabled = accountBudgets.some((entry) => entry.formula.wants > 0)
    const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active')
    const monthlySubscriptions = activeSubscriptions.reduce((sum, subscription) => sum + subscription.amount, 0)
    const savingsRollover = accountBudgets.reduce((sum, entry) => {
      if (!entry.formula.rolloverSavings || entry.formula.wants <= 0) return sum
      const savedByAccount = overview.periodTransactions
        .filter((transaction) => transaction.type === 'saving'
          && transaction.incomeSourceId === entry.salary.sourceId
          && transaction.amount > 0)
        .reduce((accountSum, transaction) => accountSum + transaction.amount, 0)
      return sum + Math.max(0, entry.budgets.savings - savedByAccount)
    }, 0)
    const budgetWants = wantsEnabled
      ? Math.max(0, baseBudgetWants - overview.transferredFromWants + overview.transferredToWants) + savingsRollover
      : 0

    return {
      ...overview,
      grossSalary: totalSalary,
      totalSalary,
      // The same boundary the totals use, so lists and totals never disagree.
      strictSameDayBoundary: Boolean(latestReset),
      excludedTransactionIds: latestReset?.savingTransactionIds ?? [],
      actualExpenses: overview.totalExpenses,
      totalSavings,
      accumulatedSavings,
      freeSavings,
      assignedSavingsGoals,
      savingsRollover,
      budgetExpenses,
      budgetWants,
      budgetSavings,
      remainingExpenses: budgetExpenses - overview.totalExpenses,
      remainingWants: budgetWants - overview.totalWants,
      remainingSavings: budgetSavings - totalSavings,
      reservedForPurchasedWishlist,
      ownSavings: funding.ownBalance,
      borrowedSavings: funding.borrowedBalance,
      borrowedSavingsAcquired: funding.borrowedAcquired,
      borrowedSavingsUsed: funding.borrowedUsed,
      savingsUsages: funding.usages,
      activeSubscriptions,
      monthlySubscriptions,
    }
  }, [accountSavingsFormulas, debts, formula, incomeSources, monthlyPlanningHistory, salaries, savingsGoals, subscriptions, transactions, wishlist])
}
