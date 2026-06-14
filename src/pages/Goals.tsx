import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Target, PiggyBank } from 'lucide-react'
interface FormState { name: string; targetAmount: string; currentAmount: string; targetDate: string }

export default function Goals() {
  const { goals, addGoal, updateGoal, removeGoal } = useFinanceStore()
  const [open, setOpen] = useState(false); const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ name: '', targetAmount: '', currentAmount: '', targetDate: '' })

  function resetForm() { setForm({ name: '', targetAmount: '', currentAmount: '', targetDate: '' }); setEditId(null) }
  function handleOpen(entry?: typeof goals[0]) {
    if (entry) { setEditId(entry.id); setForm({ name: entry.name, targetAmount: String(entry.targetAmount), currentAmount: String(entry.currentAmount), targetDate: entry.targetDate }) }
    else { resetForm() }
    setOpen(true)
  }
  function handleSave() {
    if (!form.name || !form.targetAmount) return
    const data = { name: form.name, targetAmount: Number(form.targetAmount), currentAmount: Number(form.currentAmount) || 0, targetDate: form.targetDate }
    if (editId) { updateGoal(editId, data) } else { addGoal(data as any) }
    resetForm(); setOpen(false)
  }

  function monthsToTarget(dateStr: string) {
    if (!dateStr) return null
    const target = new Date(dateStr); const now = new Date()
    return Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()))
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Savings Goals</h1>
          <p className="text-sm text-muted-gray">Track your savings objectives</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-tertiary-container text-white hover:brightness-110 shadow-vault">
          <Plus className="size-4" /> Add Goal
        </Button>
      </header>

      {goals.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <Target className="size-8" />
            <p>No goals set yet</p>
            <Button variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface">Create a goal</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const progress = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0
            const remaining = g.targetAmount - g.currentAmount
            const months = monthsToTarget(g.targetDate)
            const monthlyNeeded = months && months > 0 ? remaining / months : remaining
            return (
              <div key={g.id} className="bg-surface rounded-xl shadow-vault p-5 flex flex-col gap-3 group hover:bg-surface-container-low transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-lg bg-surface-container-high flex items-center justify-center shadow-vault-sm">
                      <PiggyBank className="size-5 text-tertiary-container" />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-medium text-on-surface">{g.name}</h3>
                      <p className="text-xs text-muted-gray">Target: ${g.targetAmount.toLocaleString()}{g.targetDate ? ` by ${g.targetDate}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 text-muted-gray hover:text-primary" onClick={() => handleOpen(g)}><Pencil className="size-4" /></button>
                    <button className="p-1.5 text-muted-gray hover:text-error" onClick={() => removeGoal(g.id)}><Trash2 className="size-4" /></button>
                  </div>
                </div>
                <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden shadow-vault-sm">
                  <div className="h-full bg-success rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-gray">${g.currentAmount.toLocaleString()} saved</span>
                  <span className="text-on-surface font-medium">{Math.round(progress)}%</span>
                </div>
                {monthlyNeeded > 0 && (
                  <p className="text-xs text-muted-gray">Need ${Math.round(monthlyNeeded).toLocaleString()}/mo</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface border-graphite">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Edit Goal' : 'Add Goal'}</DialogTitle>
            <DialogDescription>Define your savings goal</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Goal Name</Label>
              <Input placeholder="Emergency Fund" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-medium-gray">Target Amount</Label>
                <Input type="number" value={form.targetAmount} onChange={e => setForm({ ...form, targetAmount: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Current Amount</Label>
                <Input type="number" value={form.currentAmount} onChange={e => setForm({ ...form, currentAmount: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">Target Date</Label>
              <Input type="date" value={form.targetDate} onChange={e => setForm({ ...form, targetDate: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
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
