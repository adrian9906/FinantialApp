import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

import { Plus, Pencil, Trash2, Landmark } from 'lucide-react'

interface FormState { name: string; totalAmount: string; paidAmount: string; interestRate: string; dueDate: string; monthlyPayment: string }

export default function Debts() {
  const { debts, addDebt, updateDebt, removeDebt } = useFinanceStore()
  const [open, setOpen] = useState(false); const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ name: '', totalAmount: '', paidAmount: '', interestRate: '', dueDate: '', monthlyPayment: '' })

  function resetForm() { setForm({ name: '', totalAmount: '', paidAmount: '', interestRate: '', dueDate: '', monthlyPayment: '' }); setEditId(null) }
  function handleOpen(entry?: typeof debts[0]) {
    if (entry) {
      setEditId(entry.id); setForm({ name: entry.name, totalAmount: String(entry.totalAmount), paidAmount: String(entry.paidAmount), interestRate: String(entry.interestRate), dueDate: entry.dueDate, monthlyPayment: String(entry.monthlyPayment) })
    } else { resetForm() }
    setOpen(true)
  }
  function handleSave() {
    if (!form.name || !form.totalAmount) return
    const data = { name: form.name, totalAmount: Number(form.totalAmount), paidAmount: Number(form.paidAmount) || 0, interestRate: Number(form.interestRate) || 0, dueDate: form.dueDate, monthlyPayment: Number(form.monthlyPayment) || 0 }
    if (editId) { updateDebt(editId, data) } else { addDebt(data as any) }
    resetForm(); setOpen(false)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Debts</h1>
          <p className="text-sm text-muted-gray">Active Liabilities</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-error/20 text-error hover:bg-error/30 border border-error/30 shadow-vault">
          <Plus className="size-4" /> Add Debt
        </Button>
      </header>

      {debts.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <Landmark className="size-8" />
            <p>No debts recorded</p>
            <Button variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface">Add a debt</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {debts.map((d) => {
            const progress = d.totalAmount > 0 ? (d.paidAmount / d.totalAmount) * 100 : 0
            const remaining = d.totalAmount - d.paidAmount
            return (
              <div key={d.id} className="bg-abyss p-5 rounded-xl border border-graphite shadow-vault flex flex-col gap-4 group hover:border-outline-variant transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-[18px] font-medium text-on-surface">{d.name}</h4>
                    <p className="text-xs text-muted-gray mt-1">
                      {d.interestRate > 0 && `${d.interestRate}% APR`}
                      {d.monthlyPayment > 0 && ` • Min $${d.monthlyPayment}/mo`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button className="p-1.5 text-muted-gray hover:text-primary transition-colors" onClick={() => handleOpen(d)}><Pencil className="size-4" /></button>
                    <button className="p-1.5 text-muted-gray hover:text-error transition-colors" onClick={() => removeDebt(d.id)}><Trash2 className="size-4" /></button>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-medium-gray">Paid: ${d.paidAmount.toLocaleString()}</span>
                    <span className="text-on-surface font-medium">Left: ${remaining.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2.5 shadow-vault-sm overflow-hidden">
                    <div className="bg-tertiary-container h-2.5 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface border-graphite">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Edit Debt' : 'Add Debt'}</DialogTitle>
            <DialogDescription>Enter the debt details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Name</Label>
              <Input placeholder="Credit Card" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-medium-gray">Total</Label>
                <Input type="number" value={form.totalAmount} onChange={e => setForm({ ...form, totalAmount: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Paid</Label>
                <Input type="number" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-medium-gray">APR (%)</Label>
                <Input type="number" step="0.1" value={form.interestRate} onChange={e => setForm({ ...form, interestRate: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Monthly Payment</Label>
                <Input type="number" value={form.monthlyPayment} onChange={e => setForm({ ...form, monthlyPayment: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">Due Date</Label>
              <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-muted-gray">Cancel</Button>
            <Button onClick={handleSave} className="bg-primary-container text-white hover:brightness-110 shadow-vault">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
