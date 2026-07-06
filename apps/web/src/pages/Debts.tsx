import { useMemo, useState } from 'react'
import { CalendarClock, CheckCheck, Landmark, Pencil, Plus, ReceiptText, Trash2, Wallet } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ExportExcelButton } from '@/components/reports/ExportExcelButton'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePickerField } from '@/components/ui/date-picker-field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { exportDebtsReport } from '@/lib/reportExports'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'
import { useFinanceStore } from '@/store/financeStore'

interface DebtFormState {
  amount: string
  history: string
  startDate: string
  endDate: string
  interest: string
  initialPayment: string
}

export default function Debts() {
  const debts = useFinanceStore((state) => state.debts)
  const addDebt = useFinanceStore((state) => state.addDebt)
  const updateDebt = useFinanceStore((state) => state.updateDebt)
  const payDebt = useFinanceStore((state) => state.payDebt)
  const removeDebt = useFinanceStore((state) => state.removeDebt)
  const overview = useMonthlyOverview()

  const [open, setOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [paymentDebtId, setPaymentDebtId] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [form, setForm] = useState<DebtFormState>({
    amount: '',
    history: '',
    startDate: '',
    endDate: '',
    interest: '',
    initialPayment: '',
  })

  const paymentDebt = useMemo(
    () => debts.find((entry) => entry.id === paymentDebtId) ?? null,
    [debts, paymentDebtId],
  )

  function asMoney(value: number | undefined) {
    return Number(value ?? 0).toLocaleString()
  }

  function asPercent(value: number | undefined) {
    return Number.isFinite(Number(value)) ? Number(value) : 0
  }

  function resetForm() {
    setForm({
      amount: '',
      history: '',
      startDate: '',
      endDate: '',
      interest: '',
      initialPayment: '',
    })
    setEditId(null)
    setFormError(null)
  }

  function resetPaymentFlow() {
    setPaymentDebtId(null)
    setPaymentAmount('')
    setPaymentError(null)
  }

  function handleOpen(entry?: typeof debts[number]) {
    if (entry) {
      setEditId(entry.id)
      setForm({
        amount: String(entry.amount),
        history: entry.history,
        startDate: entry.startDate,
        endDate: entry.endDate,
        interest: entry.interest === undefined ? '' : String(entry.interest),
        initialPayment: '',
      })
    } else {
      resetForm()
    }
    setFormError(null)
    setOpen(true)
  }

  function handleOpenPayment(entry: typeof debts[number]) {
    setPaymentDebtId(entry.id)
    setPaymentAmount(String(entry.remainingAmount))
    setPaymentError(null)
    setPaymentOpen(true)
  }

  async function handleSave() {
    if (!form.amount || !form.history || !form.startDate || !form.endDate || isSaving) return

    const amount = Number(form.amount)
    const initialPayment = Math.max(0, Number(form.initialPayment || 0))

    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('El monto total de la deuda debe ser mayor que cero.')
      return
    }

    if (initialPayment > amount) {
      setFormError('El pago inicial no puede ser mayor que el total de la deuda.')
      return
    }

    const payload = {
      amount,
      history: form.history.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      interest: form.interest === '' ? undefined : Number(form.interest),
    }

    setIsSaving(true)

    try {
      if (editId) {
        await updateDebt(editId, payload)
      } else {
        await addDebt({
          ...payload,
          initialPayment,
        })
      }

      resetForm()
      setOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePayDebt() {
    if (!paymentDebt || isPaying) return

    const nextPayment = Number(paymentAmount)
    if (!Number.isFinite(nextPayment) || nextPayment <= 0) {
      setPaymentError('El abono debe ser mayor que cero.')
      return
    }

    if (nextPayment > paymentDebt.remainingAmount) {
      setPaymentError(`Solo puedes abonar hasta $${asMoney(paymentDebt.remainingAmount)}.`)
      return
    }

    setIsPaying(true)

    try {
      await payDebt(paymentDebt.id, nextPayment)
      resetPaymentFlow()
      setPaymentOpen(false)
    } finally {
      setIsPaying(false)
    }
  }

  async function handleSettleDebt(entry: typeof debts[number]) {
    if (entry.isSettled || entry.remainingAmount <= 0) return
    await payDebt(entry.id, entry.remainingAmount)
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      await exportDebtsReport(debts)
    } finally {
      setIsExporting(false)
    }
  }

  const totalDebt = debts.reduce((sum, debt) => sum + debt.amount, 0)
  const totalPaid = debts.reduce((sum, debt) => sum + debt.paidAmount, 0)
  const totalRemaining = debts.reduce((sum, debt) => sum + debt.remainingAmount, 0)
  const activeDebts = debts.filter((debt) => !debt.isSettled).length
  const debtsWithInterest = debts.filter((debt) => debt.interest !== undefined)
  const averageInterest = debtsWithInterest.length > 0
    ? debtsWithInterest.reduce((sum, debt) => sum + (debt.interest ?? 0), 0) / debtsWithInterest.length
    : 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-on-surface md:text-[36px]">Deudas</h1>
          <p className="max-w-3xl text-sm text-muted-gray">
            Cada abono que registres aqui se descuenta automaticamente del salario disponible. Si marcas una deuda como saldada, se paga el restante completo.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ExportExcelButton loading={isExporting} onClick={handleExport} />
          <Button onClick={() => handleOpen()} className="bg-primary-container text-white shadow-vault hover:bg-primary-container/80">
            <Plus className="size-4" /> Nueva deuda
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl bg-surface p-5 shadow-vault">
          <div className="mb-2 flex items-center justify-between text-muted-gray">
            <span className="text-base font-medium">Total adeudado</span>
            <Landmark className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">${asMoney(totalDebt)}</div>
        </div>
        <div className="rounded-xl bg-surface p-5 shadow-vault">
          <div className="mb-2 flex items-center justify-between text-muted-gray">
            <span className="text-base font-medium">Abonado</span>
            <CheckCheck className="size-5 text-success" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">${asMoney(totalPaid)}</div>
        </div>
        <div className="rounded-xl bg-surface p-5 shadow-vault">
          <div className="mb-2 flex items-center justify-between text-muted-gray">
            <span className="text-base font-medium">Pendiente</span>
            <ReceiptText className="size-5 text-warning" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">${asMoney(totalRemaining)}</div>
        </div>
        <div className="rounded-xl bg-surface p-5 shadow-vault">
          <div className="mb-2 flex items-center justify-between text-muted-gray">
            <span className="text-base font-medium">Deudas activas</span>
            <CalendarClock className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">{activeDebts}</div>
          <p className="mt-1 text-xs text-muted-gray">{debts.length - activeDebts} saldadas</p>
        </div>
        <div className="rounded-xl bg-surface p-5 shadow-vault">
          <div className="mb-2 flex items-center justify-between text-muted-gray">
            <span className="text-base font-medium">Disponible neto</span>
            <Wallet className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">${asMoney(overview.totalSalary)}</div>
          <p className="mt-1 text-xs text-muted-gray">
            Bruto ${asMoney(overview.grossSalary)} menos ${asMoney(overview.totalDebtPaid)} abonados
          </p>
        </div>
      </div>

      {averageInterest > 0 ? (
        <Card className="border-graphite bg-surface p-4 shadow-vault-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-medium-gray">Interes promedio</p>
          <p className="mt-2 text-lg font-semibold text-on-surface">{averageInterest.toFixed(2)}%</p>
        </Card>
      ) : null}

      {debts.length === 0 ? (
        <Card className="border-0 bg-surface shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-gray">
            <Landmark className="size-8" />
            <p>Sin deudas registradas</p>
            <Button variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface">Agregar deuda</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {debts.map((debt) => (
            <article key={debt.id} className="rounded-2xl bg-surface p-4 shadow-vault">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="pt-1">
                    <Checkbox
                      checked={debt.isSettled}
                      disabled={debt.isSettled}
                      onCheckedChange={() => void handleSettleDebt(debt)}
                      aria-label={`Marcar ${debt.history} como saldada`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-on-surface">{debt.history}</h2>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge variant="secondary" className={debt.isSettled ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                            {debt.isSettled ? 'Saldada' : 'Activa'}
                          </Badge>
                          <Badge variant="secondary" className="bg-surface-container-high text-muted-gray">
                            Inicio: {debt.startDate}
                          </Badge>
                          <Badge variant="secondary" className="bg-surface-container-high text-muted-gray">
                            Fin: {debt.endDate}
                          </Badge>
                          {debt.interest !== undefined ? (
                            <Badge variant="secondary" className="bg-surface-container-high text-muted-gray">
                              Interes: {debt.interest}%
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-lg font-semibold text-on-surface">${asMoney(debt.amount)}</p>
                        <p className="text-xs text-muted-gray">Total original</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <Card className="border-graphite bg-abyss p-3 shadow-vault-sm">
                        <p className="text-xs uppercase tracking-[0.16em] text-medium-gray">Abonado</p>
                        <p className="mt-2 text-lg font-semibold text-success">${asMoney(debt.paidAmount)}</p>
                      </Card>
                      <Card className="border-graphite bg-abyss p-3 shadow-vault-sm">
                        <p className="text-xs uppercase tracking-[0.16em] text-medium-gray">Restante</p>
                        <p className="mt-2 text-lg font-semibold text-on-surface">${asMoney(debt.remainingAmount)}</p>
                      </Card>
                      <Card className="border-graphite bg-abyss p-3 shadow-vault-sm">
                        <p className="text-xs uppercase tracking-[0.16em] text-medium-gray">Progreso</p>
                        <p className="mt-2 text-lg font-semibold text-on-surface">{asPercent(debt.progress)}%</p>
                      </Card>
                    </div>

                    <div className="mt-4">
                      <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
                        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${asPercent(debt.progress)}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-muted-gray">
                        Todo lo que abonas aqui se descuenta automaticamente del salario disponible de la app.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap justify-end gap-2 lg:w-[220px]">
                  {!debt.isSettled ? (
                    <Button variant="secondary" onClick={() => handleOpenPayment(debt)} className="bg-surface-container-high text-on-surface hover:bg-surface-container-high/80">
                      Pagar deuda
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpen(debt)}>
                    <Pencil data-icon="inline-start" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => void removeDebt(debt.id)}>
                    <Trash2 data-icon="inline-start" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!isSaving) setOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar deuda' : 'Agregar deuda'}</DialogTitle>
            <DialogDescription>
              Define el total de la deuda y, si ya vas a pagar algo ahora, registra ese abono inicial para descontarlo del salario disponible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-medium-gray">Monto total</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => { setFormError(null); setForm({ ...form, amount: e.target.value }) }}
                  className="bg-abyss border-graphite text-on-surface"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Interes (opcional)</Label>
                <Input
                  type="number"
                  value={form.interest}
                  onChange={(e) => { setFormError(null); setForm({ ...form, interest: e.target.value }) }}
                  className="bg-abyss border-graphite text-on-surface"
                />
              </div>
            </div>

            {!editId ? (
              <div className="space-y-2">
                <Label className="text-medium-gray">Pago inicial de este momento (opcional)</Label>
                <Input
                  type="number"
                  value={form.initialPayment}
                  onChange={(e) => { setFormError(null); setForm({ ...form, initialPayment: e.target.value }) }}
                  placeholder="100"
                  className="bg-abyss border-graphite text-on-surface"
                />
                <p className="text-xs text-muted-gray">
                  Si aqui pones 100, esa deuda nace con $100 abonados y se descuentan automaticamente del salario disponible.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="text-medium-gray">Historial</Label>
              <Input
                value={form.history}
                onChange={(e) => { setFormError(null); setForm({ ...form, history: e.target.value }) }}
                placeholder="Prestamo personal, tarjeta, hipoteca..."
                className="bg-abyss border-graphite text-on-surface"
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <DatePickerField
                label="Fecha de inicio"
                value={form.startDate}
                onChange={(value) => { setFormError(null); setForm({ ...form, startDate: value }) }}
                description="Indica cuando comenzo realmente la deuda."
              />
              <DatePickerField
                label="Fecha de terminacion"
                value={form.endDate}
                onChange={(value) => { setFormError(null); setForm({ ...form, endDate: value }) }}
                description="Marca la fecha objetivo o final de la deuda."
              />
            </div>
            {formError ? <p className="text-sm text-error">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={isSaving} onClick={() => { resetForm(); setOpen(false) }} className="text-muted-gray">Cancelar</Button>
            <Button loading={isSaving} onClick={() => void handleSave()} className="bg-primary-container text-white shadow-vault hover:brightness-110">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={(nextOpen) => { if (!isPaying) setPaymentOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">Pagar deuda</DialogTitle>
            <DialogDescription>
              {paymentDebt
                ? `Vas a registrar un nuevo abono para "${paymentDebt.history}".`
                : 'Registra cuanto vas a pagar ahora.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {paymentDebt ? (
              <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-medium-gray">Abonado</p>
                    <p className="mt-2 text-lg font-semibold text-success">${asMoney(paymentDebt.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-medium-gray">Restante</p>
                    <p className="mt-2 text-lg font-semibold text-on-surface">${asMoney(paymentDebt.remainingAmount)}</p>
                  </div>
                </div>
              </Card>
            ) : null}

            <div className="space-y-2">
              <Label className="text-medium-gray">Monto a abonar ahora</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => { setPaymentError(null); setPaymentAmount(e.target.value) }}
                className="bg-abyss border-graphite text-on-surface"
              />
              {paymentDebt ? (
                <p className="text-xs text-muted-gray">
                  Puedes abonar hasta ${asMoney(paymentDebt.remainingAmount)} en este momento.
                </p>
              ) : null}
            </div>

            {paymentError ? <p className="text-sm text-error">{paymentError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={isPaying} onClick={() => { resetPaymentFlow(); setPaymentOpen(false) }} className="text-muted-gray">
              Cancelar
            </Button>
            <Button loading={isPaying} onClick={() => void handlePayDebt()} className="bg-primary-container text-white shadow-vault hover:brightness-110">
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
