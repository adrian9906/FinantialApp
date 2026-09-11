import { useMemo } from 'react'
import { toast } from 'sonner'

import { AppIcon } from '@/components/icons/AppIcon'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getAccountSavingsAmount,
  getAccountSavingsRate,
  getSavingsAccountName,
} from '@/lib/account-savings'
import { formatMoneyWithCode, getCurrencyByCode } from '@/lib/currency'
import { getIncomeAccountsForMonth } from '@/lib/income-account-view'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'

export function AccountSavingsSettings() {
  const salaries = useFinanceStore((state) => state.salaries)
  const incomeSources = useFinanceStore((state) => state.incomeSources)
  const accountSavingsFormulas = usePreferencesStore((state) => state.accountSavingsFormulas)
  const setAccountSavingsRate = usePreferencesStore((state) => state.setAccountSavingsRate)

  const accounts = useMemo(
    () => getIncomeAccountsForMonth(salaries, incomeSources),
    [incomeSources, salaries],
  )

  return (
    <Card className="border-graphite bg-surface p-6 shadow-vault">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Ahorro</p>
          <h2 className="mt-2 text-2xl font-semibold text-on-surface">Ahorro por cuenta</h2>
          <p className="mt-2 text-sm text-muted-gray">
            Elige qué porcentaje de cada cuenta va al ahorro. El dinero se descuenta de esa cuenta y se
            suma a una cuenta de ahorro con su misma moneda y forma de pago.
          </p>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-vault-sm">
          <AppIcon name="savings" className="size-5" />
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-graphite bg-surface-container-low p-4 text-sm text-muted-gray">
          Todavía no tienes cuentas de ingreso este mes. Crea una para definir su ahorro.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {accounts.map((account) => {
            const currency = getCurrencyByCode(account.salary.currencyCode)
            const isCash = account.source.isCash !== false
            const rate = getAccountSavingsRate(accountSavingsFormulas, account.source.id)
            const amount = getAccountSavingsAmount(account, rate)

            return (
              <div
                key={account.source.id}
                className="grid gap-3 rounded-2xl border border-graphite bg-surface-container-low p-4 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-on-surface">{account.source.name}</p>
                  <p className="mt-1 text-xs text-muted-gray">
                    {currency.code} · {isCash ? 'Efectivo' : 'Transferencia'} ·{' '}
                    {formatMoneyWithCode(Number(account.salary.balance ?? account.salary.amount), currency)}
                  </p>
                  {rate > 0 ? (
                    <p className="mt-1.5 text-xs text-primary">
                      {formatMoneyWithCode(amount, currency)} irán a «{getSavingsAccountName(currency.code, isCash)}».
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-medium-gray">Ahorro %</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    value={rate}
                    onChange={(event) => {
                      setAccountSavingsRate(account.source.id, Number(event.target.value))
                    }}
                    onBlur={() => toast.success('Ahorro de la cuenta actualizado.')}
                    className="border-graphite bg-abyss text-on-surface"
                  />
                </div>
              </div>
            )
          })}
          <p className="text-xs text-muted-gray">
            El traspaso no es automático: se aplica desde la pantalla de Ahorros cuando lo confirmes.
          </p>
        </div>
      )}
    </Card>
  )
}
