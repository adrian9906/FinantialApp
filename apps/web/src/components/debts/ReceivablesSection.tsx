import { useEffect, useMemo, useState } from 'react'
import { BellRing, CalendarClock, CheckCheck, HandCoins, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { getReceivableTotal, type Debt } from '@plata/shared'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DatePickerField } from '@/components/ui/date-picker-field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatMoney, useCurrencyInput } from '@/lib/currency'
import { getTodayDateKey } from '@/lib/date'
import { useReceivablesStore } from '@/store/receivablesStore'

interface ReceivableFormState {
  counterparty: string
  history: string
  amount: string
  interest: string
  startDate: string
  endDate: string
}

function createEmptyForm(): ReceivableFormState {
  return {
    counterparty: '',
    history: '',
    amount: '',
    interest: '',
    startDate: getTodayDateKey(),
    endDate: getTodayDateKey(),
  }
}

function getDueStatus(debt: Debt) {
  if (debt.isSettled) return { label: 'Cobrada', className: 'bg-success/10 text-success' }
  const today = getTodayDateKey()
  if (debt.endDate < today) return { label: 'Vencida', className: 'bg-error/10 text-error' }
  if (debt.endDate === today) return { label: 'Cobra hoy', className: 'bg-warning/10 text-warning' }
  return { label: 'Pendiente', className: 'bg-primary/10 text-primary' }
}

