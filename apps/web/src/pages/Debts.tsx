import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { DatePickerField } from '@/components/ui/date-picker-field'
import { Plus, Pencil, Trash2, Landmark, CalendarClock, Percent } from 'lucide-react'

export default function Debts() {
  const debts = useFinanceStore((state) => state.debts)
  const addDebt = useFinanceStore((state) => state.addDebt)
  const updateDebt = useFinanceStore((state) => state.updateDebt)
  const removeDebt = useFinanceStore((state) => state.removeDebt)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    amount: '',
    history: '',
    startDate: '',
    endDate: '',
    interest: '',
  })

  function resetForm() {
    setForm({
      amount: '',
      history: '',
      startDate: '',
      endDate: '',
      interest: '',
    })
    setEditId(null)
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
      })
    } else {
      resetForm()
    }
    setOpen(true)
  }

  async function handleSave() {
    if (!form.amount || !form.history || !form.startDate || !form.endDate) return

    const payload = {
      amount: Number(form.amount),
      history: form.history,
      startDate: form.startDate,
      endDate: form.endDate,
      interest: form.interest === '' ? undefined : Number(form.interest),
    }

    if (editId) {
      await updateDebt(editId, payload)
    } else {
      await addDebt(payload)
    }

    resetForm()
    setOpen(false)
  }

  const totalDebt = debts.reduce((sum, debt) => sum + debt.amount, 0)
  const debtsWithInterest = debts.filter((debt) => debt.interest !== undefined)
  const averageInterest = debtsWithInterest.length > 0
    ? debtsWithInterest.reduce((sum, debt) => sum + (debt.interest ?? 0), 0) / debtsWithInterest.length
    : 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-on-surface md:text-[36px]">Deudas</h1>
          <p className="text-sm text-muted-gray">CRUD respaldado por Prisma para las deudas asociadas al usuario.</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-primary-container text-white shadow-vault hover:bg-primary-container/80">
          <Plus className="size-4" /> Nueva deuda
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-surface p-5 shadow-vault">
          <div className="mb-2 flex items-center justify-between text-muted-gray">
            <span className="text-base font-medium">Total adeudado</span>
            <Landmark className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">${totalDebt.toLocaleString()}</div>
        </div>
        <div className="rounded-xl bg-surface p-5 shadow-vault">
          <div className="mb-2 flex items-center justify-between text-muted-gray">
            <span className="text-base font-medium">Deudas activas</span>
            <CalendarClock className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">{debts.length}</div>
        </div>
        <div className="rounded-xl bg-surface p-5 shadow-vault">
          <div className="mb-2 flex items-center justify-between text-muted-gray">
            <span className="text-base font-medium">Interes promedio</span>
            <Percent className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">{averageInterest.toFixed(2)}%</div>
        </div>
      </div>

      {debts.length === 0 ? (
        <Card className="border-0 bg-surface shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-gray">
            <Landmark className="size-8" />
            <p>Sin deudas registradas</p>
            <Button variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface">Agregar deuda</Button>
          </div>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl bg-surface shadow-vault">
          <div className="hidden grid-cols-[1.2fr_120px_120px_120px_80px] gap-4 border-b border-graphite bg-surface-container-lowest p-4 text-xs font-semibold uppercase tracking-wider text-muted-gray md:grid">
            <span>Historial</span>
            <span className="text-right">Monto</span>
            <span>Inicio</span>
            <span>Fin</span>
            <span className="text-right">Accion</span>
          </div>
          <div className="divide-y divide-graphite">
            {debts.map((debt) => (
              <div key={debt.id} className="grid grid-cols-1 items-center gap-3 p-4 transition-colors hover:bg-surface-container-low md:grid-cols-[1.2fr_120px_120px_120px_80px] md:gap-4 group">
                <div>
                  <p className="text-sm font-medium text-on-surface">{debt.history}</p>
                  <Badge variant="secondary" className="mt-1 bg-surface-container-high text-muted-gray">
                    {debt.interest !== undefined ? `Interes: ${debt.interest}%` : 'Sin interes registrado'}
                  </Badge>
                </div>
                <div className="text-sm text-on-surface md:text-right">${debt.amount.toLocaleString()}</div>
                <div className="text-xs text-muted-gray">{debt.startDate}</div>
                <div className="text-xs text-muted-gray">{debt.endDate}</div>
                <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpen(debt)}>
                    <Pencil data-icon="inline-start" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => void removeDebt(debt.id)}>
                    <Trash2 data-icon="inline-start" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-graphite bg-surface sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar deuda' : 'Agregar deuda'}</DialogTitle>
            <DialogDescription>Guarda monto, historial y fechas segun el schema actual.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-medium-gray">Monto</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Interes (opcional)</Label>
                <Input type="number" value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">Historial</Label>
              <Input value={form.history} onChange={(e) => setForm({ ...form, history: e.target.value })} placeholder="Prestamo personal, tarjeta, hipoteca..." className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <DatePickerField
                label="Fecha de inicio"
                value={form.startDate}
                onChange={(value) => setForm({ ...form, startDate: value })}
                description="Indica cuando comenzo realmente la deuda."
              />
              <DatePickerField
                label="Fecha de terminacion"
                value={form.endDate}
                onChange={(value) => setForm({ ...form, endDate: value })}
                description="Marca la fecha objetivo o final de la deuda."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { resetForm(); setOpen(false) }} className="text-muted-gray">Cancelar</Button>
            <Button onClick={() => void handleSave()} className="bg-primary-container text-white shadow-vault hover:brightness-110">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
