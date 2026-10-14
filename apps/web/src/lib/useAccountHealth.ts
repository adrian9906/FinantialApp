import { useEffect, useMemo, useState } from 'react'
import { buildAccountHealth, isLastWeekOfMonth } from './account-health'
import { getIncomeAccountsForCycle } from './income-account-view'
import { useFinanceStore } from '@/store/financeStore'

export function useAccountHealth() {
  const salaries = useFinanceStore(state => state.salaries)
  const incomeSources = useFinanceStore(state => state.incomeSources)
  const transactions = useFinanceStore(state => state.transactions)
  const debts = useFinanceStore(state => state.debts)
  const subscriptions = useFinanceStore(state => state.subscriptions)
  const history = useFinanceStore(state => state.monthlyPlanningHistory)
  const [clock, setClock] = useState(Date.now)
  useEffect(() => {
    const refresh = () => setClock(Date.now())
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  return useMemo(() => {
    const now = new Date(clock)
    const accounts = getIncomeAccountsForCycle(salaries, incomeSources, history)
    return { now, inLastWeek: isLastWeekOfMonth(now), alerts: buildAccountHealth(accounts, { transactions, debts, subscriptions, monthlyPlanningHistory: history }, now) }
  }, [salaries, incomeSources, transactions, debts, subscriptions, history, clock])
}
