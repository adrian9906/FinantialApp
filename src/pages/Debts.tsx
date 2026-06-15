import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Landmark, CalendarClock, Percent } from 'lucide-react'

export default function Debts() {
  const { debts, addDebt, updateDebt, removeDebt } = useFinanceStore()
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
  const averageInterest = debts.filter((debt) => debt.interest !== undefined).length > 0
    ? debts
        .filter((debt) => debt.interest !== undefined)
        .reduce((sum, debt) => sum + (debt.interest ?? 0), 0) / debts.filter((debt) => debt.interest !== undefined).length
    : 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Deudas</h1>
          <p className="text-sm text-muted-gray">CRUD respaldado por Prisma para las deudas asociadas al usuario.</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-primary-container text-white hover:brightness-110 shadow-vault">
          <Plus className="size-4" /> Nueva deuda
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface rounded-xl p-5 shadow-vault">
          <div className="flex items-center justify-between mb-2 text-muted-gray">
            <span className="text-base font-medium">Total adeudado</span>
            <Landmark className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">${totalDebt.toLocaleString()}</div>
        </div>
        <div className="bg-surface rounded-xl p-5 shadow-vault">
          <div className="flex items-center justify-between mb-2 text-muted-gray">
            <span className="text-base font-medium">Deudas activas</span>
            <CalendarClock className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">{debts.length}</div>
        </div>
        <div className="bg-surface rounded-xl p-5 shadow-vault">
          <div className="flex items-center justify-between mb-2 text-muted-gray">
            <span className="text-base font-medium">Interés promedio</span>
            <Percent className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">{averageInterest.toFixed(2)}%</div>
        </div>
      </div>

      {debts.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <Landmark className="size-8" />
            <p>Sin deudas registradas</p>
            <Button variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface">Agregar deuda</Button>
          </div>
        </Card>
      ) : (
        <div className="bg-surface rounded-xl shadow-vault overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.2fr_120px_120px_120px_80px] gap-4 p-4 border-b border-graphite bg-surface-container-lowest text-xs text-muted-gray uppercase tracking-wider font-semibold">
            <span>Historial</span>
            <span className="text-right">Monto</span>
            <span>Inicio</span>
            <span>Fin</span>
            <span className="text-right">Acción</span>
          </div>
          <div className="divide-y divide-graphite">
            {debts.map((debt) => (
              <div key={debt.id} className="grid grid-cols-1 md:grid-cols-[1.2fr_120px_120px_120px_80px] gap-3 md:gap-4 p-4 hover:bg-surface-container-low transition-colors items-center group">
                <div>
                  <p className="text-sm font-medium text-on-surface">{debt.history}</p>
                  <Badge variant="secondary" className="mt-1 bg-surface-container-high text-muted-gray">
                    {debt.interest !== undefined ? `Interés: ${debt.interest}%` : 'Sin interés registrado'}
                  </Badge>
                </div>
                <div className="text-sm text-on-surface md:text-right">${debt.amount.toLocaleString()}</div>
                <div className="text-xs text-muted-gray">{debt.startDate}</div>
                <div className="text-xs text-muted-gray">{debt.endDate}</div>
                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        <DialogContent className="bg-surface border-graphite">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar deuda' : 'Agregar deuda'}</DialogTitle>
            <DialogDescription>Guarda monto, historial y fechas según el nuevo schema.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Monto</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">Historial</Label>
              <Input value={form.history} onChange={(e) => setForm({ ...form, history: e.target.value })} placeholder="Préstamo personal, tarjeta, hipoteca..." className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-medium-gray">Fecha de inicio</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Fecha de terminación</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">Interés (opcional)</Label>
              <Input type="number" value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { resetForm(); setOpen(false) }} className="text-muted-gray">Cancelar</Button>
            <Button onClick={() => void handleSave()} className="bg-primary-container text-white hover:brightness-110 shadow-vault">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
