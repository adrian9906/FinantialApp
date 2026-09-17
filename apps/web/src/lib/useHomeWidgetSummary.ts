import { useEffect, useMemo, useState } from 'react'
import { getTodayDateKey } from '@/lib/date'
import { formatMoneyWithCode } from '@/lib/currency'
import { getWidgetTodayExpenses } from '@/lib/home-widget-summary'
import { getCanonicalPlanningHistory } from '@/lib/planningHistory'
import { useActiveIncomeAccount } from '@/lib/useActiveIncomeAccount'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore, USD_CURRENCY } from '@/store/preferencesStore'
export function useHomeWidgetSummary() {
  const { activeAccount, activeIncomeSourceId, allAccounts } = useActiveIncomeAccount()
  const transactions = useFinanceStore((state) => state.transactions)
  const history = useFinanceStore((state) => state.monthlyPlanningHistory)
  const currencies = usePreferencesStore((state) => state.currencies)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)
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
    const canonicalHistory = getCanonicalPlanningHistory(history)
    const catalogJson = JSON.stringify({
      currencies: currencies.map((entry) => entry.code),
      accounts: allAccounts.map((account) => {
        const accountCurrency = currencies.find((entry) => entry.code === account.salary.currencyCode) ?? USD_CURRENCY
        const accountBalance = Number(account.salary.balance ?? account.salary.amount ?? 0)
        return {
          id: account.source.id,
          name: account.source.name,
          currencyCode: account.salary.currencyCode ?? 'USD',
          balance: formatMoneyWithCode(accountBalance, accountCurrency),
          todayExpenses: formatMoneyWithCode(getWidgetTodayExpenses(transactions, canonicalHistory, account.source.id, dateKey), accountCurrency),
        }
      }),
    })
    return {
      hasAccount: Boolean(activeAccount),
      accountName: activeAccount?.source.name ?? 'Sin cuenta seleccionada',
      balance: formatMoneyWithCode(Number.isFinite(balance) ? balance : 0, currency),
      todayExpenses: formatMoneyWithCode(getWidgetTodayExpenses(transactions, canonicalHistory, activeIncomeSourceId, dateKey), currency),
      dateKey,
      updatedLabel: new Date(clock).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      catalogJson,
      selectedAccountId: activeIncomeSourceId,
      selectedCurrencyCode: activeCurrencyCode,
    }
  }, [activeAccount, activeIncomeSourceId, activeCurrencyCode, allAccounts, transactions, history, currencies, clock])
}
