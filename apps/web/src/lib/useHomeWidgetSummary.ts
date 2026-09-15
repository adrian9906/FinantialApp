import { useEffect, useMemo, useState } from 'react'
import { getTodayDateKey } from '@/lib/date'
import { formatMoneyWithCode } from '@/lib/currency'
import { getWidgetTodayExpenses } from '@/lib/home-widget-summary'
import { getCanonicalPlanningHistory } from '@/lib/planningHistory'
import { useActiveIncomeAccount } from '@/lib/useActiveIncomeAccount'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore, USD_CURRENCY } from '@/store/preferencesStore'
export function useHomeWidgetSummary() {
  const { activeAccount, activeIncomeSourceId } = useActiveIncomeAccount()
  const transactions = useFinanceStore((state) => state.transactions)
  const history = useFinanceStore((state) => state.monthlyPlanningHistory)
  const currencies = usePreferencesStore((state) => state.currencies)
  const [clock, setClock] = useState(Date.now)
  useEffect(() => {
    const refresh = () => setClock(Date.now())
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  return useMemo(() => {
    const dateKey = getTodayDateKey()
    const currency = currencies.find((entry) => entry.code === (activeAccount?.salary.currencyCode ?? activeAccount?.source.currencyCode)) ?? USD_CURRENCY
    const balance = Number(activeAccount?.salary.balance ?? activeAccount?.salary.amount ?? 0)
    return {
      hasAccount: Boolean(activeAccount),
      accountName: activeAccount?.source.name ?? 'Sin cuenta seleccionada',
      balance: formatMoneyWithCode(Number.isFinite(balance) ? balance : 0, currency),
      todayExpenses: formatMoneyWithCode(getWidgetTodayExpenses(transactions, getCanonicalPlanningHistory(history), activeIncomeSourceId, dateKey), currency),
      dateKey,
      updatedLabel: new Date(clock).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    }
  }, [activeAccount, activeIncomeSourceId, transactions, history, currencies, clock])
}
