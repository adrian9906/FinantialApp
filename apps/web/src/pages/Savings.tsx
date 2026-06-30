import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePickerField } from '@/components/ui/date-picker-field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, PiggyBank, Pencil } from 'lucide-react'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'
import { Badge } from '@/components/ui/badge'

export default function Savings() {
  const transactions = useFinanceStore((state) => state.transactions)
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const updateTransaction = useFinanceStore((state) => state.updateTransaction)
  const removeTransaction = useFinanceStore((state) => state.removeTransaction)
  const overview = useMonthlyOverview()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ amount: '', date: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function resetForm() {
    setForm({ amount: '', date: '' })
    setEditId(null)
    setFormError(null)
  }

  function handleOpen(entry?: (typeof transactions)[number]) {
    if (entry) {
      setEditId(entry.id)
      setForm({ amount: String(entry.amount), date: entry.date })
    } else {
      setEditId(null)
      setForm({ amount: String(Math.max(0, remaining)), date: '' })
    }
    setFormError(null)
    setOpen(true)
  }

  async function handleSave() {
    if (!form.amount || isSaving) return
    const amount = Number(form.amount)

    if (editId) {
      const currentAmount = transactions.find((t) => t.id === editId)?.amount ?? 0
      const availableForEdit = Math.max(0, remaining + currentAmount)
      if (amount > availableForEdit) {
        setFormError(`Solo puedes ajustar hasta $${availableForEdit.toLocaleString()}.`)
        return
      }
    } else if (amount > remaining) {
      setFormError(`Solo puedes ahorrar hasta $${remaining.toLocaleString()}.`)
      return
    }

    const data = {
      amount,
      type: 'saving' as const,
      date: form.date || new Date().toISOString().slice(0, 10),
    }
    setIsSaving(true)

    try {
      if (editId) {
        await updateTransaction(editId, data)
      } else {
        await addTransaction(data)
      }

      resetForm()
      setOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const savingsList = transactions.filter((transaction) => transaction.type === 'saving')
  const pct = overview.budgetSavings > 0 ? Math.min(100, Math.round((overview.totalSavings / overview.budgetSavings) * 100)) : 0
  const remaining = overview.budgetSavings - overview.totalSavings
  const budgetFull = remaining <= 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Ahorros</h1>
          <p className="text-sm text-muted-gray">Esta vista opera directo sobre el modelo `Ahorro`.</p>
        </div>
        <Button onClick={() => handleOpen()} disabled={budgetFull} className="bg-tertiary-container text-white hover:brightness-110 shadow-vault disabled:opacity-40 disabled:cursor-not-allowed">
          <Plus className="size-4" /> Agregar ahorro
        </Button>
      </header>

      <div className="bg-surface rounded-xl shadow-vault p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary-container opacity-5 rounded-bl-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500" />
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-muted-gray uppercase tracking-wider">Presupuesto mensual (25%)</p>
            <Badge variant="secondary" className={remaining >= 0 ? 'bg-success/10 text-success' : 'bg-tertiary-container/20 text-tertiary'}>
              {remaining >= 0 ? `$${remaining.toLocaleString()} para ahorrar` : `$${Math.abs(remaining).toLocaleString()} excedido`}
            </Badge>
          </div>
          <h2 className="text-[28px] font-semibold text-on-surface mb-3">
            +${overview.totalSavings.toLocaleString()} <span className="text-base font-normal text-muted-gray">/ ${overview.budgetSavings.toLocaleString()}</span>
          </h2>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-tertiary-container rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {savingsList.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <PiggyBank className="size-8" />
            <p>Sin ahorros registrados</p>
            <Button variant="secondary" onClick={() => handleOpen()} disabled={budgetFull} className="bg-surface-container-high text-on-surface disabled:opacity-40 disabled:cursor-not-allowed">Registrar ahorro</Button>
          </div>
        </Card>
      ) : (
        <div className="bg-surface rounded-xl shadow-vault overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_100px_80px] gap-4 p-4 border-b border-graphite bg-surface-container-lowest text-xs text-muted-gray uppercase tracking-wider font-semibold">
            <span>Fecha</span>
            <span className="text-right">Monto</span>
            <span className="text-right">Acción</span>
          </div>
          <div className="divide-y divide-graphite">
            {savingsList.map((transaction) => (
              <div key={transaction.id} className="group grid grid-cols-1 gap-3 p-4 transition-colors hover:bg-surface-container-low md:grid-cols-[1fr_100px_80px] md:gap-4 md:items-center">
                <div>
                  <p className="text-sm font-medium text-on-surface">Ahorro registrado</p>
                  <p className="text-xs text-muted-gray">{transaction.date}</p>
                </div>
                <span className="text-sm font-medium text-success md:text-right">+${transaction.amount.toLocaleString()}</span>
                <div className="opacity-100 transition-opacity md:text-right md:opacity-0 md:group-hover:opacity-100">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpen(transaction)}>
                      <Pencil data-icon="inline-start" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => void removeTransaction(transaction.id)}>
                      <Trash2 data-icon="inline-start" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!isSaving) setOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar ahorro' : 'Agregar ahorro'}</DialogTitle>
            <DialogDescription>Guarda el monto y la fecha del movimiento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Monto</Label>
              <Input type="number" placeholder="500" value={form.amount} onChange={(e) => { setFormError(null); setForm({ ...form, amount: e.target.value }) }} className="bg-abyss border-graphite text-on-surface" />
              {!editId && remaining > 0 && (
                <p className="text-xs text-muted-gray">Disponible para ahorrar: ${Math.max(0, remaining).toLocaleString()}</p>
              )}
            </div>
            <DatePickerField
              label="Fecha"
              value={form.date}
              onChange={(value) => { setFormError(null); setForm({ ...form, date: value }) }}
              description="Elige cuando entro realmente ese aporte al ahorro."
            />
            {formError ? <p className="text-sm text-error">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={isSaving} onClick={() => { resetForm(); setOpen(false) }} className="text-muted-gray">Cancelar</Button>
            <Button loading={isSaving} onClick={() => void handleSave()} className="bg-primary-container text-white hover:brightness-110 shadow-vault">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
