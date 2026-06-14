import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, Bell, BellOff, Calendar } from 'lucide-react'

interface FormState { title: string; description: string; date: string }

export default function Reminders() {
  const { reminders, addReminder, toggleReminder, removeReminder } = useFinanceStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>({ title: '', description: '', date: '' })

  function handleSave() {
    if (!form.title || !form.date) return
    addReminder({ id: '', title: form.title, description: form.description, date: form.date, completed: false })
    setForm({ title: '', description: '', date: '' }); setOpen(false)
  }

  const activeReminders = reminders.filter((r) => !r.completed)
  const completedReminders = reminders.filter((r) => r.completed)

  function getBorderClass(date: string) {
    const diff = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return 'border-l-error'
    if (diff <= 3) return 'border-l-warning'
    return 'border-l-primary'
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Reminders</h1>
          <p className="text-sm text-muted-gray">Never miss a bill or financial task</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-surface text-on-surface hover:bg-surface-container-high shadow-vault border border-graphite">
          <Plus className="size-4" /> Add Reminder
        </Button>
      </header>

      {reminders.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <Bell className="size-8" />
            <p>No reminders set</p>
            <Button variant="secondary" onClick={() => setOpen(true)} className="bg-surface-container-high text-on-surface">Create a reminder</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-xs text-muted-gray uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary inline-block" />
              Active ({activeReminders.length})
            </h2>
            <div className="space-y-2">
              {activeReminders.map((r) => {
                const diff = Math.ceil((new Date(r.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                const isOverdue = diff < 0
                const isClose = diff >= 0 && diff <= 3
                return (
                  <div key={r.id} className={`bg-surface rounded-xl shadow-vault p-4 flex items-start justify-between gap-4 border-l-2 transition-all hover:bg-surface-container-low group ${getBorderClass(r.date)}`}>
                    <div className="min-w-0 flex-1">
                      <h3 className={`text-sm font-medium text-on-surface ${isOverdue ? 'text-error' : ''}`}>{r.title}</h3>
                      {r.description && <p className="text-xs text-muted-gray mt-0.5">{r.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-error' : isClose ? 'text-warning' : 'text-muted-gray'}`}>
                          <Calendar className="size-3" />
                          {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {isOverdue && <span className="text-error">(Overdue)</span>}
                          {isClose && !isOverdue && <span className="text-warning">(Soon)</span>}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-muted-gray hover:text-primary transition-colors" onClick={() => toggleReminder(r.id)}>
                        <BellOff className="size-4" />
                      </button>
                      <button className="p-1.5 text-muted-gray hover:text-error transition-colors" onClick={() => removeReminder(r.id)}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {completedReminders.length > 0 && (
            <div>
              <h2 className="text-xs text-muted-gray uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-graphite inline-block" />
                Completed ({completedReminders.length})
              </h2>
              <div className="space-y-2">
                {completedReminders.map((r) => (
                  <div key={r.id} className="bg-abyss rounded-xl border border-graphite p-4 flex items-start justify-between gap-4 opacity-60 group">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-on-surface line-through">{r.title}</h3>
                      {r.description && <p className="text-xs text-muted-gray mt-0.5 line-through">{r.description}</p>}
                      <span className="text-xs text-muted-gray flex items-center gap-1 mt-1.5">
                        <Calendar className="size-3" />
                        {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-muted-gray hover:text-primary transition-colors" onClick={() => toggleReminder(r.id)}>
                        <Bell className="size-4" />
                      </button>
                      <button className="p-1.5 text-muted-gray hover:text-error transition-colors" onClick={() => removeReminder(r.id)}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface border-graphite">
          <DialogHeader>
            <DialogTitle className="text-on-surface">Add Reminder</DialogTitle>
            <DialogDescription>Set a financial reminder</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Title</Label>
              <Input placeholder="Pay electricity bill" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">Description (optional)</Label>
              <Textarea placeholder="Due on the 15th" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
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
