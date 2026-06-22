import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { useMemo } from 'react'
import { getMonthlyOverview } from '@plata/shared'

export function useMonthlyOverview() {
  const salaries = useFinanceStore((state) => state.salaries)
  const transactions = useFinanceStore((state) => state.transactions)
  const formula = usePreferencesStore((state) => state.formula)

  return useMemo(() => getMonthlyOverview(salaries, transactions, formula), [formula, salaries, transactions])
}
