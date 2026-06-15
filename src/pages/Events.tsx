import { useState } from 'react'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { DatePickerField } from '@/components/ui/date-picker-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Calendar, Wallet, CalendarDays, Timer } from 'lucide-react'

interface FormState {
  name: string
  date: string
  amount: string
  isNotification: boolean
}

export default function Events() {
  const { events, addEvent, updateEvent, removeEvent } = useFinanceStore()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ name: '', date: '', amount: '', isNotification: false })

  function resetForm() {
    setForm({ name: '', date: '', amount: '', isNotification: false })
    setEditId(null)
  }

  function handleOpen(entry?: typeof events[number]) {
    if (entry) {
      setEditId(entry.id)
      setForm({
        name: entry.name,
        date: entry.date,
        amount: String(entry.amount),
        isNotification: entry.isNotification,
      })
    } else {
      resetForm()
    }
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.date) return
    const data = {
      name: form.name,
      date: form.date,
      amount: Number(form.amount) || 0,
      isNotification: form.isNotification,
    }
    if (editId) {
      await updateEvent(editId, data)
    } else {
      await addEvent(data)
    }
    resetForm()
    setOpen(false)
  }

  const sortedEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const totalReserved = sortedEvents.reduce((sum, event) => sum + event.amount, 0)
  const notificationCount = sortedEvents.filter((event) => event.isNotification).length
  const nearestEvent = sortedEvents.find((event) => new Date(event.date).getTime() >= new Date().setHours(0, 0, 0, 0)) ?? sortedEvents[0]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Eventos</h1>
          <p className="text-sm text-muted-gray">Planifica montos, fechas y si quieres marcar el evento como notificación.</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-surface text-on-surface hover:bg-surface-container-high shadow-vault border border-graphite">
          <Plus className="size-4" /> Nuevo evento
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface rounded-xl p-5 shadow-vault flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between text-muted-gray mb-2">
            <span className="text-base font-medium">Monto Total</span>
            <Wallet className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">${totalReserved.toLocaleString()}</div>
        </div>
        <div className="bg-surface rounded-xl p-5 shadow-vault flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between text-muted-gray mb-2">
            <span className="text-base font-medium">Eventos con aviso</span>
            <CalendarDays className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">{notificationCount}</div>
        </div>
        <div className="bg-surface rounded-xl p-5 shadow-vault flex flex-col justify-between min-h-[120px] relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-primary-container opacity-10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
          <div className="flex items-center justify-between text-muted-gray mb-2 relative z-10">
            <span className="text-base font-medium">Próximo evento</span>
            <Timer className="size-5 text-warning" />
          </div>
          <div className="relative z-10">
            <div className="text-lg font-semibold text-on-surface truncate">{nearestEvent?.name ?? 'N/A'}</div>
            <div className="text-xs text-muted-gray mt-1">{nearestEvent ? new Date(nearestEvent.date).toLocaleDateString() : 'Sin agenda'}</div>
          </div>
        </div>
      </div>

      {sortedEvents.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <Calendar className="size-8" />
            <p>Sin eventos planeados</p>
            <Button variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface">Planificar un evento</Button>
          </div>
        </Card>
      ) : (
        <div className="bg-surface rounded-xl shadow-vault overflow-hidden">
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_0.5fr] gap-4 p-4 border-b border-graphite bg-surface-container-lowest text-xs text-muted-gray uppercase tracking-wider font-semibold">
            <span>Evento</span>
            <span>Fecha</span>
            <span className="text-right">Monto</span>
            <span className="text-center">Notificación</span>
            <span className="text-right">Acciones</span>
          </div>
          <div className="divide-y divide-graphite">
            {sortedEvents.map((event) => (
              <div key={event.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_0.5fr] gap-3 md:gap-4 p-4 hover:bg-surface-container-low transition-colors items-center group">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-surface-bright flex items-center justify-center border border-graphite shadow-vault-sm">
                    <CalendarDays className="size-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-on-surface">{event.name}</h3>
                    <p className="text-xs text-muted-gray md:hidden">{event.date}</p>
                  </div>
                </div>
                <div className="hidden md:block text-sm text-muted-gray">{event.date}</div>
                <div className="text-sm text-on-surface md:text-right">${event.amount.toLocaleString()}</div>
                <div className="text-sm text-center">
                  <Badge variant="secondary" className={event.isNotification ? 'bg-primary/15 text-primary' : 'bg-surface-container-high text-muted-gray'}>
                    {event.isNotification ? 'Sí' : 'No'}
                  </Badge>
                </div>
                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpen(event)}>
                    <Pencil data-icon="inline-start" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => void removeEvent(event.id)}>
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
            <DialogTitle className="text-on-surface">{editId ? 'Editar evento' : 'Agregar evento'}</DialogTitle>
            <DialogDescription>Esta pantalla usa solo `nombre`, `cantidad`, `fecha` e `isNotificacion`.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Nombre del evento</Label>
              <Input placeholder="Vacaciones" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <DatePickerField
                  label="Fecha"
                  value={form.date}
                  onChange={(value) => setForm({ ...form, date: value })}
                  description="Selecciona el dia del evento o compromiso futuro."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Monto</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="bg-abyss border-graphite text-on-surface" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-medium-gray">Notificación</Label>
              <Select value={form.isNotification ? 'yes' : 'no'} onValueChange={(value) => setForm({ ...form, isNotification: value === 'yes' })}>
                <SelectTrigger className="bg-abyss border-graphite text-on-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface border-graphite">
                  <SelectItem value="yes">Con notificación</SelectItem>
                  <SelectItem value="no">Sin notificación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-muted-gray">Cancelar</Button>
            <Button onClick={() => void handleSave()} className="bg-primary-container text-white hover:brightness-110 shadow-vault">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
