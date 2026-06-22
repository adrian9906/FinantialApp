import { useMemo, useState } from 'react'
import { Grid3X3, LayoutList, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react-native'
import { Image, Pressable, View } from 'react-native'
import { buildPurchaseProjection } from '@plata/shared'

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

type ViewMode = 'cards' | 'list'
const Grid3X3Icon = Grid3X3 as any
const LayoutListIcon = LayoutList as any
const PencilIcon = Pencil as any
const PlusIcon = Plus as any
const ShoppingCartIcon = ShoppingCart as any
const Trash2Icon = Trash2 as any

const dateFormatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function getPriorityLabel(priority: 'low' | 'medium' | 'high') {
  if (priority === 'high') return 'Alta'
  if (priority === 'low') return 'Baja'
  return 'Media'
}

function getPriorityColor(priority: 'low' | 'medium' | 'high', palette: ReturnType<typeof resolvePalette>) {
  if (priority === 'low') return palette.danger
  if (priority === 'medium') return palette.warning
  return palette.success
}

export default function WishlistScreen() {
  const wishlist = useFinanceStore((state) => state.wishlist)
  const transactions = useFinanceStore((state) => state.transactions)
  const salaries = useFinanceStore((state) => state.salaries)
  const addWishlistItem = useFinanceStore((state) => state.addWishlistItem)
  const updateWishlistItem = useFinanceStore((state) => state.updateWishlistItem)
  const removeWishlistItem = useFinanceStore((state) => state.removeWishlistItem)
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [form, setForm] = useState({ name: '', price: '', priority: 'medium' as 'low' | 'medium' | 'high', image: '' })

  const averageMonthlySavings = useMemo(() => {
    const totalSaved = transactions.filter((transaction) => transaction.type === 'saving').reduce((sum, transaction) => sum + transaction.amount, 0)
    const trackedMonths = salaries.length > 0 ? new Set(salaries.map((salary) => salary.month)).size : new Set(transactions.filter((transaction) => transaction.type === 'saving').map((transaction) => transaction.date.slice(0, 7))).size
    if (trackedMonths === 0) return 0
    return totalSaved / trackedMonths
  }, [salaries, transactions])

  const currentSavedAmount = Math.max(0, transactions.filter((transaction) => transaction.type === 'saving').reduce((sum, transaction) => sum + transaction.amount, 0))
  const reachedItems = wishlist.filter((item) => currentSavedAmount >= item.price && item.price > 0).length
  const editItem = wishlist.find((item) => item.id === editId) ?? null

  function resetForm() {
    setForm({ name: '', price: '', priority: 'medium', image: '' })
    setEditId(null)
    setOpen(false)
  }

  function handleOpen(entry?: (typeof wishlist)[number]) {
    if (entry) {
      setEditId(entry.id)
      setForm({ name: entry.name, price: String(entry.price), priority: entry.priority, image: entry.image ?? '' })
      setOpen(true)
      return
    }
    setForm({ name: '', price: '', priority: 'medium', image: '' })
    setEditId(null)
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.price) return
    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      priority: form.priority,
      savedAmount: editItem?.savedAmount ?? 0,
      image: form.image || undefined,
    }
    if (editId) await updateWishlistItem(editId, payload)
    else await addWishlistItem(payload)
    resetForm()
  }

  return (
    <AppFrame
      title="Deseos"
      subtitle="Lista de productos con foto, prioridad y fecha posible de compra segun tu ahorro."
      actions={
        <Button variant="default" className="self-start" onPress={() => handleOpen()}>
          <PlusIcon size={16} color={palette.text} />
          <Text>Agregar artículo</Text>
        </Button>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {[
          { label: 'Ahorro disponible', value: formatMoney(currentSavedAmount) },
          { label: 'Promedio mensual', value: formatMoney(averageMonthlySavings) },
          { label: 'Deseos alcanzables hoy', value: String(reachedItems) },
        ].map((card) => (
          <Card key={card.label} className="min-w-[220px] flex-1">
            <CardContent className="pt-6">
              <Text style={{ color: palette.textMuted, fontSize: 12, textTransform: 'uppercase' }}>{card.label}</Text>
              <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800', marginTop: spacing.sm }}>{card.value}</Text>
            </CardContent>
          </Card>
        ))}
      </View>

      <Card>
        <CardHeader>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' }}>
            <View>
              <CardTitle>Vista de deseos</CardTitle>
              <CardDescription>Cambia entre tarjetas y lista.</CardDescription>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button variant={viewMode === 'cards' ? 'default' : 'outline'} onPress={() => setViewMode('cards')}>
                <Grid3X3Icon size={16} color={viewMode === 'cards' ? palette.textOnPrimary : palette.text} />
                <Text>Tarjetas</Text>
              </Button>
              <Button variant={viewMode === 'list' ? 'default' : 'outline'} onPress={() => setViewMode('list')}>
                <LayoutListIcon size={16} color={viewMode === 'list' ? palette.textOnPrimary : palette.text} />
                <Text>Lista</Text>
              </Button>
            </View>
          </View>
        </CardHeader>
      </Card>

      {wishlist.length === 0 ? (
        <Card>
          <CardContent className="items-center pt-10">
            <ShoppingCartIcon size={30} color={palette.textMuted} />
            <Text style={{ color: palette.textMuted, marginTop: spacing.md }}>Tu lista de deseos esta vacia</Text>
          </CardContent>
        </Card>
      ) : viewMode === 'cards' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {wishlist.map((item) => {
            const projection = buildPurchaseProjection(item.price, currentSavedAmount, averageMonthlySavings, (date) => dateFormatter.format(date))
            const priorityColor = getPriorityColor(item.priority, palette)
            return (
              <Card key={item.id} className="min-w-[260px] flex-1">
                <CardContent className="pt-0 px-0">
                  <View style={{ height: 180, backgroundColor: palette.backgroundAlt, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                    {item.image ? <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <ShoppingCartIcon size={28} color={palette.textMuted} />}
                  </View>
                  <View style={{ padding: spacing.lg, gap: spacing.md }}>
                    <Text style={{ color: priorityColor, fontSize: 12, fontWeight: '700' }}>Prioridad {getPriorityLabel(item.priority)}</Text>
                    <Text style={{ color: palette.text, fontSize: 22, fontWeight: '800' }}>{item.name}</Text>
                    <Text style={{ color: palette.primary, fontSize: 16 }}>{formatMoney(item.price)}</Text>
                    <View style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: palette.textMuted, fontSize: 12 }}>Progreso</Text>
                        <Text style={{ color: palette.text, fontSize: 12 }}>{Math.round(projection.progress)}%</Text>
                      </View>
                      <View style={{ height: 8, borderRadius: radius.full, overflow: 'hidden', backgroundColor: palette.surfaceMuted }}>
                        <View style={{ height: '100%', width: `${projection.progress}%`, backgroundColor: palette.primary }} />
                      </View>
                      <Text style={{ color: palette.textMuted, fontSize: 12 }}>Tienes: {formatMoney(currentSavedAmount)} · Faltan: {formatMoney(projection.remaining)}</Text>
                      <Text style={{ color: palette.textMuted, fontSize: 12 }}>{projection.timelineLabel}</Text>
                      <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>{projection.purchaseDateLabel}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
                      <Pressable onPress={() => handleOpen(item)}><PencilIcon size={18} color={palette.primary} /></Pressable>
                      <Pressable onPress={() => void removeWishlistItem(item.id)}><Trash2Icon size={18} color={palette.danger} /></Pressable>
                    </View>
                  </View>
                </CardContent>
              </Card>
            )
          })}
        </View>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Lista de deseos</CardTitle>
            <CardDescription>Version compacta con foto, precio y fecha posible.</CardDescription>
          </CardHeader>
          <CardContent className="gap-3">
            {wishlist.map((item) => {
              const projection = buildPurchaseProjection(item.price, currentSavedAmount, averageMonthlySavings, (date) => dateFormatter.format(date))
              const priorityColor = getPriorityColor(item.priority, palette)
              return (
                <View key={item.id} style={{ borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.backgroundAlt, padding: spacing.md, gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    <View style={{ width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden', backgroundColor: palette.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                      {item.image ? <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <ShoppingCartIcon size={22} color={palette.textMuted} />}
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ color: priorityColor, fontSize: 12, fontWeight: '700' }}>Prioridad {getPriorityLabel(item.priority)}</Text>
                      <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800' }}>{item.name}</Text>
                      <Text style={{ color: palette.primary, fontSize: 14 }}>{formatMoney(item.price)}</Text>
                      <Text style={{ color: palette.textMuted, fontSize: 12 }}>{projection.purchaseDateLabel}</Text>
                    </View>
                  </View>
                  <Text style={{ color: palette.textMuted, fontSize: 12 }}>Faltan {formatMoney(projection.remaining)} · {projection.timelineLabel}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
                    <Pressable onPress={() => handleOpen(item)}><PencilIcon size={18} color={palette.primary} /></Pressable>
                    <Pressable onPress={() => void removeWishlistItem(item.id)}><Trash2Icon size={18} color={palette.danger} /></Pressable>
                  </View>
                </View>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) {
            setEditId(null)
          }
        }}
        title={editId ? 'Editar deseo' : 'Agregar deseo'}
        description="Precio, prioridad e imagen del producto."
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button variant="ghost" className="flex-1" onPress={resetForm}><Text>Cancelar</Text></Button>
            <Button className="flex-1" onPress={() => void handleSave()}><Text>Guardar</Text></Button>
          </View>
        }
      >
        <View style={{ gap: spacing.md }}>
          <Input value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Nombre del articulo" />
          <Input keyboardType="numeric" value={form.price} onChangeText={(value) => setForm((current) => ({ ...current, price: value }))} placeholder="Precio" />
          <Input value={form.image} onChangeText={(value) => setForm((current) => ({ ...current, image: value }))} placeholder="URL de la imagen" />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['low', 'medium', 'high'] as const).map((priority) => (
              <Button key={priority} variant={form.priority === priority ? 'default' : 'outline'} className="flex-1" onPress={() => setForm((current) => ({ ...current, priority }))}>
                <Text>{getPriorityLabel(priority)}</Text>
              </Button>
            ))}
          </View>
        </View>
      </Dialog>
    </AppFrame>
  )
}
