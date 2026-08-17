import { useMemo, useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ArrowRight, Check, ReceiptText, Sparkles } from 'lucide-react'
import {
  buildExpenseDescription,
  buildWantDescription,
  createLearnedCategorizationRule,
  findCategorizationRule,
  parseExpenseDescription,
  parseWantDescription,
  type CategorizationRule,
  type CategorizationTarget,
  type ExpenseCategory,
  type Transaction,
  type WantCategory,
} from '@plata/shared'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFinanceStore } from '@/store/financeStore'
import { formatMoney, useCurrencyInput } from '@/lib/currency'
import { getTodayDateKey } from '@/lib/date'
import { useAuthStore } from '@/store/authStore'
import { usePreferencesStore } from '@/store/preferencesStore'

const targets: Array<{ value: string; label: string; target: CategorizationTarget }> = [
  { value: 'expense:food', label: 'Alimentación · Gasto', target: { transactionType: 'expense', category: 'food' } },
  { value: 'expense:services', label: 'Servicios · Gasto', target: { transactionType: 'expense', category: 'services' } },
  { value: 'expense:home', label: 'Hogar · Gasto', target: { transactionType: 'expense', category: 'home' } },
  { value: 'expense:gym', label: 'Deporte · Gasto', target: { transactionType: 'expense', category: 'gym' } },
  { value: 'expense:health', label: 'Salud · Gasto', target: { transactionType: 'expense', category: 'health' } },
  { value: 'expense:essentials', label: 'Esenciales · Gasto', target: { transactionType: 'expense', category: 'essentials' } },
  { value: 'want:subscriptions', label: 'Suscripciones · Gusto', target: { transactionType: 'want', category: 'subscriptions' } },
  { value: 'want:outings', label: 'Salidas · Gusto', target: { transactionType: 'want', category: 'outings' } },
  { value: 'want:shopping', label: 'Compras · Gusto', target: { transactionType: 'want', category: 'shopping' } },
]

