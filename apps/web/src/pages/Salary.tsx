import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ExportExcelButton } from '@/components/reports/ExportExcelButton'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Wallet, Receipt } from 'lucide-react'
import { exportSalariesReport } from '@/lib/reportExports'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'
import { formatMoney, useCurrencyInput, useMoneyWithCode } from '@/lib/currency'
import { formatFormulaLabel, usePreferencesStore } from '@/store/preferencesStore'
import { getActiveIncomeSources, getIncomesForMonth, getMonthKey, getSalaryForMonth, getTotalIncomeForMonth, normalizeSalaryHistory } from '@plata/shared'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { IncomeSourceManager } from '@/components/income/IncomeSourceManager'

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function monthValueToDate(value: string) {
  if (!value) {
    return new Date()
  }

  const [year, month] = value.split('-').map(Number)

  if (!year || !month) {
    return new Date()
  }

  return new Date(year, month - 1, 1)
}

export default function Salary() {
  const salaries = useFinanceStore((state) => state.salaries)
  const incomeSources = useFinanceStore((state) => state.incomeSources)
  const addSalary = useFinanceStore((state) => state.addSalary)
  const updateSalary = useFinanceStore((state) => state.updateSalary)
  const removeSalary = useFinanceStore((state) => state.removeSalary)
  const overview = useMonthlyOverview()
  const formatSalary = useMoneyWithCode()
  const moneyInput = useCurrencyInput()
  const formula = usePreferencesStore((state) => state.formula)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const availableSources = getActiveIncomeSources(incomeSources)
  const selectedSource = incomeSources.find((entry) => entry.id === sourceId) ?? null

  const currentMonth = getMonthKey()
  const currentMonthIncomes = getIncomesForMonth(salaries, currentMonth)
  const currentMonthTotal = getTotalIncomeForMonth(salaries, currentMonth)
  const salaryHistory = normalizeSalaryHistory(salaries)
  const currentSalary = salaryHistory.find((salary) => salary.month === currentMonth) ?? null
  const activeSalary = getSalaryForMonth(salaryHistory, currentMonth)
  const formulaDistribution = {
    expenses: overview.totalSalary * (formula.expenses / 100),
    wants: overview.totalSalary * (formula.wants / 100),
    savings: overview.totalSalary * (formula.savings / 100),
  }

  function resetForm() {
    setAmount('')
    setMonth('')
    setSourceId('')
    setEditId(null)
    setCalendarYear(new Date().getFullYear())
  }

  function handleOpen(entry?: typeof salaries[number]) {
    if (entry) {
      setEditId(entry.id)
      setAmount(moneyInput.fromUsd(entry.amount))
      setMonth(entry.month)
      setSourceId(entry.sourceId ?? '')
      setCalendarYear(monthValueToDate(entry.month).getFullYear())
    } else {
      resetForm()
      setMonth(currentMonth)
    }
    setOpen(true)
  }

  function handleOpenCurrentSalary() {
    if (currentSalary) {
      handleOpen(currentSalary)
      return
    }

    resetForm()
    setAmount(activeSalary ? moneyInput.fromUsd(activeSalary.amount) : '')
    setMonth(currentMonth)
    setOpen(true)
  }

  async function handleSave() {
    if (!amount || !month || isSaving) return

    const source = incomeSources.find((entry) => entry.id === sourceId)
    const payload = {
      amount: moneyInput.toUsd(amount),
      month,
      ...(source
        ? {
            sourceId: source.id,
            sourceName: source.name,
            kind: (source.recurring ? 'recurring' : 'one-off') as 'recurring' | 'one-off',
          }
        : {}),
    }

    setIsSaving(true)

    try {
      if (editId) {
        await updateSalary(editId, payload)
      } else {
        // addSalary replaces the same source in the same month and adds any
        // other source alongside, so a second job is never overwritten.
        await addSalary(payload)
      }

      resetForm()
      setOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      await exportSalariesReport(salaries)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">
            Matriz de Ingresos
          </h1>
          <p className="text-sm text-muted-gray max-w-2xl">
            Cada ingreso se guarda y alimenta la fórmula {formatFormulaLabel(formula)} del resto de la app.
          </p>
        </div>
        <ExportExcelButton loading={isExporting} onClick={handleExport} />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-5 flex flex-col gap-4 bg-surface rounded-xl p-6 shadow-vault">
          <div className="flex justify-between items-center pb-3 border-b border-graphite">
            <h3 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <Wallet className="size-8 text-primary" />
              Ingreso Mensual
            </h3>
            <Button variant="ghost" size="sm" onClick={handleOpenCurrentSalary} className="text-primary-container hover:text-white">
              {activeSalary ? <Pencil className="size-4" /> : <Plus className="size-4" />}
              {activeSalary ? 'Actualizar' : 'Agregar'}
            </Button>
          </div>

          {activeSalary ? (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="active-salary" className="text-xs text-medium-gray uppercase tracking-widest">Ingresos totales</label>
                <Input id="active-salary" className="bg-abyss border-graphite text-lg font-medium text-on-surface" type="text" value={formatSalary(overview.totalSalary)} readOnly />
                <p className="text-xs text-muted-gray mt-1">{activeSalary.month}</p>
                {overview.totalDebtPaid > 0 && (
                  <p className="text-xs text-muted-gray">
                    Este mes pagaste {formatMoney(overview.totalDebtPaid)} en deudas desde tus ahorros. Tu salario no se reduce automáticamente.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 bg-abyss rounded-lg p-4 shadow-vault-sm">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-gray">{formula.expenses}% Necesidades</span>
                  <span className="text-base font-semibold text-primary-fixed">{formatSalary(formulaDistribution.expenses)}</span>
                </div>
                <div className="w-full h-1 bg-graphite rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${formula.expenses}%` }} />
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-muted-gray">{formula.wants}% Gustos</span>
                  <span className="text-base font-semibold text-secondary">{formatSalary(formulaDistribution.wants)}</span>
                </div>
                <div className="w-full h-1 bg-graphite rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-secondary" style={{ width: `${formula.wants}%` }} />
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-muted-gray">{formula.savings}% Ahorros</span>
                  <span className="text-base font-semibold text-tertiary-container">{formatSalary(formulaDistribution.savings)}</span>
                </div>
                <div className="w-full h-1 bg-graphite rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-tertiary-container" style={{ width: `${formula.savings}%` }} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-10 text-muted-gray text-sm gap-3">
              <Wallet className="size-8" />
              <p>No hay salario registrado</p>
              <Button variant="secondary" size="sm" onClick={() => handleOpen()}>
                <Plus className="size-4" /> Agregar salario
              </Button>
            </div>
          )}
        </section>

        <section className="lg:col-span-7 flex flex-col gap-4">
          <Card className="border-graphite bg-surface p-5 shadow-vault">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-on-surface">Ingresos de este mes</h3>
              <p className="text-lg font-semibold text-on-surface">{formatSalary(currentMonthTotal)}</p>
            </div>
            {currentMonthIncomes.length === 0 ? (
              <p className="text-sm text-muted-gray">
                Sin ingresos registrados este mes.
                {activeSalary ? ' Se está usando el último ingreso fijo conocido.' : ''}
              </p>
            ) : (
              <ul className="space-y-2">
                {currentMonthIncomes.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-gray">
                      {entry.sourceName ?? 'Ingreso'}
                      {entry.kind === 'one-off' ? ' · puntual' : ''}
                    </span>
                    <span className="font-medium text-on-surface">{formatSalary(entry.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <IncomeSourceManager />

        <div className="flex flex-col gap-4 bg-surface rounded-xl p-6 shadow-vault">
          <div className="flex justify-between items-center pb-3 border-b border-graphite">
            <h3 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <Receipt className="size-8 text-secondary" />
              Historial de ingresos
            </h3>
          </div>
          {salaryHistory.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-muted-gray text-sm">
              <p>Sin registros</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[350px] pr-1">
              {salaryHistory.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-abyss rounded-lg border border-graphite group hover:border-outline-variant transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-surface-container flex items-center justify-center text-muted-gray shadow-vault-sm">
                      <Wallet className="size-4" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-on-surface">{formatSalary(entry.amount)}</p>
                      <p className="text-xs text-muted-gray">
                        {entry.month}
                        {entry.sourceName ? ` · ${entry.sourceName}` : ''}
                        {entry.kind === 'one-off' ? ' · puntual' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpen(entry)}>
                      <Pencil data-icon="inline-start" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => void removeSalary(entry.id)}>
                      <Trash2 data-icon="inline-start" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </section>
      </div>

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!isSaving) setOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar ingreso' : 'Agregar ingreso'}</DialogTitle>
            <DialogDescription>Registra cuánto entró, de qué fuente y en qué mes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-medium-gray">Fuente de ingreso</Label>
                <Select value={sourceId} onValueChange={(value) => setSourceId(value ?? '')}>
                  <SelectTrigger className="bg-abyss border-graphite">
                    <SelectValue>
                      {selectedSource
                        ? `${selectedSource.name}${selectedSource.recurring ? '' : ' (puntual)'}`
                        : 'Sin fuente asignada'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin fuente asignada</SelectItem>
                    {availableSources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}{source.recurring ? '' : ' (puntual)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-gray">
                  {availableSources.length === 0
                    ? 'Agrega una fuente abajo para separar tus ingresos por trabajo.'
                    : 'Elige el trabajo o el bonus al que corresponde este monto.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount" className="text-medium-gray">Monto ({moneyInput.currency.code})</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-abyss border-graphite text-on-surface focus:border-tertiary-container"
                />
              </div>

              <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Mes seleccionado</p>
                <p className="mt-2 text-xl font-semibold text-on-surface">
                  {month ? `${MONTH_LABELS[monthValueToDate(month).getMonth()]} ${monthValueToDate(month).getFullYear()}` : 'Elige un mes'}
                </p>
                <p className="mt-1 text-sm text-muted-gray">
                  {month ? `Valor guardado: ${month}` : 'Selecciona el período que se va a registrar en SQLite.'}
                </p>
              </Card>
            </div>

            <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-on-surface">Calendario de meses</p>
                  <p className="text-xs text-muted-gray">Usa el anio y toca el mes que corresponda.</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-gray hover:text-on-surface"
                    onClick={() => setCalendarYear((year) => year - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <div className="min-w-16 text-center text-sm font-semibold text-on-surface">{calendarYear}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-gray hover:text-on-surface"
                    onClick={() => setCalendarYear((year) => year + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {MONTH_LABELS.map((label, index) => {
                  const value = `${calendarYear}-${String(index + 1).padStart(2, '0')}`
                  const isSelected = month === value

                  return (
                    <Button
                      key={value}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      className={isSelected
                        ? 'border-primary-container bg-primary-container text-white hover:bg-primary-container/80'
                        : 'border-graphite bg-surface text-muted-gray hover:bg-surface-container hover:text-on-surface'}
                      disabled={editId !== null}
                      onClick={() => setMonth(value)}
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={isSaving} onClick={() => setOpen(false)} className="text-muted-gray">Cancelar</Button>
            <Button loading={isSaving} onClick={() => void handleSave()} className="bg-primary-container text-white hover:bg-primary-container/80 shadow-vault">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
