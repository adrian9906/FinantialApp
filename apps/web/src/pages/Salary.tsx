import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { formatFormulaLabel, usePreferencesStore } from '@/store/preferencesStore'

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
  const addSalary = useFinanceStore((state) => state.addSalary)
  const updateSalary = useFinanceStore((state) => state.updateSalary)
  const removeSalary = useFinanceStore((state) => state.removeSalary)
  const formula = usePreferencesStore((state) => state.formula)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState('')
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())

  const latestSalary = salaries.length > 0
    ? salaries.reduce((max, salary) => new Date(salary.month) > new Date(max.month) ? salary : max)
    : null

  function resetForm() {
    setAmount('')
    setMonth('')
    setEditId(null)
    setCalendarYear(new Date().getFullYear())
  }

  function handleOpen(entry?: typeof salaries[number]) {
    if (entry) {
      setEditId(entry.id)
      setAmount(String(entry.amount))
      setMonth(entry.month)
      setCalendarYear(monthValueToDate(entry.month).getFullYear())
    } else {
      resetForm()
    }
    setOpen(true)
  }

  async function handleSave() {
    if (!amount || !month) return

    const payload = {
      amount: Number(amount),
      month,
    }

    if (editId) {
      await updateSalary(editId, payload)
    } else {
      await addSalary(payload)
    }

    resetForm()
    setOpen(false)
  }

  const budgetExpenses = latestSalary ? latestSalary.amount * (formula.expenses / 100) : 0
  const budgetWants = latestSalary ? latestSalary.amount * (formula.wants / 100) : 0
  const budgetSavings = latestSalary ? latestSalary.amount * (formula.savings / 100) : 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">
          Matriz de Ingresos
        </h1>
        <p className="text-sm text-muted-gray max-w-2xl">
          Cada salario se guarda en SQLite y alimenta la formula {formatFormulaLabel(formula)} del resto de la app.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-5 flex flex-col gap-4 bg-surface rounded-xl p-6 shadow-vault">
          <div className="flex justify-between items-center pb-3 border-b border-graphite">
            <h3 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <Wallet className="size-8 text-primary" />
              Ingreso Mensual
            </h3>
            <Button variant="ghost" size="sm" onClick={() => handleOpen()} className="text-primary-container hover:text-white">
              <Plus className="size-4" />
              {salaries.length > 0 ? 'Actualizar' : 'Agregar'}
            </Button>
          </div>

          {latestSalary ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-medium-gray uppercase tracking-widest">Salario Neto</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-muted-gray text-lg">$</span>
                  <Input className="bg-abyss border-graphite pl-8 text-lg font-medium text-on-surface" type="text" value={latestSalary.amount.toLocaleString()} readOnly />
                </div>
                <p className="text-xs text-muted-gray mt-1">{latestSalary.month}</p>
              </div>

              <div className="flex flex-col gap-2 bg-abyss rounded-lg p-4 shadow-vault-sm">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-gray">{formula.expenses}% Necesidades</span>
                  <span className="text-base font-semibold text-primary-fixed">${budgetExpenses.toLocaleString()}</span>
                </div>
                <div className="w-full h-1 bg-graphite rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${formula.expenses}%` }} />
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-muted-gray">{formula.wants}% Gustos</span>
                  <span className="text-base font-semibold text-secondary">${budgetWants.toLocaleString()}</span>
                </div>
                <div className="w-full h-1 bg-graphite rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-secondary" style={{ width: `${formula.wants}%` }} />
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-muted-gray">{formula.savings}% Ahorros</span>
                  <span className="text-base font-semibold text-tertiary-container">${budgetSavings.toLocaleString()}</span>
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

        <section className="lg:col-span-7 flex flex-col gap-4 bg-surface rounded-xl p-6 shadow-vault">
          <div className="flex justify-between items-center pb-3 border-b border-graphite">
            <h3 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <Receipt className="size-8 text-secondary" />
              Historial de Salarios
            </h3>
          </div>
          {salaries.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-muted-gray text-sm">
              <p>Sin registros</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[350px] pr-1">
              {salaries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-abyss rounded-lg border border-graphite group hover:border-outline-variant transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-surface-container flex items-center justify-center text-muted-gray shadow-vault-sm">
                      <Wallet className="size-4" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-on-surface">${entry.amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-gray">{entry.month}</p>
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
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-graphite bg-surface sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar Salario' : 'Agregar Salario'}</DialogTitle>
            <DialogDescription>Ingresa el monto y el mes que debe guardarse en la base de datos.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-medium-gray">Monto</Label>
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
                  {month ? `Valor guardado: ${month}` : 'Selecciona el periodo que se va a registrar en SQLite.'}
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
                        ? 'border-primary-container bg-primary-container text-white hover:brightness-110'
                        : 'border-graphite bg-surface text-muted-gray hover:bg-surface-container hover:text-on-surface'}
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
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-muted-gray">Cancelar</Button>
            <Button onClick={() => void handleSave()} className="bg-primary-container text-white hover:brightness-110 shadow-vault">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
