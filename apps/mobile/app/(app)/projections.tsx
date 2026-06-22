import { useState } from 'react'
import { PlusCircle, Pencil, Target, Trash2, TrendingUp } from 'lucide-react-native'
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

const PlusCircleIcon = PlusCircle as any
const TrendingUpIcon = TrendingUp as any
const TargetIcon = Target as any
const PencilIcon = Pencil as any
const Trash2Icon = Trash2 as any

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export default function ProjectionsScreen() {
  const projections = useFinanceStore((state) => state.projections)
  const salaries = useFinanceStore((state) => state.salaries)
  const addProjection = useFinanceStore((state) => state.addProjection)
  const updateProjection = useFinanceStore((state) => state.updateProjection)
  const removeProjection = useFinanceStore((state) => state.removeProjection)
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [targetSalary, setTargetSalary] = useState('')

  const latestSalary = salaries.length > 0 ? salaries.reduce((max, salary) => new Date(salary.month) > new Date(max.month) ? salary : max) : null

  function resetForm() {
    setTargetSalary('')
    setEditId(null)
    setOpen(false)
  }

  function handleOpen(entry?: (typeof projections)[number]) {
    if (entry) {
      setEditId(entry.id)
      setTargetSalary(String(entry.targetSalary))
      setOpen(true)
      return
    }
    setTargetSalary('')
    setEditId(null)
    setOpen(true)
  }

  async function handleSave() {
    if (!targetSalary) return
    const payload = { targetSalary: Number(targetSalary) }
    if (editId) await updateProjection(editId, payload)
    else await addProjection(payload)
    resetForm()
  }

  const maxGoal = Math.max(0, ...projections.map((projection) => projection.targetSalary))

  return (
    <AppFrame
      title="Proyecciones"
      subtitle="Metas salariales, diferencia frente al salario actual y estado de avance."
      actions={
        <Button variant="default" className="self-start" onPress={() => handleOpen()}>
          <PlusCircleIcon size={16} color={palette.text} />
          <Text>Nueva proyeccion</Text>
        </Button>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {[
          { label: 'Salario actual', value: formatMoney(latestSalary?.amount ?? 0), icon: TrendingUpIcon },
          { label: 'Proyecciones guardadas', value: String(projections.length), icon: TargetIcon },
          { label: 'Meta mas alta', value: formatMoney(maxGoal), icon: TargetIcon },
        ].map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label} className="min-w-[220px] flex-1">
              <CardContent className="pt-6">
                <View style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: palette.textMuted }}>{card.label}</Text>
                    <Icon size={18} color={palette.primary} />
                  </View>
                  <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800' }}>{card.value}</Text>
                  {card.label === 'Salario actual' ? <Text style={{ color: palette.textMuted, fontSize: 12 }}>{latestSalary?.month ?? 'Sin salario base'}</Text> : null}
                </View>
              </CardContent>
            </Card>
          )
        })}
      </View>

      <Card>
        <CardHeader>
          <CardTitle>Metas guardadas</CardTitle>
          <CardDescription>Compara cada objetivo con tu salario actual.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {projections.length === 0 ? (
            <Text style={{ color: palette.textMuted, textAlign: 'center', paddingVertical: spacing.xl }}>Sin proyecciones guardadas</Text>
          ) : projections.map((projection) => {
            const gap = projection.targetSalary - (latestSalary?.amount ?? 0)
            const reached = gap <= 0
            return (
              <View key={projection.id} style={{ borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.backgroundAlt, padding: spacing.md, gap: 8 }}>
                <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>{formatMoney(projection.targetSalary)}</Text>
                <Text style={{ color: reached ? palette.success : palette.warning, fontSize: 13 }}>
                  {reached ? `Superada por ${formatMoney(Math.abs(gap))}` : `Faltan ${formatMoney(gap)}`}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: reached ? palette.success : palette.primary, fontSize: 12, fontWeight: '700' }}>
                    {reached ? 'Alcanzada' : 'En progreso'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Pressable onPress={() => handleOpen(projection)}><PencilIcon size={18} color={palette.primary} /></Pressable>
                    <Pressable onPress={() => void removeProjection(projection.id)}><Trash2Icon size={18} color={palette.danger} /></Pressable>
                  </View>
                </View>
              </View>
            )
          })}
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
        title={editId ? 'Editar proyeccion' : 'Agregar proyeccion'}
        description="Define el salario meta que quieres alcanzar."
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button variant="ghost" className="flex-1" onPress={resetForm}><Text>Cancelar</Text></Button>
            <Button className="flex-1" onPress={() => void handleSave()}><Text>Guardar</Text></Button>
          </View>
        }
      >
        <Input keyboardType="numeric" value={targetSalary} onChangeText={setTargetSalary} placeholder="Salario meta" />
      </Dialog>
    </AppFrame>
  )
}
