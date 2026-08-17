import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ArrowDown, ArrowUp, BrainCircuit, LayoutDashboard, Plus, Trash2 } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { dashboardWidgetCatalog, defaultCategorizationRules, defaultDashboardWidgets, type CategorizationTarget } from '@plata/shared'

import { useAuthStore } from '../../store/auth-store'
import { usePreferencesStore } from '../../store/preferences-store'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import { Text } from '../ui/text'

const ArrowUpIcon = ArrowUp as any
const ArrowDownIcon = ArrowDown as any
const BrainCircuitIcon = BrainCircuit as any
const LayoutDashboardIcon = LayoutDashboard as any
const PlusIcon = Plus as any
const Trash2Icon = Trash2 as any

const expenseTargets = [['food', 'Alimentación'], ['services', 'Servicios'], ['home', 'Hogar'], ['gym', 'Deporte'], ['health', 'Salud'], ['essentials', 'Otros']] as const
const wantTargets = [['subscriptions', 'Suscripciones'], ['outings', 'Salidas'], ['shopping', 'Compras'], ['gaming', 'Gaming'], ['selfcare', 'Cuidado']] as const

export function AutomationSettings() {
  const userId = useAuthStore((state) => state.user?.id)
  const profileId = userId ?? 'guest'
  const storedWidgets = usePreferencesStore((state) => state.dashboardWidgetsByProfile[profileId])
  const userRules = usePreferencesStore(useShallow((state) => state.categoryRulesByProfile[profileId] ?? []))
  const toggleWidget = usePreferencesStore((state) => state.toggleDashboardWidget)
  const moveWidget = usePreferencesStore((state) => state.moveDashboardWidget)
  const saveRule = usePreferencesStore((state) => state.saveCategoryRule)
  const removeRule = usePreferencesStore((state) => state.removeCategoryRule)
  const activeWidgets = storedWidgets ?? defaultDashboardWidgets
  const [pattern, setPattern] = useState('')
  const [transactionType, setTransactionType] = useState<'expense' | 'want'>('expense')
  const [category, setCategory] = useState('services')
  const targetOptions = transactionType === 'expense' ? expenseTargets : wantTargets

  function setType(type: 'expense' | 'want') {
    setTransactionType(type)
    setCategory(type === 'expense' ? 'services' : 'subscriptions')
  }

  function addRule() {
    const normalized = pattern.trim().replace(/\s+/g, ' ')
    if (!normalized) return
    const target = { transactionType, category } as CategorizationTarget
    saveRule(profileId, { id: `rule-${Date.now()}`, pattern: normalized, ...target, source: 'user' })
    setPattern('')
  }

  return (
    <View className="gap-4">
      <Card>
        <CardHeader className="flex-row items-start gap-3">
          <View className="size-10 items-center justify-center rounded-2xl bg-primary/15"><LayoutDashboardIcon size={18} color="#8b5cf6" /></View>
          <View className="flex-1"><CardTitle>Panel personalizable</CardTitle><CardDescription>Elige y ordena lo que aparece primero en tu resumen.</CardDescription></View>
        </CardHeader>
        <CardContent className="gap-2">
          {dashboardWidgetCatalog.map((widget) => {
            const enabled = activeWidgets.includes(widget.id)
            const position = activeWidgets.indexOf(widget.id)
            return (
              <View key={widget.id} className="flex-row items-center gap-2 rounded-xl border border-border bg-secondary/40 p-3">
                <View className="flex-1"><Text className="text-sm font-semibold">{widget.label}</Text><Text className="text-muted-foreground mt-1 text-xs" numberOfLines={1}>{widget.description}</Text></View>
                {enabled ? <View className="flex-row"><Button variant="ghost" size="icon" disabled={position === 0} onPress={() => moveWidget(profileId, widget.id, -1)}><ArrowUpIcon size={14} color="#8b5cf6" /></Button><Button variant="ghost" size="icon" disabled={position === activeWidgets.length - 1} onPress={() => moveWidget(profileId, widget.id, 1)}><ArrowDownIcon size={14} color="#8b5cf6" /></Button></View> : null}
                <Switch checked={enabled} onCheckedChange={() => toggleWidget(profileId, widget.id)} />
              </View>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start gap-3">
          <View className="size-10 items-center justify-center rounded-2xl bg-primary/15"><BrainCircuitIcon size={18} color="#8b5cf6" /></View>
          <View className="flex-1"><CardTitle>Reglas de categorización</CardTitle><CardDescription>Automatización visible y corregible, sin un modelo costoso.</CardDescription></View>
        </CardHeader>
        <CardContent className="gap-3">
          <Input value={pattern} onChangeText={setPattern} placeholder="Si contiene… Ej. CUPET" />
          <View className="flex-row gap-2"><Button variant={transactionType === 'expense' ? 'default' : 'outline'} className="flex-1" onPress={() => setType('expense')}><Text>Gasto</Text></Button><Button variant={transactionType === 'want' ? 'default' : 'outline'} className="flex-1" onPress={() => setType('want')}><Text>Gusto</Text></Button></View>
          <View className="flex-row flex-wrap gap-2">{targetOptions.map(([id, label]) => <Pressable key={id} onPress={() => setCategory(id)} className={`rounded-full px-3 py-2 ${category === id ? 'bg-primary' : 'bg-secondary'}`}><Text className={`text-xs font-semibold ${category === id ? 'text-primary-foreground' : ''}`}>{label}</Text></Pressable>)}</View>
          <Button onPress={addRule} disabled={!pattern.trim()}><PlusIcon size={16} color="#ffffff" /><Text>Añadir regla</Text></Button>
          {[...defaultCategorizationRules, ...userRules].map((rule) => <View key={rule.id} className="flex-row items-center gap-2 rounded-xl border border-border p-3"><View className="flex-1"><Text className="text-sm font-semibold">Contiene “{rule.pattern}”</Text><Text className="text-muted-foreground mt-1 text-xs">{rule.category} · {rule.transactionType === 'expense' ? 'Gasto' : 'Gusto'}</Text></View>{rule.source === 'user' ? <Button variant="ghost" size="icon" onPress={() => removeRule(profileId, rule.id)}><Trash2Icon size={15} color="#fb7185" /></Button> : <Text className="text-muted-foreground text-[10px] uppercase">Base</Text>}</View>)}
        </CardContent>
      </Card>
    </View>
  )
}