export function ReceivablesSection() {
  const hydrate = useReceivablesStore((state) => state.hydrate)
  const receivables = useReceivablesStore((state) => state.receivables)
  const addReceivable = useReceivablesStore((state) => state.addReceivable)
  const updateReceivable = useReceivablesStore((state) => state.updateReceivable)
  const markCollected = useReceivablesStore((state) => state.markCollected)
  const removeReceivable = useReceivablesStore((state) => state.removeReceivable)
  const moneyInput = useCurrencyInput()

  useEffect(() => { hydrate() }, [hydrate])
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<ReceivableFormState>(createEmptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [collectingId, setCollectingId] = useState<string | null>(null)

  const pendingTotal = receivables
    .filter((debt) => !debt.isSettled)
    .reduce((sum, debt) => sum + getReceivableTotal(debt), 0)

  function openForm(debt?: Debt) {
    setError(null)
    setEditId(debt?.id ?? null)
    setForm(debt ? {
      counterparty: debt.counterparty ?? '',
      history: debt.history,
      amount: moneyInput.fromUsd(debt.amount),
      interest: debt.interest === undefined ? '' : String(debt.interest),
      startDate: debt.startDate,
      endDate: debt.endDate,
    } : createEmptyForm())
    setOpen(true)
  }

  async function handleSave() {
    if (isSaving) return
    const amount = moneyInput.toUsd(form.amount)
    const interest = form.interest === '' ? undefined : Number(form.interest)
    if (!form.counterparty.trim() || !form.history.trim() || !form.startDate || !form.endDate) {
      setError('Completa la persona, el motivo y las dos fechas.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('El importe prestado debe ser mayor que cero.')
      return
    }
    if (interest !== undefined && (!Number.isFinite(interest) || interest < 0)) {
      setError('El interés debe ser cero o un porcentaje positivo.')
      return
    }
    if (form.endDate < form.startDate) {
      setError('La fecha de pago no puede ser anterior a la fecha de inicio.')
      return
    }

    const payload = {
      counterparty: form.counterparty.trim(),
      history: form.history.trim(),
      amount,
      interest,
      startDate: form.startDate,
      endDate: form.endDate,
    }

    setIsSaving(true)
    try {
      if (editId) updateReceivable(editId, payload)
      else addReceivable(payload)
      setOpen(false)
      setEditId(null)
      setForm(createEmptyForm())
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el préstamo por cobrar.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleMarkCollected(debt: Debt) {
    if (collectingId) return
    setCollectingId(debt.id)
    try {
      markCollected(debt.id)
    } finally {
      setCollectingId(null)
    }
  }

  return (
    <section className="space-y-4 border-t border-graphite pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <HandCoins className="size-5" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Dinero que me deben</p>
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-on-surface">Préstamos por cobrar</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-gray">
            Registra quién te debe, por qué, cuánto y cuándo debe pagarte. Al llegar la fecha verás un recordatorio automático.
          </p>
        </div>
        <Button onClick={() => openForm()} className="bg-primary-container text-white shadow-vault hover:bg-primary-container/80">
          <Plus className="size-4" /> Nuevo préstamo
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-graphite bg-surface p-5 shadow-vault">
          <p className="text-xs uppercase tracking-[0.16em] text-medium-gray">Pendiente de cobrar</p>
          <p className="mt-2 text-3xl font-semibold text-on-surface">{formatMoney(pendingTotal)}</p>
        </Card>
        <Card className="border-graphite bg-surface p-5 shadow-vault">
          <p className="text-xs uppercase tracking-[0.16em] text-medium-gray">Préstamos activos</p>
          <p className="mt-2 text-3xl font-semibold text-on-surface">{receivables.filter((debt) => !debt.isSettled).length}</p>
        </Card>
        <Card className="border-primary/20 bg-primary/8 p-5 shadow-vault">
          <div className="flex items-center gap-2 text-primary"><BellRing className="size-4" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Aviso automático</span></div>
          <p className="mt-2 text-sm text-muted-gray">El día del vencimiento recibirás el nombre de la persona y el importe que debe pagarte.</p>
        </Card>
      </div>

      {receivables.length === 0 ? (
        <Card className="border-0 bg-surface py-12 text-center shadow-vault">
          <HandCoins className="mx-auto size-8 text-muted-gray" />
          <p className="mt-3 text-sm text-muted-gray">Todavía no tienes dinero pendiente de cobro.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {receivables.map((debt) => {
            const status = getDueStatus(debt)
            const total = getReceivableTotal(debt)
            return (
              <article key={debt.id} className="rounded-2xl bg-surface p-5 shadow-vault">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <UserRound className="size-5 text-primary" />
                      <h3 className="text-lg font-semibold text-on-surface">{debt.counterparty}</h3>
                      <Badge variant="secondary" className={status.className}>{status.label}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-gray">Motivo: {debt.history}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div><p className="text-xs text-medium-gray">Importe prestado</p><p className="mt-1 font-semibold text-on-surface">{formatMoney(debt.amount)}</p></div>
                      <div><p className="text-xs text-medium-gray">Interés</p><p className="mt-1 font-semibold text-on-surface">{debt.interest ?? 0}%</p></div>
                      <div><p className="text-xs text-medium-gray">Total esperado</p><p className="mt-1 font-semibold text-success">{formatMoney(total)}</p></div>
                      <div><p className="text-xs text-medium-gray">Fecha de pago</p><p className="mt-1 flex items-center gap-1 font-semibold text-on-surface"><CalendarClock className="size-4" />{debt.endDate}</p></div>
                    </div>
                    <p className="mt-3 text-xs text-muted-gray">Inicio: {debt.startDate}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!debt.isSettled ? (
                      <Button loading={collectingId === debt.id} variant="secondary" onClick={() => handleMarkCollected(debt)} className="bg-success/10 text-success hover:bg-success/15">
                        <CheckCheck className="size-4" /> Marcar cobrada
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="icon" aria-label={`Editar préstamo de ${debt.counterparty}`} onClick={() => openForm(debt)}><Pencil /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Eliminar préstamo de ${debt.counterparty}`} className="text-muted-gray hover:text-error" onClick={() => removeReceivable(debt.id)}><Trash2 /></Button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!isSaving) setOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar préstamo por cobrar' : 'Registrar dinero que me deben'}</DialogTitle>
            <DialogDescription>Guarda los datos del préstamo y la fecha en la que esperas recibir el pago.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Persona que me debe</Label><Input value={form.counterparty} onChange={(event) => setForm((current) => ({ ...current, counterparty: event.target.value }))} placeholder="Fulanito de tal" /></div>
            <div className="space-y-2"><Label>Razón del préstamo</Label><Input value={form.history} onChange={(event) => setForm((current) => ({ ...current, history: event.target.value }))} placeholder="Préstamo personal, compra..." /></div>
            <div className="space-y-2"><Label>Importe prestado ({moneyInput.currency.code})</Label><Input type="number" min="0" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Interés % (opcional)</Label><Input type="number" min="0" value={form.interest} onChange={(event) => setForm((current) => ({ ...current, interest: event.target.value }))} /></div>
            <DatePickerField label="Fecha de inicio" value={form.startDate} onChange={(value) => setForm((current) => ({ ...current, startDate: value }))} />
            <DatePickerField label="Fecha de pago" value={form.endDate} onChange={(value) => setForm((current) => ({ ...current, endDate: value }))} description="Ese día se activará el recordatorio de cobro." />
          </div>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <DialogFooter>
            <Button variant="ghost" disabled={isSaving} onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={isSaving} onClick={() => void handleSave()} className="bg-primary-container text-white">Guardar préstamo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
