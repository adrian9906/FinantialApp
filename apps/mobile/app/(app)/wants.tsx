import { useMemo, useState } from 'react'
import { Clapperboard, Gamepad2, Heart, Pencil, Plus, ShoppingBag, Sparkles, Ticket, Trash2 } from 'lucide-react-native'
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
const PlusIcon = Plus as any
const PencilIcon = Pencil as any
const Trash2Icon = Trash2 as any

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

  function resetForm() {
    setForm({ amount: '', itemName: '', category: 'outings', date: '' })
    setEditId(null)
    setFormError(null)
    setOpen(false)
  }

  function handleOpen(entry?: WantViewItem) {
    if (entry) {
      setEditId(entry.id)
      setForm({ amount: String(entry.amount), itemName: entry.itemName, category: entry.category, date: entry.date })
      setOpen(true)
      return
    }
    setForm({ amount: '', itemName: '', category: 'outings', date: '' })
    setEditId(null)
    setFormError(null)
    setOpen(true)
  }

  async function handleSave() {
    if (!form.amount || !form.itemName) return
    const nextAmount = Number(form.amount)
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setFormError('El precio debe ser mayor que cero.')
      return
    }
    if (nextAmount > availableToPlan || plannedTotal + nextAmount > overview.budgetWants) {
      setFormError(`No puedes agregarlo porque supera el limite disponible de ${formatMoney(availableToPlan)}.`)
      return
    }

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
            <Button className="flex-1" onPress={() => void handleSave()}><Text>Guardar</Text></Button>
          </View>
        }
      >
        <View style={{ gap: spacing.md }}>
          <Input keyboardType="numeric" value={form.amount} onChangeText={(value) => { setFormError(null); setForm((current) => ({ ...current, amount: value })) }} placeholder="Precio" />
          <Input value={form.itemName} onChangeText={(value) => { setFormError(null); setForm((current) => ({ ...current, itemName: value })) }} placeholder="Producto o experiencia" />
          <Input value={form.date} onChangeText={(value) => setForm((current) => ({ ...current, date: value }))} placeholder="2026-06-22" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <Button key={key} variant={form.category === key ? 'default' : 'outline'} className="self-start" onPress={() => setForm((current) => ({ ...current, category: key as WantCategory }))}>
                <Text>{meta.label}</Text>
              </Button>
            ))}
          </View>
          {formError ? <Text style={{ color: palette.danger, fontSize: 13 }}>{formError}</Text> : <Text style={{ color: palette.textMuted, fontSize: 12 }}>Puedes planificar hasta {formatMoney(availableToPlan)} sin pasarte.</Text>}
        </View>
      </Dialog>
    </AppFrame>
  )
}
