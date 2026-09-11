import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PiggyBank } from 'lucide-react'
import { getMonthKey } from '@plata/shared'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getAccountSavingsPlans, type AccountSavingsPlan } from '@/lib/account-savings'
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
  const plans = useMemo(
    () => getAccountSavingsPlans(
      getIncomeAccountsForMonth(salaries, incomeSources, month),
      accountSavingsFormulas,
      incomeSources,
    ),
    [accountSavingsFormulas, incomeSources, month, salaries],
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

  if (plans.length === 0) return null

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

      <div className="mt-4 space-y-2">
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
