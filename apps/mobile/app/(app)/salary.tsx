import { useMemo, useState } from 'react'
import { formatFormulaLabel, usePreferencesStore } from '../../src/store/preferences-store'
import { useFinanceStore } from '../../src/store/finance-store'
import { AppFrame } from '../../src/components/app-frame'
import { Button } from '../../src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../src/components/ui/card'
import { Dialog } from '../../src/components/ui/dialog'
import { Input } from '../../src/components/ui/input'
import { Text } from '../../src/components/ui/text'
import { resolvePalette } from '../../src/theme/palette'
import { radius, spacing } from '../../src/theme/tokens'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, Wallet } from 'lucide-react-native'
import { Pressable, View } from 'react-native'

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const ChevronLeftIcon = ChevronLeft as any
const ChevronRightIcon = ChevronRight as any
const WalletIcon = Wallet as any
const PlusIcon = Plus as any
const PencilIcon = Pencil as any
const Trash2Icon = Trash2 as any

function monthValueToDate(value: string) {
  if (!value) {
    return new Date()
  }

  const [year, month] = value.split('-').map(Number)

  if (!year || !month) {
    return new Date()
  }

  return new Date(year, month - 1, 1)
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function SalaryScreen() {
  const salaries = useFinanceStore((state) => state.salaries)
  const addSalary = useFinanceStore((state) => state.addSalary)
  const updateSalary = useFinanceStore((state) => state.updateSalary)
  const removeSalary = useFinanceStore((state) => state.removeSalary)
  const formula = usePreferencesStore((state) => state.formula)
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState('')
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [isSaving, setIsSaving] = useState(false)

  const sortedSalaries = useMemo(() => [...salaries].sort((a, b) => b.month.localeCompare(a.month)), [salaries])
  const latestSalary = sortedSalaries[0] ?? null

  const budgetExpenses = latestSalary ? latestSalary.amount * (formula.expenses / 100) : 0
  const budgetWants = latestSalary ? latestSalary.amount * (formula.wants / 100) : 0
  const budgetSavings = latestSalary ? latestSalary.amount * (formula.savings / 100) : 0

  function resetForm() {
    setAmount('')
    setMonth('')
    setEditId(null)
    setCalendarYear(new Date().getFullYear())
    setOpen(false)
  }

  function handleOpen(entry?: (typeof salaries)[number]) {
    if (entry) {
      setEditId(entry.id)
      setAmount(String(entry.amount))
      setMonth(entry.month)
      setCalendarYear(monthValueToDate(entry.month).getFullYear())
      setOpen(true)
      return
    }

    setEditId(null)
    setAmount('')
    setMonth('')
    setCalendarYear(new Date().getFullYear())
    setOpen(true)
  }

  async function handleSave() {
    if (!amount || !month) return

    setIsSaving(true)
    const payload = {
      amount: Number(amount),
      month,
    }

    try {
      if (editId) {
        await updateSalary(editId, payload)
      } else {
        await addSalary(payload)
      }

      resetForm()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppFrame
      title="Salario"
      subtitle="Registro mensual, distribucion por formula e historial alineado con la estructura de la web."
      actions={
        <Button variant="outline" className="self-start" onPress={() => handleOpen()}>
          <PlusIcon size={16} color={palette.text} />
          <Text>{salaries.length > 0 ? 'Actualizar' : 'Agregar salario'}</Text>
        </Button>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <Card className="min-w-[260px] flex-1">
          <CardHeader>
            <CardTitle>Ingreso mensual</CardTitle>
            <CardDescription>La formula activa es {formatFormulaLabel(formula)}.</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            {latestSalary ? (
              <>
                <View
                  style={{
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: palette.border,
                    backgroundColor: palette.backgroundAlt,
                    padding: spacing.md,
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: palette.primarySoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <WalletIcon size={20} color={palette.primary} />
                    </View>
                    <View>
                      <Text style={{ color: palette.textMuted, fontSize: 12, textTransform: 'uppercase' }}>Salario neto</Text>
                      <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800' }}>{formatMoney(latestSalary.amount)}</Text>
                    </View>
                  </View>
                  <Text style={{ color: palette.textMuted, fontSize: 12 }}>{latestSalary.month}</Text>
                </View>

                {[
                  { label: `${formula.expenses}% Necesidades`, value: budgetExpenses, color: palette.primary },
                  { label: `${formula.wants}% Gustos`, value: budgetWants, color: '#f97316' },
                  { label: `${formula.savings}% Ahorros`, value: budgetSavings, color: palette.success },
                ].map((item) => (
                  <View key={item.label} style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                      <Text style={{ color: palette.textMuted, fontSize: 13 }}>{item.label}</Text>
                      <Text style={{ color: item.color, fontSize: 14, fontWeight: '700' }}>{formatMoney(item.value)}</Text>
                    </View>
                    <View style={{ height: 8, borderRadius: radius.full, overflow: 'hidden', backgroundColor: palette.surfaceMuted }}>
                      <View
                        style={{
                          height: '100%',
                          width: `${item.label.startsWith(`${formula.expenses}`) ? formula.expenses : item.label.startsWith(`${formula.wants}`) ? formula.wants : formula.savings}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md }}>
                <WalletIcon size={30} color={palette.textMuted} />
                <Text style={{ color: palette.textMuted }}>No hay salario registrado</Text>
                <Button variant="secondary" onPress={() => handleOpen()}>
                  <PlusIcon size={16} color={palette.text} />
                  <Text>Agregar salario</Text>
                </Button>
              </View>
            )}
          </CardContent>
        </Card>

      </View>

      <Card>
        <CardHeader>
          <CardTitle>Historial de salarios</CardTitle>
          <CardDescription>Registros guardados y listos para editar o eliminar.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {sortedSalaries.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
              <Text style={{ color: palette.textMuted }}>Sin registros</Text>
            </View>
          ) : (
            sortedSalaries.map((entry) => (
              <View
                key={entry.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: palette.border,
                  backgroundColor: palette.backgroundAlt,
                  padding: spacing.md,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      backgroundColor: palette.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <WalletIcon size={18} color={palette.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>{formatMoney(entry.amount)}</Text>
                    <Text style={{ color: palette.textMuted, fontSize: 12 }}>{entry.month}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Pressable onPress={() => handleOpen(entry)}>
                    <PencilIcon size={18} color={palette.primary} />
                  </Pressable>
                  <Pressable onPress={() => void removeSalary(entry.id)}>
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
        title={editId ? 'Editar salario' : 'Agregar salario'}
        description="Selecciona mes y monto para guardar o actualizar el ingreso del mes."
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button variant="ghost" className="flex-1" onPress={resetForm}>
              <Text>Cancelar</Text>
            </Button>
            <Button className="flex-1" onPress={() => void handleSave()} disabled={isSaving || !amount || !month}>
              <Text>{isSaving ? 'Guardando...' : 'Guardar'}</Text>
            </Button>
          </View>
        }
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: 8 }}>
            <Text style={{ color: palette.textMuted, fontSize: 13 }}>Monto</Text>
            <Input keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="5000" />
          </View>

          <View
            style={{
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: palette.border,
              backgroundColor: palette.backgroundAlt,
              padding: spacing.md,
            }}
          >
            <Text style={{ color: palette.textMuted, fontSize: 11, textTransform: 'uppercase' }}>Mes seleccionado</Text>
            <Text style={{ color: palette.text, fontSize: 22, fontWeight: '800', marginTop: 8 }}>
              {month ? `${MONTH_LABELS[monthValueToDate(month).getMonth()]} ${monthValueToDate(month).getFullYear()}` : 'Elige un mes'}
            </Text>
            <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 4 }}>
              {month ? `Valor guardado: ${month}` : 'Selecciona el periodo que se va a registrar.'}
            </Text>
          </View>

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
              <View>
                <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>Calendario de meses</Text>
                <Text style={{ color: palette.textMuted, fontSize: 12 }}>Usa el anio y toca el mes.</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Pressable onPress={() => setCalendarYear((year) => year - 1)}>
                  <ChevronLeftIcon size={18} color={palette.textMuted} />
                </Pressable>
                <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700', minWidth: 52, textAlign: 'center' }}>{calendarYear}</Text>
                <Pressable onPress={() => setCalendarYear((year) => year + 1)}>
                  <ChevronRightIcon size={18} color={palette.textMuted} />
                </Pressable>
              </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {MONTH_LABELS.map((label, index) => {
                const value = `${calendarYear}-${String(index + 1).padStart(2, '0')}`
                const isSelected = month === value

                return (
                  <Button
                    key={value}
                    variant={isSelected ? 'default' : 'outline'}
                    className="min-w-[72px]"
                    onPress={() => setMonth(value)}
                  >
                    <Text>{label}</Text>
                  </Button>
                )
              })}
            </View>
          </View>
        </View>
      </Dialog>
    </AppFrame>
  )
}
