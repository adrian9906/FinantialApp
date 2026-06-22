import { useMemo, useState } from 'react'
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Timer, Trash2, Wallet } from 'lucide-react-native'
import { Pressable, View } from 'react-native'

import { AppFrame } from '../../src/components/app-frame'
import { Button } from '../../src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../src/components/ui/card'
import { Dialog } from '../../src/components/ui/dialog'
import { Input } from '../../src/components/ui/input'
import { Text } from '../../src/components/ui/text'
import { useFinanceStore } from '../../src/store/finance-store'
import { usePreferencesStore } from '../../src/store/preferences-store'
import { resolvePalette } from '../../src/theme/palette'
import { radius, spacing } from '../../src/theme/tokens'
import { getMonthlyOverview } from '@plata/shared'

const MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WEEKDAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const CalendarIcon = Calendar as any
const CalendarDaysIcon = CalendarDays as any
const ChevronLeftIcon = ChevronLeft as any
const ChevronRightIcon = ChevronRight as any
const PencilIcon = Pencil as any
const PlusIcon = Plus as any
const TimerIcon = Timer as any
const Trash2Icon = Trash2 as any
const WalletIcon = Wallet as any

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

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export default function EventsScreen() {
  const events = useFinanceStore((state) => state.events)
  const transactions = useFinanceStore((state) => state.transactions)
  const salaries = useFinanceStore((state) => state.salaries)
  const addEvent = useFinanceStore((state) => state.addEvent)
  const updateEvent = useFinanceStore((state) => state.updateEvent)
  const removeEvent = useFinanceStore((state) => state.removeEvent)
  const formula = usePreferencesStore((state) => state.formula)
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar')
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', date: '', amount: '', isNotification: false })

  const overview = getMonthlyOverview(salaries, transactions, formula)
  const sortedEvents = useMemo(() => [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [events])
  const totalReserved = sortedEvents.reduce((sum, event) => sum + event.amount, 0)
  const notificationCount = sortedEvents.filter((event) => event.isNotification).length
  const nearestEvent = sortedEvents.find((event) => new Date(event.date).getTime() >= new Date().setHours(0, 0, 0, 0)) ?? sortedEvents[0]
  const eventsBudget = Math.max(0, overview.budgetWants - overview.totalWants)
  const availableForNewEvents = Math.max(0, eventsBudget - totalReserved)
  const editingEventAmount = editId ? sortedEvents.find((event) => event.id === editId)?.amount ?? 0 : 0
  const availableForCurrentForm = editId ? availableForNewEvents + editingEventAmount : availableForNewEvents
  const typedAmount = parseMoneyInput(form.amount)
  const exceedsBudget = typedAmount > availableForCurrentForm

  const eventMap = useMemo(() => sortedEvents.reduce<Record<string, typeof sortedEvents>>((acc, event) => {
    const key = event.date
    const current = acc[key] ?? []
    current.push(event)
    acc[key] = current
    return acc
  }, {}), [sortedEvents])
  const monthMatrix = useMemo(() => buildMonthMatrix(calendarMonth), [calendarMonth])

  function resetForm() {
    setForm({ name: '', date: '', amount: '', isNotification: false })
    setEditId(null)
    setFormError(null)
    setOpen(false)
  }

  function handleOpen(entry?: (typeof events)[number]) {
    if (entry) {
      setEditId(entry.id)
      setForm({ name: entry.name, date: entry.date, amount: String(entry.amount), isNotification: entry.isNotification })
      setOpen(true)
      return
    }
    setForm({ name: '', date: '', amount: '', isNotification: false })
    setEditId(null)
    setFormError(null)
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.date) return
    if (typedAmount > availableForCurrentForm) {
      setFormError(`No puedes reservar ${formatMoney(typedAmount)} porque solo te quedan ${formatMoney(availableForCurrentForm)} para eventos.`)
      return
    }
    const payload = { name: form.name.trim(), date: form.date, amount: typedAmount, isNotification: form.isNotification }
    if (editId) await updateEvent(editId, payload)
    else await addEvent(payload)
    resetForm()
  }

  return (
    <AppFrame
      title="Eventos"
      subtitle="Los eventos salen del dinero libre de Gustos y pueden verse como calendario o lista."
      actions={
        <Button variant="outline" className="self-start" onPress={() => handleOpen()}>
          <PlusIcon size={16} color={palette.text} />
          <Text>Nuevo evento</Text>
        </Button>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {[
          { label: 'Presupuesto eventos', value: formatMoney(eventsBudget), icon: WalletIcon, color: palette.primary },
          { label: 'Ya reservado', value: formatMoney(totalReserved), icon: CalendarDaysIcon, color: palette.warning },
          { label: 'Disponible ahora', value: formatMoney(availableForNewEvents), icon: WalletIcon, color: palette.success },
          { label: 'Proximo evento', value: nearestEvent?.name ?? 'N/A', icon: TimerIcon, color: '#f97316', helper: nearestEvent ? nearestEvent.date : `${notificationCount} con aviso` },
        ].map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label} className="min-w-[220px] flex-1">
              <CardContent className="pt-6">
                <View style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: palette.textMuted }}>{card.label}</Text>
                    <Icon size={18} color={card.color} />
                  </View>
                  <Text style={{ color: palette.text, fontSize: 24, fontWeight: '800' }}>{card.value}</Text>
                  {card.helper ? <Text style={{ color: palette.textMuted, fontSize: 12 }}>{card.helper}</Text> : null}
                </View>
              </CardContent>
            </Card>
          )
        })}
      </View>

      <Card>
        <CardHeader>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' }}>
            <View>
              <CardTitle>Vista</CardTitle>
              <CardDescription>Cambia entre calendario y lista.</CardDescription>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button variant={viewMode === 'calendar' ? 'default' : 'outline'} onPress={() => setViewMode('calendar')}><Text>Calendario</Text></Button>
              <Button variant={viewMode === 'list' ? 'default' : 'outline'} onPress={() => setViewMode('list')}><Text>Lista</Text></Button>
            </View>
          </View>
        </CardHeader>
        <CardContent className="gap-4">
          {viewMode === 'calendar' ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Pressable onPress={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
                  <ChevronLeftIcon size={18} color={palette.textMuted} />
                </Pressable>
                <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>
                  {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                </Text>
                <Pressable onPress={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                  <ChevronRightIcon size={18} color={palette.textMuted} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {WEEKDAY_LABELS.map((day) => (
                  <View key={day} style={{ width: '13%', minWidth: 42 }}>
                    <Text style={{ color: palette.textMuted, fontSize: 11, textAlign: 'center' }}>{day}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {monthMatrix.map((date) => {
                  const dateKey = toDateKey(date)
                  const dayEvents = eventMap[dateKey] ?? []
                  const isCurrentMonth = date.getMonth() === calendarMonth.getMonth()
                  const totalDayAmount = dayEvents.reduce((sum, event) => sum + event.amount, 0)
                  return (
                    <View key={dateKey} style={{ width: '13%', minWidth: 42, minHeight: 82, borderRadius: radius.md, borderWidth: 1, borderColor: isCurrentMonth ? palette.border : 'transparent', backgroundColor: isCurrentMonth ? palette.backgroundAlt : palette.surfaceMuted, padding: 6 }}>
                      <Text style={{ color: isCurrentMonth ? palette.text : palette.textMuted, fontSize: 11, fontWeight: '700' }}>{date.getDate()}</Text>
                      {dayEvents.length > 0 ? (
                        <>
                          <Text style={{ color: palette.primary, fontSize: 10, marginTop: 6 }}>{dayEvents.length} ev.</Text>
                          <Text style={{ color: palette.textMuted, fontSize: 9 }}>{formatMoney(totalDayAmount)}</Text>
                        </>
                      ) : (
                        <Text style={{ color: palette.textMuted, fontSize: 9, marginTop: 8 }}>Libre</Text>
                      )}
                    </View>
                  )
                })}
              </View>
            </>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {sortedEvents.length === 0 ? (
                <Text style={{ color: palette.textMuted, textAlign: 'center', paddingVertical: spacing.xl }}>Sin eventos planeados</Text>
              ) : sortedEvents.map((event) => (
                <View key={event.id} style={{ borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.backgroundAlt, padding: spacing.md, gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>{event.name}</Text>
                      <Text style={{ color: palette.textMuted, fontSize: 12 }}>{event.date}</Text>
                    </View>
                    <Text style={{ color: palette.text, fontWeight: '700' }}>{formatMoney(event.amount)}</Text>
                  </View>
                  <Text style={{ color: event.isNotification ? palette.primary : palette.textMuted, fontSize: 12 }}>
                    {event.isNotification ? 'Con notificacion' : 'Sin notificacion'}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
                    <Pressable onPress={() => handleOpen(event)}><PencilIcon size={18} color={palette.primary} /></Pressable>
                    <Pressable onPress={() => void removeEvent(event.id)}><Trash2Icon size={18} color={palette.danger} /></Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) {
            setEditId(null)
          }
        }}
        title={editId ? 'Editar evento' : 'Agregar evento'}
        description="El monto del evento sale del presupuesto libre de Gustos."
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button variant="ghost" className="flex-1" onPress={resetForm}><Text>Cancelar</Text></Button>
            <Button className="flex-1" onPress={() => void handleSave()} disabled={exceedsBudget}><Text>Guardar</Text></Button>
          </View>
        }
      >
        <View style={{ gap: spacing.md }}>
          <Input value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Nombre del evento" />
          <Input value={form.date} onChangeText={(value) => setForm((current) => ({ ...current, date: value }))} placeholder="2026-06-22" />
          <Input keyboardType="numeric" value={form.amount} onChangeText={(value) => { setFormError(null); setForm((current) => ({ ...current, amount: value })) }} placeholder="Monto" />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button variant={form.isNotification ? 'default' : 'outline'} className="flex-1" onPress={() => setForm((current) => ({ ...current, isNotification: true }))}><Text>Con notificacion</Text></Button>
            <Button variant={!form.isNotification ? 'default' : 'outline'} className="flex-1" onPress={() => setForm((current) => ({ ...current, isNotification: false }))}><Text>Sin notificacion</Text></Button>
          </View>
          {formError ? <Text style={{ color: palette.danger, fontSize: 13 }}>{formError}</Text> : <Text style={{ color: palette.textMuted, fontSize: 12 }}>Disponible ahora: {formatMoney(availableForCurrentForm)}</Text>}
        </View>
      </Dialog>
    </AppFrame>
  )
}
