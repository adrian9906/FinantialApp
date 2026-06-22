import { useState } from 'react'
import { CalendarClock, Landmark, Percent, Pencil, Plus, Trash2 } from 'lucide-react-native'
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

const LandmarkIcon = Landmark as any
const CalendarClockIcon = CalendarClock as any
const PercentIcon = Percent as any
const PlusIcon = Plus as any
const PencilIcon = Pencil as any
const Trash2Icon = Trash2 as any

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export default function DebtsScreen() {
  const debts = useFinanceStore((state) => state.debts)
  const addDebt = useFinanceStore((state) => state.addDebt)
  const updateDebt = useFinanceStore((state) => state.updateDebt)
  const removeDebt = useFinanceStore((state) => state.removeDebt)
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ amount: '', history: '', startDate: '', endDate: '', interest: '' })

  const totalDebt = debts.reduce((sum, debt) => sum + debt.amount, 0)
  const debtsWithInterest = debts.filter((debt) => debt.interest !== undefined)
  const averageInterest = debtsWithInterest.length > 0 ? debtsWithInterest.reduce((sum, debt) => sum + (debt.interest ?? 0), 0) / debtsWithInterest.length : 0

  function resetForm() {
    setForm({ amount: '', history: '', startDate: '', endDate: '', interest: '' })
    setEditId(null)
    setOpen(false)
  }

  function handleOpen(entry?: (typeof debts)[number]) {
    if (entry) {
      setEditId(entry.id)
      setForm({
        amount: String(entry.amount),
        history: entry.history,
        startDate: entry.startDate,
        endDate: entry.endDate,
        interest: entry.interest === undefined ? '' : String(entry.interest),
      })
      setOpen(true)
      return
    }

    setForm({ amount: '', history: '', startDate: '', endDate: '', interest: '' })
    setEditId(null)
    setOpen(true)
  }

  async function handleSave() {
    if (!form.amount || !form.history || !form.startDate || !form.endDate) return

    const payload = {
      amount: Number(form.amount),
      history: form.history,
      startDate: form.startDate,
      endDate: form.endDate,
      interest: form.interest === '' ? undefined : Number(form.interest),
    }

    if (editId) await updateDebt(editId, payload)
    else await addDebt(payload)
    resetForm()
  }

  return (
    <AppFrame
      title="Deudas"
      subtitle="Control de monto, historial, interes y fechas para cada deuda registrada."
      actions={
        <Button variant="default" className="self-start" onPress={() => handleOpen()}>
          <PlusIcon size={16} color={palette.text} />
          <Text>Nueva deuda</Text>
        </Button>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {[
          { label: 'Total adeudado', value: formatMoney(totalDebt), icon: LandmarkIcon, color: palette.primary },
          { label: 'Deudas activas', value: String(debts.length), icon: CalendarClockIcon, color: palette.warning },
          { label: 'Interes promedio', value: `${averageInterest.toFixed(2)}%`, icon: PercentIcon, color: palette.success },
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
                  <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800' }}>{card.value}</Text>
                </View>
              </CardContent>
            </Card>
          )
        })}
      </View>

      <Card>
        <CardHeader>
          <CardTitle>Deudas guardadas</CardTitle>
          <CardDescription>Registros activos y listos para editar.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {debts.length === 0 ? (
            <Text style={{ color: palette.textMuted, textAlign: 'center', paddingVertical: spacing.xl }}>Sin deudas registradas</Text>
          ) : debts.map((debt) => (
            <View key={debt.id} style={{ borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.backgroundAlt, padding: spacing.md, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>{debt.history}</Text>
                  <Text style={{ color: palette.textMuted, fontSize: 12 }}>
                    {debt.interest !== undefined ? `Interes: ${debt.interest}%` : 'Sin interes registrado'}
                  </Text>
                </View>
                <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>{formatMoney(debt.amount)}</Text>
              </View>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>Inicio: {debt.startDate}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>Fin: {debt.endDate}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
                <Pressable onPress={() => handleOpen(debt)}><PencilIcon size={18} color={palette.primary} /></Pressable>
                <Pressable onPress={() => void removeDebt(debt.id)}><Trash2Icon size={18} color={palette.danger} /></Pressable>
              </View>
            </View>
          ))}
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
        title={editId ? 'Editar deuda' : 'Agregar deuda'}
        description="Guarda monto, historial y fechas segun el schema actual."
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button variant="ghost" className="flex-1" onPress={resetForm}><Text>Cancelar</Text></Button>
            <Button className="flex-1" onPress={() => void handleSave()}><Text>Guardar</Text></Button>
          </View>
        }
      >
        <View style={{ gap: spacing.md }}>
          <Input keyboardType="numeric" value={form.amount} onChangeText={(value) => setForm((current) => ({ ...current, amount: value }))} placeholder="Monto" />
          <Input value={form.history} onChangeText={(value) => setForm((current) => ({ ...current, history: value }))} placeholder="Historial" />
          <Input value={form.startDate} onChangeText={(value) => setForm((current) => ({ ...current, startDate: value }))} placeholder="Fecha de inicio" />
          <Input value={form.endDate} onChangeText={(value) => setForm((current) => ({ ...current, endDate: value }))} placeholder="Fecha de terminacion" />
          <Input keyboardType="numeric" value={form.interest} onChangeText={(value) => setForm((current) => ({ ...current, interest: value }))} placeholder="Interes (opcional)" />
        </View>
      </Dialog>
    </AppFrame>
  )
}
