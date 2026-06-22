import { useMemo, useState } from 'react'
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Timer, Trash2, Wallet } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DatePickerField } from '@/components/ui/date-picker-field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'
import { useFinanceStore } from '@/store/financeStore'

interface FormState {
  name: string
  date: string
  amount: string
  isNotification: boolean
}

const MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WEEKDAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

function parseMoneyInput(value: string) {
  const normalized = value.replace(/\s+/g, '').replace(/,/g, '')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function buildMonthMatrix(visibleMonth: Date) {
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const startDate = new Date(firstDay)
  startDate.setDate(firstDay.getDate() - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    return date
  })
}

export default function Events() {
  const events = useFinanceStore((state) => state.events)
  const addEvent = useFinanceStore((state) => state.addEvent)
  const updateEvent = useFinanceStore((state) => state.updateEvent)
  const removeEvent = useFinanceStore((state) => state.removeEvent)
  const overview = useMonthlyOverview()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar')
  const [form, setForm] = useState<FormState>({ name: '', date: '', amount: '', isNotification: false })

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events]
  )

  const totalReserved = sortedEvents.reduce((sum, event) => sum + event.amount, 0)
  const notificationCount = sortedEvents.filter((event) => event.isNotification).length
  const nearestEvent = sortedEvents.find((event) => new Date(event.date).getTime() >= new Date().setHours(0, 0, 0, 0)) ?? sortedEvents[0]
  const eventsBudget = Math.max(0, overview.budgetWants - overview.totalWants)
  const availableForNewEvents = Math.max(0, eventsBudget - totalReserved)
  const editingEventAmount = editId ? sortedEvents.find((event) => event.id === editId)?.amount ?? 0 : 0
  const availableForCurrentForm = editId ? availableForNewEvents + editingEventAmount : availableForNewEvents
  const typedAmount = parseMoneyInput(form.amount)
  const exceedsBudget = typedAmount > availableForCurrentForm

  const eventMap = useMemo(() => {
    return sortedEvents.reduce<Record<string, typeof sortedEvents>>((accumulator, event) => {
      const key = event.date
      const current = accumulator[key] ?? []
      current.push(event)
      accumulator[key] = current
      return accumulator
    }, {})
  }, [sortedEvents])

  const monthMatrix = useMemo(() => buildMonthMatrix(calendarMonth), [calendarMonth])

  function resetForm() {
    setForm({ name: '', date: '', amount: '', isNotification: false })
    setEditId(null)
    setFormError(null)
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

    setFormError(null)
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.date) return

    if (typedAmount > availableForCurrentForm) {
      setFormError(`No puedes reservar $${typedAmount.toLocaleString()} porque solo te quedan $${availableForCurrentForm.toLocaleString()} para eventos.`)
      return
    }

    const data = {
      name: form.name.trim(),
      date: form.date,
      amount: typedAmount,
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-on-surface md:text-[36px]">Eventos</h1>
          <p className="text-sm text-muted-gray">
            Los eventos salen del dinero que todavia queda en `Gustos`: primero se resta lo ya gastado ahi y despues se reserva lo que planifiques aqui.
          </p>
        </div>
        <Button onClick={() => handleOpen()} className="border border-graphite bg-primary-container text-white shadow-vault hover:bg-primary-container/80">
          <Plus className="size-4" />
          Nuevo evento
        </Button>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="min-h-[132px] rounded-xl bg-surface p-5 shadow-vault">
          <div className="mb-2 flex items-center justify-between text-muted-gray">
            <span className="text-base font-medium">Presupuesto eventos</span>
            <Wallet className="size-5 text-primary" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">${eventsBudget.toLocaleString()}</div>
          <p className="mt-2 text-sm text-muted-gray">Sale de tu presupuesto de gustos menos lo que ya gastaste en gustos.</p>
        </div>

        <div className="min-h-[132px] rounded-xl bg-surface p-5 shadow-vault">
          <div className="mb-2 flex items-center justify-between text-muted-gray">
            <span className="text-base font-medium">Ya reservado</span>
            <CalendarDays className="size-5 text-warning" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">${totalReserved.toLocaleString()}</div>
          <p className="mt-2 text-sm text-muted-gray">Suma total de todos los eventos planeados este mes.</p>
        </div>

        <div className="min-h-[132px] rounded-xl bg-surface p-5 shadow-vault">
          <div className="mb-2 flex items-center justify-between text-muted-gray">
            <span className="text-base font-medium">Disponible ahora</span>
            <Wallet className="size-5 text-emerald-400" />
          </div>
          <div className="text-[28px] font-semibold text-on-surface">${availableForNewEvents.toLocaleString()}</div>
          <p className="mt-2 text-sm text-muted-gray">Lo que aun puedes apartar sin pasarte del dinero libre de gustos.</p>
        </div>

        <div className="relative min-h-[132px] overflow-hidden rounded-xl bg-surface p-5 shadow-vault">
          <div className="pointer-events-none absolute right-0 top-0 -mr-10 -mt-10 h-32 w-32 rounded-full bg-primary-container opacity-10 blur-2xl" />
          <div className="relative z-10 mb-2 flex items-center justify-between text-muted-gray">
            <span className="text-base font-medium">Proximo evento</span>
            <Timer className="size-5 text-warning" />
          </div>
          <div className="relative z-10">
            <div className="truncate text-lg font-semibold text-on-surface">{nearestEvent?.name ?? 'N/A'}</div>
            <div className="mt-1 text-xs text-muted-gray">{nearestEvent ? new Date(nearestEvent.date).toLocaleDateString() : 'Sin agenda'}</div>
            <div className="mt-3 text-xs text-muted-gray">{notificationCount} evento(s) con aviso activo.</div>
          </div>
        </div>
      </section>

      <Tabs
        value={viewMode}
        onValueChange={(value) => setViewMode(value as 'list' | 'calendar')}
        className="flex min-h-[860px] flex-col overflow-hidden rounded-2xl bg-surface shadow-vault"
      >
        <div className="sticky top-0 z-10  px-5 py-4 backdrop-blur">
          <TabsList className="grid w-full max-w-sm grid-cols-2 bg-abyss">
            <TabsTrigger value="calendar">Calendario</TabsTrigger>
            <TabsTrigger value="list">Lista</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 p-5">
          <TabsContent value="calendar" className="mt-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
            <div className="flex h-full flex-col rounded-2xl bg-surface">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Vista calendario</p>
                  <h2 className="mt-2 text-2xl font-semibold text-on-surface">
                    {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                  </h2>
                  <p className="mt-1 text-sm text-muted-gray">Pulsa un dia con eventos para ver cuanto dinero apartaste y si lleva notificacion.</p>
                </div>

                <div className="inline-flex items-center gap-1 rounded-xl border border-graphite bg-abyss p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-gray hover:text-on-surface"
                    onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <div className="min-w-36 text-center text-sm font-semibold text-on-surface">
                    {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-gray hover:text-on-surface"
                    onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-[0.18em] text-muted-gray">
                {WEEKDAY_LABELS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="mt-3 grid flex-1 grid-cols-7 gap-2">
                {monthMatrix.map((date) => {
                  const dateKey = toDateKey(date)
                  const dayEvents = eventMap[dateKey] ?? []
                  const isCurrentMonth = date.getMonth() === calendarMonth.getMonth()
                  const totalDayAmount = dayEvents.reduce((sum, event) => sum + event.amount, 0)

                  return (
                    <div
                      key={dateKey}
                      className={`min-h-28 rounded-2xl border p-3 transition-colors ${isCurrentMonth
                        ? 'border-graphite bg-abyss/80'
                        : 'border-transparent bg-abyss/35 text-muted-gray/55'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-sm font-medium ${isCurrentMonth ? 'text-on-surface' : 'text-muted-gray/60'}`}>
                          {date.getDate()}
                        </span>
                        {dayEvents.length > 0 ? (
                          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                            {dayEvents.length}
                          </Badge>
                        ) : null}
                      </div>

                      {dayEvents.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-medium text-on-surface">${totalDayAmount.toLocaleString()} reservados</p>
                          {dayEvents.slice(0, 2).map((event) => (
                            <div key={event.id} className="rounded-xl border border-graphite bg-surface px-2 py-1.5">
                              <p className="truncate text-xs font-medium text-on-surface">{event.name}</p>
                              <p className="mt-1 text-[11px] text-muted-gray">
                                ${event.amount.toLocaleString()} {event.isNotification ? '• con aviso' : '• sin aviso'}
                              </p>
                            </div>
                          ))}
                          {dayEvents.length > 2 ? (
                            <p className="text-[11px] text-muted-gray">+{dayEvents.length - 2} evento(s) mas</p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl border border-dashed border-graphite px-2 py-3 text-center text-[11px] text-muted-gray">
                          Libre
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="list" className="mt-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
            {sortedEvents.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl bg-surface px-6 py-16">
                <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-gray">
                  <Calendar className="size-8" />
                  <p>Sin eventos planeados</p>
                  <Button variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface hover:bg-surface-container-high/80">
                    Planificar un evento
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-hidden rounded-xl bg-surface shadow-vault">
                <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_0.5fr] gap-4 border-b border-graphite bg-surface-container-lowest p-4 text-xs font-semibold uppercase tracking-wider text-muted-gray md:grid">
                  <span>Evento</span>
                  <span>Fecha</span>
                  <span className="text-right">Monto</span>
                  <span className="text-center">Notificacion</span>
                  <span className="text-right">Acciones</span>
                </div>
                <div className="h-full divide-y divide-graphite overflow-auto">
                  {sortedEvents.map((event) => (
                    <div key={event.id} className="group grid grid-cols-1 items-center gap-3 p-4 transition-colors hover:bg-surface-container-low md:grid-cols-[2fr_1fr_1fr_1fr_0.5fr] md:gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg border border-graphite bg-surface-bright shadow-vault-sm">
                          <CalendarDays className="size-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-on-surface">{event.name}</h3>
                          <p className="text-xs text-muted-gray md:hidden">{event.date}</p>
                        </div>
                      </div>
                      <div className="hidden text-sm text-muted-gray md:block">{event.date}</div>
                      <div className="text-sm text-on-surface md:text-right">${event.amount.toLocaleString()}</div>
                      <div className="text-center text-sm">
                        <Badge variant="secondary" className={event.isNotification ? 'bg-primary/15 text-primary' : 'bg-surface-container-high text-muted-gray'}>
                          {event.isNotification ? 'Si' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex justify-end gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
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
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-graphite bg-surface sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar evento' : 'Agregar evento'}</DialogTitle>
            <DialogDescription>
              El monto del evento sale del presupuesto libre de `Gustos`. Si ya gastaste o reservaste de mas, aqui no te dejara pasarte.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-medium-gray">Nombre del evento</Label>
                <Input
                  placeholder="Vacaciones"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="border-graphite bg-abyss text-on-surface"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  <Input
                    type="number"
                    min="0"
                    value={form.amount}
                    onChange={(event) => {
                      setFormError(null)
                      setForm({ ...form, amount: event.target.value })
                    }}
                    className="border-graphite bg-abyss text-on-surface"
                  />
                  <p className="text-xs text-muted-gray">
                    Disponible para este formulario: ${availableForCurrentForm.toLocaleString()}
                  </p>
                  {exceedsBudget ? (
                    <p className="text-xs text-red-300">
                      Ese monto se pasa del presupuesto. Solo puedes reservar hasta ${availableForCurrentForm.toLocaleString()}.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-medium-gray">Notificacion</Label>
                <Select value={form.isNotification ? 'yes' : 'no'} onValueChange={(value) => setForm({ ...form, isNotification: value === 'yes' })}>
                  <SelectTrigger className="border-graphite bg-abyss text-on-surface">
                    <SelectValue>{form.isNotification ? 'Con notificacion' : 'Sin notificacion'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border-graphite bg-surface">
                    <SelectItem value="yes">Con notificacion</SelectItem>
                    <SelectItem value="no">Sin notificacion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Resumen del presupuesto</p>
                <div className="mt-4 space-y-3 text-sm text-muted-gray">
                  <div className="flex items-center justify-between">
                    <span>Tope de gustos</span>
                    <span className="font-medium text-on-surface">${overview.budgetWants.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Gastado en gustos</span>
                    <span className="font-medium text-on-surface">${overview.totalWants.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Reservado en eventos</span>
                    <span className="font-medium text-on-surface">${totalReserved.toLocaleString()}</span>
                  </div>
                  <div className="h-px bg-graphite" />
                  <div className="flex items-center justify-between">
                    <span>Disponible ahora</span>
                    <span className="text-base font-semibold text-on-surface">${availableForCurrentForm.toLocaleString()}</span>
                  </div>
                </div>
              </Card>

              <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Resumen del evento</p>
                <p className="mt-2 text-lg font-semibold text-on-surface">{form.name || 'Evento sin nombre'}</p>
                <p className="mt-1 text-sm text-muted-gray">
                  {form.date ? `Fecha seleccionada: ${form.date}` : 'Selecciona una fecha para ubicarlo en el calendario.'}
                </p>
                <p className="mt-1 text-sm text-muted-gray">
                  {form.amount ? `Reservara: $${typedAmount.toLocaleString()}` : 'Agrega un monto para reservar presupuesto.'}
                </p>
                {formError ? <p className="mt-2 text-sm text-red-300">{formError}</p> : null}
              </Card>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                resetForm()
                setOpen(false)
              }}
              className="text-muted-gray"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={exceedsBudget}
              className="bg-primary-container text-white shadow-vault hover:brightness-110"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
