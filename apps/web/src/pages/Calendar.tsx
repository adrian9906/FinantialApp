import { useMemo, useState, type FormEvent } from 'react'
import type { AppEvent } from '@plata/shared'
import { Cake, CalendarDays, ChevronLeft, ChevronRight, Plug, Plus, Repeat, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { getTodayDateKey } from '@/lib/date'
import { calendarDateKey, calendarMonthDays, eventsOn } from '@/lib/personal-calendar'
import { useFinanceStore } from '@/store/financeStore'

const categories = [
  { value: 'event', label: 'Evento', icon: CalendarDays, color: 'var(--color-primary, #a8c7fa)' },
  { value: 'birthday', label: 'Cumpleaños', icon: Cake, color: 'var(--color-warning, #f5cc73)' },
  { value: 'service', label: 'Servicio', icon: Plug, color: 'var(--color-success, #6dd8b1)' },
] as const
const repetitions = [{ value: 'none', label: 'No se repite' }, { value: 'monthly', label: 'Cada mes' }, { value: 'yearly', label: 'Cada año' }]
const dayLabel = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' })
const monthLabel = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' })
const localDate = (key: string) => new Date(`${key}T12:00:00`)
const emptyForm = (date: string) => ({ name: '', date, category: 'event' as NonNullable<AppEvent['category']>, recurrence: 'none' as NonNullable<AppEvent['recurrence']>, time: '', notes: '' })

export default function Calendar() {
  const allEvents = useFinanceStore(state => state.events)
  const addEvent = useFinanceStore(state => state.addEvent)
  const updateEvent = useFinanceStore(state => state.updateEvent)
  const removeEvent = useFinanceStore(state => state.removeEvent)
  const today = getTodayDateKey()
  const [selectedDay, setSelectedDay] = useState(today)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [view, setView] = useState('month')
  const [filter, setFilter] = useState<string>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AppEvent | null>(null)
  const [form, setForm] = useState(emptyForm(today))
  const [busy, setBusy] = useState(false)
  const events = useMemo(() => allEvents.filter(event => event.category && (filter === 'all' || event.category === filter)), [allEvents, filter])
  const days = useMemo(() => calendarMonthDays(month), [month])
  const eventMap = useMemo(() => Object.fromEntries(days.map(day => [day, eventsOn(events, day)])), [days, events])
  const agendaDays = days.filter(day => day.startsWith(month) && eventMap[day].length)
  const selectedEvents = eventsOn(events, selectedDay)

  function changeMonth(offset: number) {
    const date = localDate(`${month}-01`)
    date.setMonth(date.getMonth() + offset)
    const first = calendarDateKey(date)
    setMonth(first.slice(0, 7))
    setSelectedDay(first)
  }
  function create(day = selectedDay) {
    setEditing(null)
    setForm(emptyForm(day))
    setOpen(true)
  }
  function edit(event: AppEvent) {
    setEditing(event)
    setForm({ name: event.name, date: event.date, category: event.category ?? 'event', recurrence: event.recurrence ?? 'none', time: event.time ?? '', notes: event.notes ?? '' })
    setOpen(true)
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy || !form.name.trim() || !form.date) return
    setBusy(true)
    try {
      const data = { ...form, name: form.name.trim(), notes: form.notes.trim() || undefined, time: form.time || undefined, amount: 0, isNotification: false }
      if (editing) await updateEvent(editing.id, data)
      else await addEvent(data)
      setSelectedDay(form.date)
      setMonth(form.date.slice(0, 7))
      setOpen(false)
      toast.success(editing ? 'Cambios guardados' : 'Guardado en tu calendario')
    } catch { toast.error('No se pudo guardar. Vuelve a intentarlo.') }
    finally { setBusy(false) }
  }
  async function deleteEvent() {
    if (!editing || busy) return
    setBusy(true)
    try { await removeEvent(editing.id); setOpen(false); toast.success('Eliminado del calendario') }
    catch { toast.error('No se pudo eliminar. Vuelve a intentarlo.') }
    finally { setBusy(false) }
  }
  function entries(day: string) {
    return eventsOn(events, day).map(event => {
      const category = categories.find(item => item.value === event.category) ?? categories[0]
      const Icon = category.icon
      return <button key={event.id} type="button" onClick={() => edit(event)} className="flex w-full items-start gap-3 rounded-xl border border-graphite p-4 text-left transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary" aria-label={`Editar ${event.name}`}>
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full" style={{ color: category.color, backgroundColor: `color-mix(in srgb, ${category.color} 12%, transparent)` }}><Icon className="size-4" /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="break-words font-medium">{event.name}</span><span className="flex flex-wrap items-center gap-2 text-xs text-muted-gray">{category.label} · {event.time || 'Todo el día'}{event.recurrence && event.recurrence !== 'none' && <><Repeat className="size-3" />{event.recurrence === 'yearly' ? 'Cada año' : 'Cada mes'}</>}</span>{event.notes && <span className="whitespace-pre-wrap break-words text-sm text-muted-gray">{event.notes}</span>}</span>
      </button>
    })
  }

  return <div className="flex min-w-0 flex-col gap-5">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-gray">Tu agenda personal</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Calendario</h1><p className="mt-2 text-sm text-muted-gray">Eventos, cumpleaños y fechas de pago en un solo lugar.</p></div>
      <Button onClick={() => create()}><Plus data-icon="inline-start" />Crear</Button>
    </header>
    <section className="overflow-hidden rounded-2xl border border-graphite bg-surface shadow-vault">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-graphite p-3 sm:p-5">
        <div className="flex items-center gap-1"><Button variant="outline" size="sm" onClick={() => { setSelectedDay(today); setMonth(today.slice(0, 7)) }}>Hoy</Button><Button variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => changeMonth(-1)}><ChevronLeft /></Button><Button variant="ghost" size="icon" aria-label="Mes siguiente" onClick={() => changeMonth(1)}><ChevronRight /></Button><h2 aria-live="polite" className="ml-1 text-sm font-semibold capitalize sm:text-xl">{monthLabel.format(localDate(`${month}-01`))}</h2></div>
        <Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="month">Mes</TabsTrigger><TabsTrigger value="agenda">Agenda</TabsTrigger></TabsList></Tabs>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-graphite px-4 py-3">
        <Select value={filter} onValueChange={value => setFilter(value ?? 'all')} items={[{ value: 'all', label: 'Todos' }, ...categories]}><SelectTrigger aria-label="Mostrar categorías"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">Todos</SelectItem>{categories.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select>
        {categories.map(item => <span key={item.value} className="flex items-center gap-1.5 text-xs text-muted-gray"><span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}
      </div>
      {view === 'month' ? <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 p-2 sm:p-4">
          <div className="grid grid-cols-7 text-center text-xs text-muted-gray">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => <span className="py-3" key={day}>{day}</span>)}</div>
          <div className="grid grid-cols-7 overflow-hidden rounded-xl border-l border-t border-graphite">
            {days.map(day => <button key={day} type="button" aria-label={dayLabel.format(localDate(day))} aria-pressed={selectedDay === day} onClick={() => { setSelectedDay(day); if (!day.startsWith(month)) setMonth(day.slice(0, 7)) }} className={cn('flex min-h-[76px] min-w-0 flex-col items-center gap-1 border-b border-r border-graphite p-1 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary sm:min-h-[110px] sm:items-start sm:p-2', selectedDay === day && 'bg-primary/10', !day.startsWith(month) && 'text-muted-gray')}>
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium', day === today && 'bg-primary text-primary-foreground', selectedDay === day && day !== today && 'ring-1 ring-primary')}>{Number(day.slice(-2))}</span>
              <span className="flex flex-wrap justify-center gap-1 sm:hidden">{eventMap[day].slice(0, 3).map(event => <span className="size-1.5 rounded-full" key={event.id} style={{ backgroundColor: categories.find(item => item.value === event.category)?.color }} />)}</span>
              <span className="hidden w-full flex-col gap-1 sm:flex">{eventMap[day].slice(0, 2).map(event => <span key={event.id} className="block truncate rounded px-1 py-0.5 text-[10px] font-medium" style={{ color: categories.find(item => item.value === event.category)?.color, backgroundColor: `color-mix(in srgb, ${categories.find(item => item.value === event.category)?.color} 12%, transparent)` }}>{event.time && `${event.time} `}{event.name}</span>)}</span>
              {eventMap[day].length > 2 && <span className="text-[9px] text-muted-gray">+{eventMap[day].length - 2}</span>}
            </button>)}
          </div>
        </div>
        <aside className="flex min-w-0 flex-col gap-4 border-t border-graphite p-4 lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-gray">Agenda del día</p><h3 className="mt-1 font-semibold capitalize">{dayLabel.format(localDate(selectedDay))}</h3></div><Button size="icon" variant="ghost" aria-label="Crear en este día" onClick={() => create()}><Plus /></Button></div>
          {selectedEvents.length ? entries(selectedDay) : <div className="flex flex-col gap-3 py-8 text-center text-sm text-muted-gray"><CalendarDays className="mx-auto size-8 opacity-50" /><p>Este día está libre.</p><Button variant="outline" onClick={() => create()}>Agregar una fecha</Button></div>}
        </aside>
      </div> : <div className="flex flex-col gap-6 p-4 sm:p-6">{agendaDays.length ? agendaDays.map(day => <section className="flex flex-col gap-3" key={day}><h3 className="text-sm font-medium capitalize text-muted-gray">{dayLabel.format(localDate(day))}</h3>{entries(day)}</section>) : <p className="py-10 text-center text-muted-gray">No hay fechas guardadas para este mes.</p>}</div>}
    </section>
    <p className="text-xs text-muted-gray">Guardar una fecha no registra un gasto. Los pagos se registran en Gastos cuando los realices.</p>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value) }}><DialogContent><DialogHeader><DialogTitle>{editing ? 'Editar fecha' : 'Nueva fecha'}</DialogTitle><DialogDescription>{editing?.recurrence && editing.recurrence !== 'none' ? 'Los cambios se aplican a toda la repetición.' : 'Organiza lo que viene en tu calendario.'}</DialogDescription></DialogHeader>
      <form onSubmit={save} className="flex min-w-0 flex-col gap-5">
        <FieldGroup>
          <Field><FieldLabel htmlFor="calendar-name">Título</FieldLabel><Input id="calendar-name" required maxLength={200} autoFocus placeholder="Cumpleaños de Ana, pago de internet…" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field><FieldLabel htmlFor="calendar-category">Tipo</FieldLabel><Select value={form.category} items={[...categories]} onValueChange={value => { if (value) setForm({ ...form, category: value as typeof form.category, recurrence: value === 'birthday' ? 'yearly' : value === 'service' ? 'monthly' : 'none' }) }}><SelectTrigger id="calendar-category" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{categories.map(item => <SelectItem value={item.value} key={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
          <Field><FieldLabel htmlFor="calendar-date">Fecha de inicio</FieldLabel><Input id="calendar-date" type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
          <Field><FieldLabel htmlFor="calendar-time">Hora (opcional)</FieldLabel><Input id="calendar-time" type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></Field>
          <Field><FieldLabel htmlFor="calendar-repeat">Repetición</FieldLabel><Select value={form.recurrence} items={repetitions} onValueChange={value => { if (value) setForm({ ...form, recurrence: value as typeof form.recurrence }) }}><SelectTrigger id="calendar-repeat" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{repetitions.map(item => <SelectItem value={item.value} key={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
          <Field><FieldLabel htmlFor="calendar-notes">Notas (opcional)</FieldLabel><Textarea id="calendar-notes" maxLength={10000} placeholder="Lugar, número de contrato o detalles…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
        </FieldGroup>
        <DialogFooter>{editing && <Button type="button" variant="destructive" disabled={busy} onClick={deleteEvent}><Trash2 data-icon="inline-start" />Eliminar{editing.recurrence && editing.recurrence !== 'none' ? ' serie' : ''}</Button>}<Button type="submit" disabled={busy || !form.name.trim()}>{busy ? 'Guardando…' : 'Guardar'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </div>
}
