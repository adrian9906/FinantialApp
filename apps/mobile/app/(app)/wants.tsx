import { useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clapperboard, Gamepad2, Heart, Pencil, Plus, ShoppingBag, Sparkles, Ticket, Trash2 } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { buildWantDescription, getPlannedWantTotal, parseWantDescription, type WantCategory } from '@plata/shared'

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

type WantViewItem = {
  id: string
  amount: number
  date: string
  itemName: string
  category: WantCategory
  status: 'pending' | 'checked'
}

const TicketIcon = Ticket as any
const ShoppingBagIcon = ShoppingBag as any
const Gamepad2Icon = Gamepad2 as any
const ClapperboardIcon = Clapperboard as any
const SparklesIcon = Sparkles as any
const CalendarIcon = Calendar as any
const ChevronLeftIcon = ChevronLeft as any
const ChevronRightIcon = ChevronRight as any
const PlusIcon = Plus as any
const PencilIcon = Pencil as any
const Trash2Icon = Trash2 as any
const MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WEEKDAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

const CATEGORY_META: Record<WantCategory, { label: string; hint: string; icon: any; color: string }> = {
  outings: { label: 'Salidas', hint: 'Cenas, cafes y paseos.', icon: TicketIcon, color: '#c084fc' },
  shopping: { label: 'Compras', hint: 'Ropa, gadgets y accesorios.', icon: ShoppingBagIcon, color: '#f9a8d4' },
  gaming: { label: 'Gaming', hint: 'Juegos y entretenimiento digital.', icon: Gamepad2Icon, color: '#67e8f9' },
  subscriptions: { label: 'Suscripciones', hint: 'Streaming, apps premium y servicios.', icon: ClapperboardIcon, color: '#fcd34d' },
  selfcare: { label: 'Autocuidado', hint: 'Spa, skincare y hobbies.', icon: SparklesIcon, color: '#6ee7b7' },
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
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

export default function WantsScreen() {
  const transactions = useFinanceStore((state) => state.transactions)
  const salaries = useFinanceStore((state) => state.salaries)
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const updateTransaction = useFinanceStore((state) => state.updateTransaction)
  const removeTransaction = useFinanceStore((state) => state.removeTransaction)
  const formula = usePreferencesStore((state) => state.formula)
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ amount: '', itemName: '', category: 'outings' as WantCategory, date: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))

  const overview = getMonthlyOverview(salaries, transactions, formula)
  const wantItems: WantViewItem[] = useMemo(() => transactions.filter((transaction) => transaction.type === 'want').map((transaction) => {
    const parsed = parseWantDescription(transaction.description)
    return { id: transaction.id, amount: transaction.amount, date: transaction.date, itemName: parsed.itemName, category: parsed.category, status: parsed.status }
  }), [transactions])
  const groupedWants = Object.entries(CATEGORY_META).map(([key, meta]) => {
    const items = wantItems.filter((item) => item.category === key)
    return { key: key as WantCategory, meta, items, total: items.reduce((sum, item) => sum + item.amount, 0), completed: items.filter((item) => item.status === 'checked').length }
  })

  const wantCount = wantItems.length
  const checkedCount = wantItems.filter((item) => item.status === 'checked').length
  const pendingCount = wantItems.filter((item) => item.status === 'pending').length
  const currentItemAmount = editId ? wantItems.find((item) => item.id === editId)?.amount ?? 0 : 0
  const plannedTotal = getPlannedWantTotal(transactions) - currentItemAmount
  const availableToPlan = Math.max(0, overview.budgetWants - plannedTotal)
  const pct = overview.budgetWants > 0 ? Math.min(100, Math.round((overview.totalWants / overview.budgetWants) * 100)) : 0
  const remaining = overview.budgetWants - overview.totalWants
  const monthMatrix = useMemo(() => buildMonthMatrix(calendarMonth), [calendarMonth])
  const parsedAmount = Number(form.amount)
  const inlineAmountError = useMemo(() => {
    if (!form.amount.trim()) return null
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return 'El precio debe ser mayor que cero.'
    }
    if (parsedAmount > availableToPlan || plannedTotal + parsedAmount > overview.budgetWants) {
      return `No puedes agregarlo porque supera el limite disponible de ${formatMoney(availableToPlan)}.`
    }
    return null
  }, [availableToPlan, form.amount, overview.budgetWants, parsedAmount, plannedTotal])

  function resetForm() {
    setForm({ amount: '', itemName: '', category: 'outings', date: '' })
    setEditId(null)
    setFormError(null)
    setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    setOpen(false)
  }

  function handleOpen(entry?: WantViewItem) {
    if (entry) {
      setEditId(entry.id)
      setForm({ amount: String(entry.amount), itemName: entry.itemName, category: entry.category, date: entry.date })
      const [year, month] = entry.date.split('-').map(Number)
      if (year && month) {
        setCalendarMonth(new Date(year, month - 1, 1))
      }
      setOpen(true)
      return
    }
    setForm({ amount: '', itemName: '', category: 'outings', date: '' })
    setEditId(null)
    setFormError(null)
    setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    setOpen(true)
  }

  async function handleSave() {
    if (!form.amount || !form.itemName) return
    if (inlineAmountError) {
      setFormError(inlineAmountError)
      return
    }
    const nextAmount = parsedAmount

    const currentStatus = editId ? wantItems.find((item) => item.id === editId)?.status ?? 'pending' : 'pending'
    const payload = {
      amount: nextAmount,
      type: 'want' as const,
      description: buildWantDescription(form.category, form.itemName, currentStatus),
      date: form.date || new Date().toISOString().slice(0, 10),
    }

    if (editId) await updateTransaction(editId, payload)
    else await addTransaction(payload)
    resetForm()
  }

  async function toggleChecked(item: WantViewItem) {
    const nextStatus = item.status === 'checked' ? 'pending' : 'checked'
    await updateTransaction(item.id, {
      amount: item.amount,
      type: 'want',
      date: item.date,
      description: buildWantDescription(item.category, item.itemName, nextStatus),
    })
  }

  return (
    <AppFrame
      title="Gustos"
      subtitle="Tus caprichos y experiencias, organizados por categoria y respetando el presupuesto libre."
      actions={
        <Button variant="default" className="self-start" onPress={() => handleOpen()}>
          <PlusIcon size={16} color={palette.text} />
          <Text>Agregar gusto</Text>
        </Button>
      }
    >
      <Card>
        <CardContent className="pt-6">
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted, fontSize: 12, textTransform: 'uppercase' }}>Presupuesto mensual ({formula.wants}%)</Text>
              <Text style={{ color: remaining >= 0 ? palette.success : palette.danger, fontSize: 12, fontWeight: '700' }}>
                {remaining >= 0 ? `${formatMoney(remaining)} disponible` : `${formatMoney(Math.abs(remaining))} excedido`}
              </Text>
            </View>
            <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800' }}>
              {formatMoney(overview.totalWants)} <Text style={{ color: palette.textMuted, fontSize: 16 }}>/ {formatMoney(overview.budgetWants)}</Text>
            </Text>
            <View style={{ height: 10, borderRadius: radius.full, overflow: 'hidden', backgroundColor: palette.surfaceMuted }}>
              <View style={{ height: '100%', width: `${pct}%`, backgroundColor: '#c084fc' }} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>Productos: {wantCount}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>Check hechos: {checkedCount}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>Pendientes: {pendingCount}</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      {groupedWants.map(({ key, meta, items, total, completed }) => {
        const Icon = meta.icon
        return (
          <Card key={key}>
            <CardHeader>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon size={18} color={meta.color} />
                <View style={{ flex: 1 }}>
                  <CardTitle>{meta.label}</CardTitle>
                  <CardDescription>{meta.hint}</CardDescription>
                </View>
              </View>
            </CardHeader>
            <CardContent className="gap-3">
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>{items.length} items · {completed} completados · {formatMoney(total)}</Text>
              {items.length === 0 ? (
                <Text style={{ color: palette.textMuted, fontSize: 12 }}>Aun no hay gustos en esta categoria.</Text>
              ) : items.map((item) => (
                <Pressable key={item.id} onPress={() => void toggleChecked(item)} style={{ borderRadius: radius.md, borderWidth: 1, borderColor: item.status === 'checked' ? meta.color : palette.border, backgroundColor: palette.backgroundAlt, padding: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: item.status === 'checked' ? palette.textMuted : palette.text, fontSize: 15, fontWeight: '700', textDecorationLine: item.status === 'checked' ? 'line-through' : 'none' }}>{item.itemName}</Text>
                      <Text style={{ color: palette.textMuted, fontSize: 12 }}>{item.date} · {item.status === 'checked' ? 'Disfrutado' : 'Pendiente'}</Text>
                    </View>
                    <Text style={{ color: item.status === 'checked' ? palette.textMuted : meta.color, fontSize: 14, fontWeight: '700' }}>{formatMoney(item.amount)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm }}>
                    <Pressable onPress={() => handleOpen(item)}><PencilIcon size={18} color={palette.primary} /></Pressable>
                    <Pressable onPress={() => void removeTransaction(item.id)}><Trash2Icon size={18} color={palette.danger} /></Pressable>
                  </View>
                </Pressable>
              ))}
            </CardContent>
          </Card>
        )
      })}

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) {
            setEditId(null)
          }
        }}
        title={editId ? 'Editar gusto' : 'Agregar gusto'}
        description="Guarda cada gusto como item individual y marca cuando lo disfrutas."
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button variant="ghost" className="flex-1" onPress={resetForm}><Text>Cancelar</Text></Button>
            <Button className="flex-1" onPress={() => void handleSave()} disabled={Boolean(inlineAmountError) || !form.itemName.trim()}><Text>Guardar</Text></Button>
          </View>
        }
      >
        <View style={{ gap: spacing.md }}>
          <Input keyboardType="numeric" value={form.amount} onChangeText={(value) => { setFormError(null); setForm((current) => ({ ...current, amount: value })) }} placeholder="Precio" />
          {inlineAmountError ? <Text style={{ color: palette.danger, fontSize: 13 }}>{inlineAmountError}</Text> : <Text style={{ color: palette.textMuted, fontSize: 12 }}>Disponible para planificar: {formatMoney(availableToPlan)}</Text>}
          <Input value={form.itemName} onChangeText={(value) => { setFormError(null); setForm((current) => ({ ...current, itemName: value })) }} placeholder="Producto o experiencia" />
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: palette.textMuted, fontSize: 13 }}>Fecha</Text>
            <Pressable
              onPress={() => {}}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.backgroundAlt,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
              }}
            >
              <Text style={{ color: form.date ? palette.text : palette.textMuted, fontSize: 14 }}>
                {form.date || 'Selecciona una fecha'}
              </Text>
              <CalendarIcon size={16} color={palette.textMuted} />
            </Pressable>

            <View
              style={{
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.backgroundAlt,
                padding: spacing.md,
                gap: spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pressable onPress={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
                  <ChevronLeftIcon size={18} color={palette.textMuted} />
                </Pressable>
                <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>
                  {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                </Text>
                <Pressable onPress={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                  <ChevronRightIcon size={18} color={palette.textMuted} />
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {WEEKDAY_LABELS.map((day) => (
                  <View key={day} style={{ width: '13%', minWidth: 36 }}>
                    <Text style={{ color: palette.textMuted, fontSize: 11, textAlign: 'center' }}>{day}</Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {monthMatrix.map((date) => {
                  const dateKey = toDateKey(date)
                  const isCurrentMonth = date.getMonth() === calendarMonth.getMonth()
                  const isSelected = form.date === dateKey

                  return (
                    <Pressable
                      key={dateKey}
                      onPress={() => setForm((current) => ({ ...current, date: dateKey }))}
                      style={{
                        width: '13%',
                        minWidth: 36,
                        minHeight: 42,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: isSelected ? palette.primary : isCurrentMonth ? palette.border : 'transparent',
                        backgroundColor: isSelected ? palette.primarySoft : isCurrentMonth ? palette.surface : palette.surfaceMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: isSelected ? palette.primary : isCurrentMonth ? palette.text : palette.textMuted, fontSize: 12, fontWeight: '700' }}>
                        {date.getDate()}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <Button key={key} variant={form.category === key ? 'default' : 'outline'} className="self-start" onPress={() => setForm((current) => ({ ...current, category: key as WantCategory }))}>
                <Text>{meta.label}</Text>
              </Button>
            ))}
          </View>
          {formError && formError !== inlineAmountError ? <Text style={{ color: palette.danger, fontSize: 13 }}>{formError}</Text> : null}
        </View>
      </Dialog>
    </AppFrame>
  )
}
