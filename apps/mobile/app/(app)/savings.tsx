import { useState } from 'react'
import { PiggyBank, Plus, Trash2, Pencil } from 'lucide-react-native'
import { View, Pressable } from 'react-native'

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

const PiggyBankIcon = PiggyBank as any
const PlusIcon = Plus as any
const PencilIcon = Pencil as any
const Trash2Icon = Trash2 as any

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function SavingsScreen() {
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
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const overview = getMonthlyOverview(salaries, transactions, formula)
  const savingsList = transactions.filter((transaction) => transaction.type === 'saving')
  const pct = overview.budgetSavings > 0 ? Math.min(100, Math.round((overview.totalSavings / overview.budgetSavings) * 100)) : 0
  const remaining = overview.budgetSavings - overview.totalSavings
  const budgetFull = remaining <= 0

  function resetForm() {
    setAmount('')
    setDate('')
    setEditId(null)
    setFormError(null)
    setOpen(false)
  }

  function handleOpen(entry?: (typeof savingsList)[number]) {
    if (entry) {
      setEditId(entry.id)
      setAmount(String(entry.amount))
      setDate(entry.date)
      setOpen(true)
    } else {
      setEditId(null)
      setAmount(String(Math.max(0, remaining)))
      setDate('')
      setOpen(true)
    }
    setFormError(null)
  }

  async function handleSave() {
    if (!amount) return
    const parsedAmount = Number(amount)

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('El monto debe ser mayor que cero.')
      return
    }

    if (editId) {
      const currentAmount = transactions.find((t) => t.id === editId)?.amount ?? 0
      const availableForEdit = Math.max(0, remaining + currentAmount)
      if (parsedAmount > availableForEdit) {
        setFormError(`Solo puedes ajustar hasta ${formatMoney(availableForEdit)}.`)
        return
      }
    } else if (parsedAmount > remaining) {
      setFormError(`Solo puedes ahorrar hasta ${formatMoney(Math.max(0, remaining))}.`)
      return
    }

    const payload = {
      amount: parsedAmount,
      type: 'saving' as const,
      date: date || new Date().toISOString().slice(0, 10),
    }

    if (editId) await updateTransaction(editId, payload)
    else await addTransaction(payload)

    resetForm()
  }

  return (
    <AppFrame
      title="Ahorros"
      subtitle="Entradas de ahorro reales, vinculadas al overview mensual y al presupuesto disponible."
      actions={
        <Button variant="default" className="self-start" onPress={() => handleOpen()} disabled={budgetFull}>
          <PlusIcon size={16} color={palette.text} />
          <Text>Agregar ahorro</Text>
        </Button>
      }
    >
      <Card>
        <CardContent className="pt-6">
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted, fontSize: 12, textTransform: 'uppercase' }}>Presupuesto mensual (25%)</Text>
              <Text style={{ color: remaining >= 0 ? palette.success : palette.warning, fontSize: 12, fontWeight: '700' }}>
                {remaining >= 0 ? `${formatMoney(remaining)} para ahorrar` : `${formatMoney(Math.abs(remaining))} excedido`}
              </Text>
            </View>
            <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800' }}>
              +{formatMoney(overview.totalSavings)} <Text style={{ color: palette.textMuted, fontSize: 16 }}>/ {formatMoney(overview.budgetSavings)}</Text>
            </Text>
            <View style={{ height: 10, borderRadius: radius.full, overflow: 'hidden', backgroundColor: palette.surfaceMuted }}>
              <View style={{ height: '100%', width: `${pct}%`, backgroundColor: palette.success }} />
            </View>
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
          <CardDescription>Movimientos guardados de ahorro.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {savingsList.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
              <PiggyBankIcon size={28} color={palette.textMuted} />
              <Text style={{ color: palette.textMuted }}>Sin ahorros registrados</Text>
            </View>
          ) : (
            savingsList.map((transaction) => (
              <View key={transaction.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.backgroundAlt, padding: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>Ahorro registrado</Text>
                  <Text style={{ color: palette.textMuted, fontSize: 12 }}>{transaction.date}</Text>
                </View>
                <Text style={{ color: palette.success, fontSize: 15, fontWeight: '700' }}>+{formatMoney(transaction.amount)}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Pressable onPress={() => handleOpen(transaction)}>
                    <PencilIcon size={18} color={palette.primary} />
                  </Pressable>
                  <Pressable onPress={() => void removeTransaction(transaction.id)}>
                    <Trash2Icon size={18} color={palette.danger} />
                  </Pressable>
                </View>
              </View>
            ))
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
        title={editId ? 'Editar ahorro' : 'Registrar ahorro'}
        description="Guarda el monto y la fecha del movimiento."
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button variant="ghost" className="flex-1" onPress={resetForm}>
              <Text>Cancelar</Text>
            </Button>
            <Button className="flex-1" onPress={() => void handleSave()}>
              <Text>Guardar</Text>
            </Button>
          </View>
        }
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: 8 }}>
            <Text style={{ color: palette.textMuted, fontSize: 13 }}>Monto</Text>
            <Input keyboardType="numeric" value={amount} onChangeText={(value) => { setFormError(null); setAmount(value) }} placeholder="500" />
            {!editId && remaining > 0 ? <Text style={{ color: palette.textMuted, fontSize: 12 }}>Disponible: {formatMoney(Math.max(0, remaining))}</Text> : null}
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: palette.textMuted, fontSize: 13 }}>Fecha</Text>
            <Input value={date} onChangeText={(value) => { setFormError(null); setDate(value) }} placeholder="2026-06-22" />
          </View>
          {formError ? <Text style={{ color: palette.danger, fontSize: 13 }}>{formError}</Text> : null}
        </View>
      </Dialog>
    </AppFrame>
  )
}
