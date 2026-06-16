import { useState, useEffect } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { DatePickerField } from '@/components/ui/date-picker-field'
import { Plus, Trash2, Bell, BellOff, Calendar, Pencil } from 'lucide-react'

interface FormState { title: string; description: string; date: string }

const DAY_IN_MS = 1000 * 60 * 60 * 24

function getStartOfTodayMs() {
  const current = new Date()
  current.setHours(0, 0, 0, 0)
  return current.getTime()
}

export default function Reminders() {
  const reminders = useFinanceStore((state) => state.reminders)
  const addReminder = useFinanceStore((state) => state.addReminder)
  const updateReminder = useFinanceStore((state) => state.updateReminder)
  const toggleReminder = useFinanceStore((state) => state.toggleReminder)
  const removeReminder = useFinanceStore((state) => state.removeReminder)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ title: '', description: '', date: '' })

  function resetForm() {
    setForm({ title: '', description: '', date: '' })
    setEditId(null)
  }

  function handleOpen(entry?: (typeof reminders)[number]) {
    if (entry) {
      setEditId(entry.id)
      setForm({ title: entry.title, description: entry.description, date: entry.date })
    } else {
      resetForm()
    }
    setOpen(true)
  }

  function handleSave() {
    if (!form.title || !form.date) return
    const data = { title: form.title, description: form.description, date: form.date }
    if (editId) {
      void updateReminder(editId, data)
    } else {
      void addReminder({ ...data, completed: false })
    }
    resetForm(); setOpen(false)
  }

  const activeReminders = reminders.filter((r) => !r.completed)
  const completedReminders = reminders.filter((r) => r.completed)

  const [todayMs, setTodayMs] = useState<number | null>(null)

  useEffect(() => {
    const todayFunc = () => {
      setTodayMs(getStartOfTodayMs())
      const id = setInterval(() => setTodayMs(getStartOfTodayMs()), 60_000)
      return () => clearInterval(id)
    }
    todayFunc()
  }, [])

  function getReminderDiff(date: string) {
    const dateMs = Date.parse(date)
    if (todayMs === null) return null
    return Math.ceil((dateMs - todayMs) / DAY_IN_MS)
  }

  function getBorderClass(date: string) {
    const diff = getReminderDiff(date)
    if (diff === null) return 'border-l-primary'
    if (diff < 0) return 'border-l-error'
    if (diff <= 3) return 'border-l-warning'
    return 'border-l-primary'
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Recordatorios</h1>
          <p className="text-sm text-muted-gray">Nunca pierdas una factura o tarea financiera</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-primary-container text-on-surface hover:bg-primary-container/80 shadow-vault border border-graphite">
          <Plus className="size-4" /> Agregar Recordatorio
        </Button>
      </header>

      {reminders.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <Bell className="size-8" />
            <p>Sin recordatorios</p>
            <Button variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface hover:bg-surface-container-high/80">
              Crear un recordatorio
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-xs text-muted-gray uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary inline-block" />
              Activos ({activeReminders.length})
            </h2>
            <div className="space-y-2">
              {activeReminders.map((r) => {
                const diff = getReminderDiff(r.date) ?? 0
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
                          {isOverdue && <span className="text-error">(Vencido)</span>}
                          {isClose && !isOverdue && <span className="text-warning">(Pronto)</span>}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpen(r)}>
                        <Pencil data-icon="inline-start" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => toggleReminder(r.id)}>
                        <BellOff data-icon="inline-start" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => removeReminder(r.id)}>
                        <Trash2 data-icon="inline-start" />
                      </Button>
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
                Completados ({completedReminders.length})
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
                      <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpen(r)}>
                        <Pencil data-icon="inline-start" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => toggleReminder(r.id)}>
                        <Bell data-icon="inline-start" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => removeReminder(r.id)}>
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-graphite bg-surface sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar Recordatorio' : 'Agregar Recordatorio'}</DialogTitle>
            <DialogDescription>{editId ? 'Actualiza este recordatorio financiero' : 'Configurar un recordatorio financiero'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Título</Label>
              <Input placeholder="Pagar recibo de luz" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">Descripción (opcional)</Label>
              <Textarea placeholder="Vence el día 15" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <DatePickerField
              label="Fecha"
              value={form.date}
              onChange={(value) => setForm({ ...form, date: value })}
              description="Selecciona cuando debe activarse o vencer este recordatorio."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { resetForm(); setOpen(false) }} className="text-muted-gray">Cancelar</Button>
            <Button onClick={handleSave} className="bg-primary-container text-white hover:brightness-110 shadow-vault">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
