import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Trash2, ArrowUpRight } from 'lucide-react'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'

export default function Expenses() {
  const { transactions, addTransaction, removeTransaction } = useFinanceStore()
  const overview = useMonthlyOverview()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ amount: '', description: '', date: '' })

  function handleSave() {
    if (!form.amount || !form.description) return
    addTransaction({
      id: '', amount: Number(form.amount), type: 'expense',
      description: form.description, date: form.date || new Date().toISOString().slice(0, 10),
    })
    setForm({ amount: '', description: '', date: '' }); setOpen(false)
  }

  const expenseList = transactions.filter((t) => t.type === 'expense')
  const pct = overview.budgetExpenses > 0 ? Math.min(100, Math.round((overview.totalExpenses / overview.budgetExpenses) * 100)) : 0
  const remaining = overview.budgetExpenses - overview.totalExpenses

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Gastos</h1>
          <p className="text-sm text-muted-gray">50% de tus ingresos — necesidades esenciales</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-primary-container text-white hover:brightness-110 shadow-vault">
          <Plus className="size-4" /> Agregar Gasto
        </Button>
      </header>

      <div className="bg-surface rounded-xl shadow-vault p-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary opacity-5 rounded-bl-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500" />
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-muted-gray uppercase tracking-wider">Presupuesto Mensual (50%)</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${remaining >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
              {remaining >= 0 ? `$${remaining.toLocaleString()} disponible` : `$${Math.abs(remaining).toLocaleString()} excedido`}
            </span>
          </div>
          <h2 className="text-[28px] font-semibold text-on-surface mb-3">
            ${overview.totalExpenses.toLocaleString()} <span className="text-base font-normal text-muted-gray">/ ${overview.budgetExpenses.toLocaleString()}</span>
          </h2>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {expenseList.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <ArrowUpRight className="size-8" />
            <p>Sin gastos registrados</p>
            <Button variant="secondary" onClick={() => setOpen(true)} className="bg-surface-container-high hover:bg-surface-container-higher text-on-surface">Agregar gasto</Button>
          </div>
        </Card>
      ) : (
        <div className="bg-surface rounded-xl shadow-vault overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_100px_80px] gap-4 p-4 border-b border-graphite bg-surface-container-lowest text-xs text-muted-gray uppercase tracking-wider font-semibold">
            <span>Descripción</span>
            <span className="text-right">Monto</span>
            <span className="text-right">Acción</span>
          </div>
          <div className="divide-y divide-graphite">
            {expenseList.map((t) => (
              <div key={t.id} className="grid grid-cols-[1fr_100px_80px] gap-4 p-4 hover:bg-surface-container-low transition-colors items-center group">
                <div>
                  <p className="text-sm font-medium text-on-surface">{t.description}</p>
                  <p className="text-xs text-muted-gray">{t.date}</p>
                </div>
                <span className="text-sm font-medium text-error text-right">-${t.amount.toLocaleString()}</span>
                <div className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 text-muted-gray hover:text-error transition-colors" onClick={() => removeTransaction(t.id)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface border-graphite">
          <DialogHeader>
            <DialogTitle className="text-on-surface">Agregar Gasto</DialogTitle>
            <DialogDescription>Registrar un nuevo gasto</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-medium-gray">Monto</Label>
              <Input id="amount" type="number" placeholder="200" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc" className="text-medium-gray">Descripción</Label>
              <Input id="desc" placeholder="Compra de supermercado" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date" className="text-medium-gray">Fecha</Label>
              <Input id="date" type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="bg-abyss border-graphite text-on-surface" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-muted-gray">Cancelar</Button>
            <Button onClick={handleSave} className="bg-primary-container text-white hover:brightness-110 shadow-vault">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
