import { useMemo } from 'react'

import { isSavingsIncomeSource } from '@/lib/account-savings'
import { getIncomeAccountsForMonth } from '@/lib/income-account-view'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'

export function useActiveIncomeAccount() {
  const salaries = useFinanceStore((state) => state.salaries)
  const incomeSources = useFinanceStore((state) => state.incomeSources)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)
  const preferredSourceId = usePreferencesStore((state) => state.activeIncomeSourceId)
  const setActiveIncomeSource = usePreferencesStore((state) => state.setActiveIncomeSource)
  const setActiveCurrency = usePreferencesStore((state) => state.setActiveCurrency)

  const allAccounts = useMemo(
    () => getIncomeAccountsForMonth(salaries, incomeSources)
      .filter((account) => !isSavingsIncomeSource(account.source)),
    [incomeSources, salaries],
  )
  const accounts = useMemo(
    () => allAccounts.filter((account) => (
      (account.salary.currencyCode ?? account.source.currencyCode ?? 'USD').trim().toUpperCase()
        === activeCurrencyCode.trim().toUpperCase()
    )),
    [activeCurrencyCode, allAccounts],
  )
  const activeAccount = accounts.find((account) => account.source.id === preferredSourceId) ?? accounts[0]

  function selectAccount(sourceId: string) {
    const account = allAccounts.find((entry) => entry.source.id === sourceId)
    if (!account) return
    const currencyCode = account.salary.currencyCode ?? account.source.currencyCode ?? 'USD'
    if (currencyCode !== activeCurrencyCode) setActiveCurrency(currencyCode)
    setActiveIncomeSource(sourceId)
  }

  return {
    accounts,
    allAccounts,
    activeAccount,
    activeIncomeSourceId: activeAccount?.source.id ?? '',
    selectAccount,
  }
}