function parseQuickEntry(value: string) {
  const normalized = value.trim()
  const amountMatch = normalized.match(/(?:\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*$/)
  const amount = amountMatch ? Number(amountMatch[1].replace(',', '.')) : 0
  const itemName = amountMatch ? normalized.slice(0, amountMatch.index).trim().replace(/[-,:]+$/, '').trim() : normalized
  return { amount: Number.isFinite(amount) ? amount : 0, itemName }
}

function targetKey(target: CategorizationTarget) {
  return `${target.transactionType}:${target.category}`
}

function suggestCategory(itemName: string, recentTransactions: Transaction[], userRules: CategorizationRule[]) {
  const rule = findCategorizationRule(itemName, userRules)
  if (rule) return { target: { transactionType: rule.transactionType, category: rule.category } as CategorizationTarget, rule }

  const normalized = itemName.toLocaleLowerCase('es')
  const recentMatch = recentTransactions.find((transaction) => {
    const parsed = transaction.type === 'want'
      ? parseWantDescription(transaction.description)
      : parseExpenseDescription(transaction.description)
    return parsed.itemName.toLocaleLowerCase('es') === normalized
  })
  if (recentMatch?.type === 'want') {
    return { target: { transactionType: 'want', category: parseWantDescription(recentMatch.description).category } as CategorizationTarget, rule: null }
  }
  if (recentMatch?.type === 'expense') {
    return { target: { transactionType: 'expense', category: parseExpenseDescription(recentMatch.description).category } as CategorizationTarget, rule: null }
  }
  return { target: { transactionType: 'expense', category: 'essentials' } as CategorizationTarget, rule: null }
}

export function QuickExpenseEntry() {
  const navigate = useNavigate()
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const transactions = useFinanceStore((state) => state.transactions)
  const userId = useAuthStore((state) => state.user?.id)
  const profileId = userId ?? 'guest'
  const userRules = usePreferencesStore(useShallow((state) => state.categoryRulesByProfile[profileId] ?? []))
  const saveCategoryRule = usePreferencesStore((state) => state.saveCategoryRule)
  const moneyInput = useCurrencyInput()
  const recentTransactions = useMemo(
    () => transactions
      .filter((transaction) => transaction.type === 'expense' || transaction.type === 'want')
      .slice(0, 40),
    [transactions],
  )
  const [entry, setEntry] = useState('')
  const [selectedTargetKey, setSelectedTargetKey] = useState('expense:essentials')
  const [targetWasChanged, setTargetWasChanged] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const parsed = useMemo(() => parseQuickEntry(entry), [entry])
  const suggestion = useMemo(
    () => suggestCategory(parsed.itemName, recentTransactions, userRules),
    [parsed.itemName, recentTransactions, userRules],
  )
  const activeTargetKey = targetWasChanged ? selectedTargetKey : targetKey(suggestion.target)
  const activeTarget = targets.find((item) => item.value === activeTargetKey)?.target ?? suggestion.target
  const activeCategoryLabel = targets.find((item) => item.value === activeTargetKey)?.label ?? 'Esenciales · Gasto'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!parsed.itemName || parsed.amount <= 0 || isSaving) {
      toast.error('Escribe un concepto y un monto. Ejemplo: Supermercado 42.50')
      return
    }

    setIsSaving(true)
    try {
      const amountInUsd = moneyInput.toUsd(parsed.amount)
      await addTransaction({
        amount: amountInUsd,
        type: activeTarget.transactionType,
        description: activeTarget.transactionType === 'want'
          ? buildWantDescription(activeTarget.category as WantCategory, parsed.itemName, 'checked')
          : buildExpenseDescription(activeTarget.category as ExpenseCategory, parsed.itemName, 'checked'),
        date: getTodayDateKey(),
      })
      if (targetWasChanged && activeTargetKey !== targetKey(suggestion.target)) {
        const learnedRule = createLearnedCategorizationRule(parsed.itemName, activeTarget)
        if (learnedRule) saveCategoryRule(profileId, learnedRule)
      }
      toast.success(`${parsed.itemName} registrado por ${formatMoney(amountInUsd)}.`)
      setEntry('')
      setSelectedTargetKey('expense:essentials')
      setTargetWasChanged(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el gasto.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-graphite bg-abyss/75 p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
            <ReceiptText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="quick-expense" className="sr-only">Registrar gasto rapido</label>
            <Input
              id="quick-expense"
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder={`Ej. Supermercado 42.50 ${moneyInput.currency.code}`}
              autoComplete="off"
              inputMode="text"
              className="h-11 border-0 bg-transparent px-0 text-base text-on-surface shadow-none placeholder:text-muted-gray focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={activeTargetKey}
            onValueChange={(value) => {
              setSelectedTargetKey(value ?? 'expense:essentials')
              setTargetWasChanged(true)
            }}
          >
            <SelectTrigger aria-label="Categoria del gasto" className="h-10 min-w-36 border-graphite bg-surface-container-low text-on-surface">
              <SelectValue>{activeCategoryLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent className="border-graphite bg-surface">
              {targets.map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            loading={isSaving}
            disabled={isSaving || !parsed.itemName || parsed.amount <= 0}
            className="h-10 bg-primary-container px-4 text-white hover:brightness-110"
          >
            <Check className="size-4" />
            <span className="hidden sm:inline">Registrar</span>
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-graphite/80 pt-3 text-xs text-muted-gray sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span>Escribe concepto y monto; Enter confirma.</span>
          {parsed.amount > 0 ? (
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {formatMoney(parsed.amount)} · {activeCategoryLabel}
            </Badge>
          ) : null}
          {parsed.itemName && suggestion.rule ? (
            <Badge variant="secondary" className="bg-success/10 text-success">
              Regla: contiene “{suggestion.rule.pattern}”
            </Badge>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/expenses')} className="h-7 w-fit px-2 text-muted-gray hover:text-on-surface">
          Formulario completo <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </form>
  )
}
