import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, Check, ReceiptText, Sparkles } from 'lucide-react'
import { buildExpenseDescription, parseExpenseDescription, type ExpenseCategory } from '@plata/shared'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFinanceStore } from '@/store/financeStore'

const categories = [
  { value: 'food', label: 'Alimentacion' },
  { value: 'home', label: 'Hogar' },
  { value: 'gym', label: 'Deporte' },
  { value: 'health', label: 'Salud' },
  { value: 'essentials', label: 'Esenciales' },
] satisfies Array<{ value: ExpenseCategory; label: string }>

const categoryKeywords: Array<{ category: ExpenseCategory; words: string[] }> = [
  { category: 'food', words: ['mercado', 'supermercado', 'comida', 'cafe', 'almuerzo', 'cena', 'pan', 'pollo'] },
  { category: 'home', words: ['alquiler', 'renta', 'casa', 'luz', 'agua', 'internet', 'detergente', 'limpieza'] },
  { category: 'health', words: ['farmacia', 'medicina', 'doctor', 'consulta', 'salud'] },
  { category: 'gym', words: ['gym', 'gimnasio', 'deporte', 'entrenamiento'] },
]

function todayKey() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function parseQuickEntry(value: string) {
  const normalized = value.trim()
  const amountMatch = normalized.match(/(?:\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*$/)
  const amount = amountMatch ? Number(amountMatch[1].replace(',', '.')) : 0
  const itemName = amountMatch ? normalized.slice(0, amountMatch.index).trim().replace(/[-,:]+$/, '').trim() : normalized
  return { amount: Number.isFinite(amount) ? amount : 0, itemName }
}

function suggestCategory(itemName: string, recentDescriptions: Array<string | undefined>): ExpenseCategory {
  const normalized = itemName.toLocaleLowerCase('es')
  const keywordMatch = categoryKeywords.find(({ words }) => words.some((word) => normalized.includes(word)))
  if (keywordMatch) return keywordMatch.category

  const recentMatch = recentDescriptions.find((description) => {
    const parsed = parseExpenseDescription(description)
    return parsed.itemName.toLocaleLowerCase('es') === normalized
  })
  return recentMatch ? parseExpenseDescription(recentMatch).category : 'essentials'
}

export function QuickExpenseEntry() {
  const navigate = useNavigate()
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const transactions = useFinanceStore((state) => state.transactions)
  const recentDescriptions = useMemo(
    () => transactions
      .filter((transaction) => transaction.type === 'expense')
      .slice(0, 40)
      .map((transaction) => transaction.description),
    [transactions],
  )
  const [entry, setEntry] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('essentials')
  const [categoryWasChanged, setCategoryWasChanged] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const parsed = useMemo(() => parseQuickEntry(entry), [entry])
  const suggestedCategory = useMemo(
    () => suggestCategory(parsed.itemName, recentDescriptions),
    [parsed.itemName, recentDescriptions],
  )
  const activeCategory = categoryWasChanged ? category : suggestedCategory
  const activeCategoryLabel = categories.find((item) => item.value === activeCategory)?.label ?? 'Esenciales'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!parsed.itemName || parsed.amount <= 0 || isSaving) {
      toast.error('Escribe un concepto y un monto. Ejemplo: Supermercado 42.50')
      return
    }

    setIsSaving(true)
    try {
      await addTransaction({
        amount: parsed.amount,
        type: 'expense',
        description: buildExpenseDescription(activeCategory, parsed.itemName, 'checked'),
        date: todayKey(),
      })
      toast.success(`${parsed.itemName} registrado por $${parsed.amount.toLocaleString()}.`)
      setEntry('')
      setCategory('essentials')
      setCategoryWasChanged(false)
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
              placeholder="Ej. Supermercado 42.50"
              autoComplete="off"
              inputMode="text"
              className="h-11 border-0 bg-transparent px-0 text-base text-on-surface shadow-none placeholder:text-muted-gray focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={activeCategory}
            onValueChange={(value) => {
              setCategory(value as ExpenseCategory)
              setCategoryWasChanged(true)
            }}
          >
            <SelectTrigger aria-label="Categoria del gasto" className="h-10 min-w-36 border-graphite bg-surface-container-low text-on-surface">
              <SelectValue>{activeCategoryLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent className="border-graphite bg-surface">
              {categories.map((item) => (
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
              ${parsed.amount.toLocaleString()} · {activeCategoryLabel}
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
