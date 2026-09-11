import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PiggyBank } from 'lucide-react'
import { getMonthKey } from '@plata/shared'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  getAccountSavingsGoals,
  getAccountSavingsPlans,
  type AccountSavingsPlan,
} from '@/lib/account-savings'
import { formatMoneyWithCode, getCurrencyByCode } from '@/lib/currency'
import { getIncomeAccountsForMonth } from '@/lib/income-account-view'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'

export function AccountSavingsPanel() {
  const salaries = useFinanceStore((state) => state.salaries)
  const incomeSources = useFinanceStore((state) => state.incomeSources)
  const transferIncomeMoney = useFinanceStore((state) => state.transferIncomeMoney)
  const accountSavingsFormulas = usePreferencesStore((state) => state.accountSavingsFormulas)
  const [applyingId, setApplyingId] = useState<string | null>(null)

  const month = getMonthKey()
  const accounts = useMemo(
    () => getIncomeAccountsForMonth(salaries, incomeSources, month),
    [incomeSources, month, salaries],
  )
  const plans = useMemo(
    () => getAccountSavingsPlans(accounts, accountSavingsFormulas, incomeSources),
    [accounts, accountSavingsFormulas, incomeSources],
  )
  const goals = useMemo(
    () => getAccountSavingsGoals(accounts, accountSavingsFormulas, incomeSources, salaries, month),
    [accounts, accountSavingsFormulas, incomeSources, month, salaries],
  )

  async function handleApply(plan: AccountSavingsPlan) {
    if (applyingId) return
    setApplyingId(plan.sourceId)
    try {
      // Savings keep the origin's currency and payment rail, so each combination
      // lands in its own savings account instead of a single shared one.
      await transferIncomeMoney({
        sourceSalaryId: plan.salaryId,
        amountUsd: plan.amountUsd,
        month,
        destination: {
          sourceId: plan.existingSavingsSourceId,
          newSourceName: plan.existingSavingsSourceId ? undefined : plan.savingsAccountName,
          currencyCode: plan.currencyCode,
          isCash: plan.isCash,
          recurring: true,
          balanceMode: 'fixed',
        },
      })
      toast.success(`Se movieron ${formatMoneyWithCode(plan.amountUsd, getCurrencyByCode(plan.currencyCode))} a «${plan.savingsAccountName}».`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo aplicar el ahorro.')
    } finally {
      setApplyingId(null)
    }
  }

  if (plans.length === 0 && goals.length === 0) return null

  return (
    <Card className="border-graphite bg-surface p-5 shadow-vault">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <PiggyBank className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-on-surface">Ahorro por cuenta</h2>
          <p className="mt-1 text-sm text-muted-gray">
            Según la fórmula que definiste en Ajustes. El dinero se descuenta de la cuenta y se suma a su
            cuenta de ahorro.
          </p>
        </div>
      </div>

      {goals.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.14em] text-medium-gray">Meta por cuenta</p>
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
                  {formatMoneyWithCode(goal.savedUsd, currency)}
                  <span className="text-xs font-normal text-muted-gray">
                    {' '}de {formatMoneyWithCode(goal.goalUsd, currency)}
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
                    ? `Guardado en «${goal.savingsAccountName}».`
                    : `Faltan ${formatMoneyWithCode(goal.remainingUsd, currency)} en «${goal.savingsAccountName}».`}
                </p>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {plans.length > 0 ? (
          <p className="text-xs uppercase tracking-[0.14em] text-medium-gray">Pendiente de aplicar</p>
        ) : null}
        {plans.map((plan) => {
          const currency = getCurrencyByCode(plan.currencyCode)
          return (
            <div
              key={plan.sourceId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-graphite bg-surface-container-low p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-on-surface">
                  {plan.sourceName} · {plan.rate}%
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-gray">
                  {formatMoneyWithCode(plan.amountUsd, currency)} → {plan.savingsAccountName}
                </p>
              </div>
              <Button
                size="sm"
                loading={applyingId === plan.sourceId}
                disabled={applyingId !== null && applyingId !== plan.sourceId}
                onClick={() => void handleApply(plan)}
              >
                Aplicar
              </Button>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
