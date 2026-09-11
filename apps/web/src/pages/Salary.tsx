import { useState } from 'react'
import { Receipt, Wallet } from 'lucide-react'

import { IncomeMoneyActions } from '@/components/income/IncomeMoneyActions'
import { IncomeSourceManager } from '@/components/income/IncomeSourceManager'
import { ExportExcelButton } from '@/components/reports/ExportExcelButton'
import { formatMoneyWithCode, getCurrencyByCode } from '@/lib/currency'
import { exportSalariesReport } from '@/lib/reportExports'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { normalizeSalaryHistory } from '@plata/shared'
import { useActiveIncomeAccount } from '@/lib/useActiveIncomeAccount'

export default function Salary() {
  const salaries = useFinanceStore((state) => state.salaries)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)
  const { activeAccount, activeIncomeSourceId } = useActiveIncomeAccount()
  const [isExporting, setIsExporting] = useState(false)

  const salaryHistory = normalizeSalaryHistory(salaries).filter(
    (entry) => entry.sourceId === activeIncomeSourceId,
  )

  async function handleExport() {
    setIsExporting(true)
    try {
      await exportSalariesReport(salaryHistory)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold tracking-tight text-on-surface md:text-[36px]">
            Cuentas de ingresos
          </h1>
          <p className="max-w-2xl text-sm text-muted-gray">
            Crea cada cuenta con su saldo y moneda. El historial y la fórmula corresponden solo a la cuenta activa.
          </p>
        </div>
        <ExportExcelButton loading={isExporting} onClick={handleExport} />
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="flex flex-col gap-4 lg:col-span-5">
          <IncomeSourceManager />
          <IncomeMoneyActions />
        </section>

        <section className="flex flex-col gap-4 lg:col-span-7">
          <div className="flex flex-col gap-4 rounded-xl bg-surface p-6 shadow-vault">
            <div className="flex items-center justify-between border-b border-graphite pb-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-on-surface">
                <Receipt className="size-8 text-secondary" />
                Historial de {activeAccount?.source.name ?? activeCurrencyCode}
              </h3>
            </div>
            {salaryHistory.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-gray">
                <Wallet className="size-8" />
                <p>No hay cuentas ni movimientos en {activeCurrencyCode}.</p>
              </div>
            ) : (
              <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1">
                {salaryHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-graphite bg-abyss p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-container text-muted-gray shadow-vault-sm">
                        <Wallet className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-on-surface">{entry.sourceName ?? 'Cuenta de ingreso'}</p>
                        <p className="text-xs text-muted-gray">{entry.month}</p>
                      </div>
                    </div>
                    <p className="shrink-0 text-base font-semibold text-on-surface">
                      {formatMoneyWithCode(entry.amount, getCurrencyByCode(entry.currencyCode))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
