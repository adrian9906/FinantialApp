import { useMemo } from 'react'
import { PiggyBank } from 'lucide-react'
import {
  getFinancialPeriodStart,
  getSalaryPlanningBase,
  getTransactionsInFinancialPeriod,
} from '@plata/shared'

import { Card } from '@/components/ui/card'
import { getAccountAllocationFormula } from '@/lib/account-savings'
import { formatMoneyWithCode, getCurrencyByCode } from '@/lib/currency'
import type { IncomeAccountView } from '@/lib/income-account-view'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'

export function AccountSavingsPanel({ accounts }: { accounts: IncomeAccountView[] }) {
  const transactions = useFinanceStore((state) => state.transactions)
  const monthlyPlanningHistory = useFinanceStore((state) => state.monthlyPlanningHistory)
  const formula = usePreferencesStore((state) => state.formula)
  const accountSavingsFormulas = usePreferencesStore((state) => state.accountSavingsFormulas)

  const goals = useMemo(() => {
    const periodStart = getFinancialPeriodStart(monthlyPlanningHistory)
    const latestReset = monthlyPlanningHistory.find((entry) => entry.createdAt === periodStart)
    const periodTransactions = getTransactionsInFinancialPeriod(transactions, {
      periodStart,
      periodEnd: new Date().toISOString().slice(0, 10),
      strictSameDayBoundary: Boolean(latestReset),
      excludedTransactionIds: latestReset?.savingTransactionIds,
    })

    return accounts.flatMap((account) => {
      const accountFormula = getAccountAllocationFormula(accountSavingsFormulas, account.source.id, formula)
      if (accountFormula.savings <= 0) return []

      const target = getSalaryPlanningBase(account.salary) * (accountFormula.savings / 100)
      if (target <= 0) return []

      const saved = periodTransactions
        .filter((transaction) => transaction.type === 'saving'
          && transaction.amount > 0
          && transaction.incomeSourceId === account.source.id)
        .reduce((sum, transaction) => sum + transaction.amount, 0)
      const progress = Math.min(100, Math.round((saved / target) * 100))

      return [{
        sourceId: account.source.id,
        sourceName: account.source.name,
        currencyCode: account.salary.currencyCode ?? account.source.currencyCode ?? 'USD',
        rate: accountFormula.savings,
        target,
        saved,
        remaining: Math.max(0, target - saved),
        progress,
        isComplete: saved + 1e-9 >= target,
      }]
    })
  }, [accountSavingsFormulas, accounts, formula, monthlyPlanningHistory, transactions])

  if (goals.length === 0) return null

  return (
    <Card className="border-graphite bg-surface p-5 shadow-vault">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <PiggyBank className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-on-surface">Ahorro por cuenta</h2>
          <p className="mt-1 text-sm text-muted-gray">
            La fórmula define la meta. Cada ahorro que registras en una cuenta actualiza su progreso automáticamente.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {goals.map((goal) => {
          const currency = getCurrencyByCode(goal.currencyCode)
          return (
            <div key={goal.sourceId} className="rounded-2xl border border-graphite bg-surface-container-low p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium text-on-surface">
                  {goal.sourceName} · {goal.rate}%
                </p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${goal.isComplete ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                  {goal.isComplete ? 'Meta cumplida' : `${goal.progress}% completado`}
                </span>
              </div>
              <p className="mt-1.5 text-sm tabular-nums text-on-surface">
                {formatMoneyWithCode(goal.saved, currency)}
                <span className="text-xs font-normal text-muted-gray">
                  {' '}de {formatMoneyWithCode(goal.target, currency)}
                </span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ${goal.isComplete ? 'bg-success' : 'bg-primary'}`}
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-gray">
                {goal.isComplete
                  ? 'La meta se completó con los ahorros registrados en esta cuenta.'
                  : `Faltan ${formatMoneyWithCode(goal.remaining, currency)} por registrar.`}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
