import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  defaultCategorizationRules,
  type CategorizationRule,
  type CategorizationTarget,
} from '@plata/shared'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AppIcon } from '@/components/icons/AppIcon'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { usePreferencesStore } from '@/store/preferencesStore'

const expenseTargets = [
  ['food', 'Alimentación'],
  ['services', 'Servicios'],
  ['home', 'Hogar'],
  ['gym', 'Deporte'],
  ['health', 'Salud'],
  ['essentials', 'Otros esenciales'],
] as const

const wantTargets = [
  ['subscriptions', 'Suscripciones'],
  ['outings', 'Salidas'],
  ['shopping', 'Compras'],
  ['gaming', 'Gaming'],
  ['selfcare', 'Cuidado personal'],
] as const

function ruleTargetLabel(rule: CategorizationRule) {
  const options = rule.transactionType === 'expense' ? expenseTargets : wantTargets
  const category = options.find(([id]) => id === rule.category)?.[1] ?? rule.category
  return `${category} · ${rule.transactionType === 'expense' ? 'Gasto' : 'Gusto'}`
}

export function AutomationSettings() {
  const userId = useAuthStore((state) => state.user?.id)
  const profileId = userId ?? 'guest'
  const userRules = usePreferencesStore(useShallow((state) => state.categoryRulesByProfile[profileId] ?? []))
  const saveRule = usePreferencesStore((state) => state.saveCategoryRule)
  const removeRule = usePreferencesStore((state) => state.removeCategoryRule)
  const resetAutomation = usePreferencesStore((state) => state.resetAutomationPreferences)
  const [pattern, setPattern] = useState('')
  const [transactionType, setTransactionType] = useState<'expense' | 'want'>('expense')
  const [category, setCategory] = useState('services')

  function handleTypeChange(value: string) {
    const nextType = value === 'want' ? 'want' : 'expense'
    setTransactionType(nextType)
    setCategory(nextType === 'want' ? 'subscriptions' : 'services')
  }

  function handleAddRule() {
    const normalized = pattern.trim().replace(/\s+/g, ' ')
    if (!normalized) {
      toast.error('Escribe el texto que debe reconocer la regla.')
      return
    }
    const target = { transactionType, category } as CategorizationTarget
    saveRule(profileId, {
      id: `rule-${Date.now()}`,
      pattern: normalized,
      ...target,
      source: 'user',
    })
    setPattern('')
    toast.success(`La próxima vez que aparezca “${normalized}”, Plata aplicará esa categoría.`)
  }

  return (
    <section>
      <Card className="border-graphite bg-surface p-6 shadow-vault">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Automatización explicable</p>
            <h2 className="mt-2 text-2xl font-semibold text-on-surface">Reglas de categorización</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-gray">Las reglas del usuario tienen prioridad. Corregir una sugerencia desde el registro rápido también crea una.</p>
          </div>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><AppIcon name="brain" className="size-5" /></div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_170px_auto] sm:items-end">
          <div className="space-y-2"><Label htmlFor="rule-pattern">Si contiene</Label><Input id="rule-pattern" value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="Ej. CUPET" className="border-graphite bg-surface-container-low" /></div>
          <div className="space-y-2"><Label>Tipo</Label><Select value={transactionType} onValueChange={(value) => handleTypeChange(value ?? 'expense')}><SelectTrigger className="border-graphite bg-surface-container-low"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">Gasto</SelectItem><SelectItem value="want">Gusto</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Categoría</Label><Select value={category} onValueChange={(value) => setCategory(value ?? 'services')}><SelectTrigger className="border-graphite bg-surface-container-low"><SelectValue /></SelectTrigger><SelectContent>{(transactionType === 'expense' ? expenseTargets : wantTargets).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div>
          <Button onClick={handleAddRule} className="bg-primary-container text-white"><AppIcon name="check" className="size-4" /> Añadir</Button>
        </div>

        <div className="mt-6 space-y-2">
          {[...defaultCategorizationRules, ...userRules].map((rule) => (
            <div key={rule.id} className="flex items-center gap-3 rounded-2xl border border-graphite bg-abyss/70 p-3">
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-on-surface">Contiene “{rule.pattern}”</p><p className="mt-1 text-xs text-muted-gray">{ruleTargetLabel(rule)}</p></div>
              <Badge variant="secondary" className={rule.source === 'default' ? 'bg-surface-container-high text-muted-gray' : 'bg-success/10 text-success'}>{rule.source === 'default' ? 'Base' : 'Aprendida'}</Badge>
              {rule.source === 'user' ? <Button variant="ghost" size="icon" aria-label={`Eliminar regla ${rule.pattern}`} onClick={() => removeRule(profileId, rule.id)} className="text-muted-gray hover:text-error"><AppIcon name="trash" className="size-4" /></Button> : null}
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={() => { resetAutomation(profileId); toast.success('Reglas aprendidas restauradas.') }} className="mt-4 text-muted-gray"><AppIcon name="rotate" className="size-4" /> Restaurar reglas aprendidas</Button>
      </Card>
    </section>
  )
}
