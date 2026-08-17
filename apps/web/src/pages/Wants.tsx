import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { buildWantTransferSavingDescription, createLearnedCategorizationRule, findCategorizationRule, type ReceiptOCRLineItem, type ReceiptOCRParsedDraft } from '@plata/shared'
import { Clapperboard, Gamepad2, Heart, LockKeyhole, Pencil, Plus, ShoppingBag, Sparkles, Ticket, Trash2, type LucideIcon } from 'lucide-react'
import { useFinanceStore } from '@/store/financeStore'
import { buildWantDescription, createCustomWantCategory, getPlannedWantTotal, getWantCategoryLabel, parseWantDescription, type WantBuiltInCategory, type WantCategory } from '@/lib/want-utils'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'
import { formatMoney, useCurrencyInput } from '@/lib/currency'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ExportExcelButton } from '@/components/reports/ExportExcelButton'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePickerField } from '@/components/ui/date-picker-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { exportWantsReport } from '@/lib/reportExports'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePreferencesStore } from '@/store/preferencesStore'
import { PlanningHistoryPicker } from '@/components/planning/PlanningHistoryPicker'
import { PlanningListHistory } from '@/components/planning/PlanningListHistory'
import { buildPlanningHistorySuggestions, buildReusablePlanningListDrafts } from '@/lib/productivity'
import { toast } from 'sonner'
import { getTodayDateKey } from '@/lib/date'
import { ReceiptOcrPanel } from '@/components/ocr/ReceiptOcrPanel'
import { useAuthStore } from '@/store/authStore'
import { WantCelebration } from '@/components/celebration/WantCelebration'

interface WantFormState {
  amount: string
  itemName: string
  category: WantCategory
  date: string
}

interface WantViewItem {
  id: string
  amount: number
  date: string
  itemName: string
  category: WantCategory
  status: 'pending' | 'checked'
}

type WantCategoryMeta = { label: string; hint: string; icon: LucideIcon; accent: string; badge: string; stroke: string }

const CATEGORY_META: Record<WantBuiltInCategory, WantCategoryMeta> = {
  outings: {
    label: 'Salidas',
    hint: 'Cenas, cafes, paseos y antojos fuera de casa.',
    icon: Ticket,
    accent: 'text-secondary',
    badge: 'bg-secondary/15 text-secondary',
    stroke: '#c084fc',
  },
  shopping: {
    label: 'Compras',
    hint: 'Ropa, gadgets, accesorios y caprichos personales.',
    icon: ShoppingBag,
    accent: 'text-pink-300',
    badge: 'bg-pink-400/15 text-pink-300',
    stroke: '#f9a8d4',
  },
  gaming: {
    label: 'Gaming',
    hint: 'Juegos, perifericos, creditos y entretenimiento digital.',
    icon: Gamepad2,
    accent: 'text-cyan-300',
    badge: 'bg-cyan-400/15 text-cyan-300',
    stroke: '#67e8f9',
  },
  subscriptions: {
    label: 'Suscripciones',
    hint: 'Streaming, apps premium y servicios que disfrutas.',
    icon: Clapperboard,
    accent: 'text-amber-300',
    badge: 'bg-amber-400/15 text-amber-300',
    stroke: '#fcd34d',
  },
  selfcare: {
    label: 'Autocuidado',
    hint: 'Spa, skincare, hobbies y pequenos premios personales.',
    icon: Sparkles,
    accent: 'text-emerald-300',
    badge: 'bg-emerald-400/15 text-emerald-300',
    stroke: '#6ee7b7',
  },
}

function getCategoryMeta(category: WantCategory): WantCategoryMeta {
  if (category in CATEGORY_META) return CATEGORY_META[category as WantBuiltInCategory]

  return {
    label: getWantCategoryLabel(category) ?? 'Categoría personalizada',
    hint: 'Una categoría creada por ti.',
    icon: Heart,
    accent: 'text-fuchsia-300',
    badge: 'bg-fuchsia-400/15 text-fuchsia-300',
    stroke: '#e879f9',
  }
}

function HandDrawnStrike({ color }: { color: string }) {
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 360 120"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M18 34
           C 20 20, 38 18, 50 30
           C 58 40, 46 54, 30 50
           C 14 46, 10 28, 18 34
           M 30 38
           C 64 30, 96 18, 130 28
           S 196 48, 230 28
           S 294 18, 336 42"
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: drawn ? 0 : 1,
          transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </svg>
  )
}

function SparkBurst({ color }: { color: string }) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setActive(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20 flex size-10 items-center justify-center">
      {Array.from({ length: 8 }, (_, index) => {
        const rotation = index * 45
        const length = index % 2 === 0 ? 12 : 8

        return (
          <span
            key={rotation}
            className="absolute left-1/2 top-1/2 block h-0.5 rounded-full"
            style={{
              width: `${length}px`,
              backgroundColor: color,
              transform: `translate(-50%, -50%) rotate(${rotation}deg) translateX(${active ? 16 : 3}px) scaleX(${active ? 1 : 0.2})`,
              opacity: active ? 0 : 0.95,
              transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 520ms ease-out',
              transitionDelay: `${index * 18}ms`,
            }}
          />
        )
      })}
    </div>
  )
}

export default function Wants() {
  const transactions = useFinanceStore((state) => state.transactions)
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const updateTransaction = useFinanceStore((state) => state.updateTransaction)
  const removeTransaction = useFinanceStore((state) => state.removeTransaction)
  const monthlyPlanningHistory = useFinanceStore((state) => state.monthlyPlanningHistory)
  const overview = useMonthlyOverview()
  const moneyInput = useCurrencyInput()
  const formula = usePreferencesStore((state) => state.formula)
  const profileId = useAuthStore((state) => state.user?.id) ?? 'guest'
  const userRules = usePreferencesStore(useShallow((state) => state.categoryRulesByProfile[profileId] ?? []))
  const saveCategoryRule = usePreferencesStore((state) => state.saveCategoryRule)
  const isWantsDisabled = formula.wants === 0
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [sparkBursts, setSparkBursts] = useState<Record<string, number>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
const [transferAmount, setTransferAmount] = useState('')
  const [transferError, setTransferError] = useState<string | null>(null)
  const [restoringListId, setRestoringListId] = useState<string | null>(null)
  const [customCategoryName, setCustomCategoryName] = useState('')
  const categoryWasChanged = useRef(false)
  const [celebration, setCelebration] = useState<{ id: number } | null>(null)
  const [form, setForm] = useState<WantFormState>({
    amount: '',
    itemName: '',
    category: 'outings',
    date: getTodayDateKey(),
  })

  useEffect(() => {
    if (!isWantsDisabled) return
    setOpen(false)
    setTransferOpen(false)
    setEditId(null)
    setFormError(null)
    setCustomCategoryName('')
    setTransferError(null)
  }, [isWantsDisabled])

  function resetForm() {
    categoryWasChanged.current = false
    setForm({
      amount: '',
      itemName: '',
      category: 'outings',
      date: getTodayDateKey(),
    })
    setEditId(null)
    setFormError(null)
  }

  function handleOpen(entry?: (typeof transactions)[number]) {
    if (isWantsDisabled) return
    setCustomCategoryName('')
    categoryWasChanged.current = false

    if (entry) {
      const parsed = parseWantDescription(entry.description)
      setEditId(entry.id)
      setForm({
        amount: moneyInput.fromUsd(entry.amount),
        itemName: parsed.itemName,
        category: parsed.category,
        date: entry.date,
      })
    } else {
      resetForm()
    }
    setOpen(true)
  }

  const wantItems = useMemo<WantViewItem[]>(() => {
    return transactions
      .filter((transaction) => transaction.type === 'want')
      .map((transaction) => {
        const parsed = parseWantDescription(transaction.description)
        return {
          id: transaction.id,
          amount: transaction.amount,
          date: transaction.date,
          itemName: parsed.itemName,
          category: parsed.category,
          status: parsed.status,
        }
      })
  }, [transactions])

  const wantCategories = (() => {
    const categories = new Set<WantCategory>(Object.keys(CATEGORY_META) as WantBuiltInCategory[])
    wantItems.forEach((item) => categories.add(item.category))
    categories.add(form.category)
    return Array.from(categories)
  })()

  const groupedWants = wantCategories.map((key) => {
      const meta = getCategoryMeta(key)
      const items = wantItems
        .filter((item) => item.category === key)
        .sort((a, b) => a.itemName.localeCompare(b.itemName))

      const total = items.reduce((sum, item) => sum + item.amount, 0)
      const completed = items.filter((item) => item.status === 'checked').length

      return {
        key,
        meta,
        items,
        total,
        completed,
      }
    })
  const historySuggestions = useMemo(
    () => buildPlanningHistorySuggestions({
      transactions,
      history: monthlyPlanningHistory,
      type: 'want',
    }),
    [monthlyPlanningHistory, transactions],
  )

  const wantCount = wantItems.length
  const checkedCount = wantItems.filter((item) => item.status === 'checked').length
  const pendingCount = wantItems.filter((item) => item.status === 'pending').length
  const currentItemAmount = editId ? wantItems.find((item) => item.id === editId)?.amount ?? 0 : 0
  const plannedTotal = getPlannedWantTotal(transactions) - currentItemAmount
  const availableToPlan = Math.max(0, overview.budgetWants - plannedTotal)
  const pct = overview.budgetWants > 0 ? Math.min(100, Math.round((overview.totalWants / overview.budgetWants) * 100)) : 0
  const remaining = overview.budgetWants - overview.totalWants
  const typedAmount = moneyInput.toUsd(form.amount)
  const liveBudgetError = !form.amount
    ? null
    : !Number.isFinite(typedAmount) || typedAmount <= 0
      ? 'El precio debe ser mayor que cero.'
      : typedAmount > availableToPlan
        ? `Te pasas por ${formatMoney(typedAmount - availableToPlan)}. Solo te quedan ${formatMoney(availableToPlan)} disponibles para planificar.`
        : plannedTotal + typedAmount > overview.budgetWants
          ? `No puedes agregar este gusto porque la lista subiria a ${formatMoney(plannedTotal + typedAmount)} y tu limite es ${formatMoney(overview.budgetWants)}.`
          : null

  function handleCreateCategory() {
    const category = createCustomWantCategory(customCategoryName)
    if (!category) {
      setFormError('Escribe un nombre para la categoría.')
      return
    }

    setFormError(null)
    setForm((current) => ({ ...current, category }))
    categoryWasChanged.current = true
setCustomCategoryName('')
  }

  function applyReceiptDraft(draft: ReceiptOCRParsedDraft) {
    setFormError(null)
    setForm((current) => ({
      ...current,
      amount: draft.amount !== undefined ? String(draft.amount) : current.amount,
      itemName: draft.suggestedName ?? current.itemName,
      date: draft.date ?? current.date,
      category: !categoryWasChanged.current && draft.suggestedCategory
        ? (draft.suggestedCategory as WantCategory)
        : current.category,
    }))
  }

  async function handleAddReceiptItems(items: ReceiptOCRLineItem[], date?: string) {
    if (items.length === 0 || isSaving) return
    if (isWantsDisabled) {
      toast.error('La sección Gustos está desactivada porque su porcentaje es 0%.')
      return
    }
    const total = items.reduce((sum, item) => sum + moneyInput.toUsd(item.price), 0)
    if (total > availableToPlan) {
      toast.error(`Los productos suman ${formatMoney(total)} y solo tienes ${formatMoney(availableToPlan)} disponibles para planificar.`)
      return
    }
    if (plannedTotal + total > overview.budgetWants) {
      toast.error(`No puedes agregarlos porque la lista subiria a ${formatMoney(plannedTotal + total)} y tu limite es ${formatMoney(overview.budgetWants)}.`)
      return
    }
    setIsSaving(true)
    try {
      const targetDate = date ?? getTodayDateKey()
      for (const item of items) {
        const rule = findCategorizationRule(item.name, userRules)
        const category = rule && rule.transactionType === 'want'
          ? (rule.category as WantCategory)
          : (item.category as WantCategory | undefined) ?? 'outings'
        await addTransaction({
          amount: moneyInput.toUsd(item.price),
          type: 'want',
          description: buildWantDescription(category, item.name.trim(), 'pending'),
          date: targetDate,
        })
      }
      toast.success(`Se agregaron ${items.length} producto${items.length === 1 ? '' : 's'} del recibo.`)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSave() {
    if (!form.amount || !form.itemName || isSaving) return
    if (isWantsDisabled) {
      setFormError('La sección Gustos está desactivada porque su porcentaje es 0%.')
      return
    }

    const nextAmount = moneyInput.toUsd(form.amount)
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setFormError('El precio debe ser mayor que cero.')
      return
    }

    if (nextAmount > availableToPlan) {
      setFormError(`Ese precio supera el disponible para planificar: ${formatMoney(availableToPlan)}.`)
      return
    }

    if (plannedTotal + nextAmount > overview.budgetWants) {
      setFormError(`No puedes agregarlo porque la lista total se iria a ${formatMoney(plannedTotal + nextAmount)} y tu limite es ${formatMoney(overview.budgetWants)}.`)
      return
    }

    const currentStatus = editId
      ? wantItems.find((item) => item.id === editId)?.status ?? 'pending'
      : 'pending'

    const data = {
      amount: nextAmount,
      type: 'want' as const,
      description: buildWantDescription(form.category, form.itemName, currentStatus),
      date: form.date || new Date().toISOString().slice(0, 10),
    }

    setIsSaving(true)

    try {
      if (editId) {
        await updateTransaction(editId, data)
      } else {
        await addTransaction(data)
      }

      if (categoryWasChanged.current) {
        const suggested = findCategorizationRule(form.itemName, userRules)
        if (!suggested || suggested.transactionType !== 'want' || suggested.category !== form.category) {
          const learned = createLearnedCategorizationRule(form.itemName, { transactionType: 'want', category: form.category })
          if (learned) saveCategoryRule(profileId, learned)
        }
      }

      resetForm()
      setOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReuseList(entry: typeof monthlyPlanningHistory[number]) {
    if (isWantsDisabled || restoringListId) return
    const drafts = buildReusablePlanningListDrafts(entry, 'want', transactions)

    if (drafts.length === 0) {
      toast.info('Todos los artículos de esa lista ya están en tus gustos actuales.')
      return
    }

    const total = drafts.reduce((sum, draft) => sum + draft.amount, 0)
    if (total > availableToPlan) {
      toast.error(`La lista necesita ${formatMoney(total)} y solo tienes ${formatMoney(availableToPlan)} disponibles.`)
      return
    }

    setRestoringListId(entry.id)
    try {
      await Promise.all(drafts.map((draft) => addTransaction(draft)))
      toast.success(`Se reutilizaron ${drafts.length} artículo(s) de ${entry.label}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo reutilizar la lista.')
    } finally {
      setRestoringListId(null)
    }
  }

  async function toggleChecked(item: WantViewItem) {
    if (isWantsDisabled) return

    const nextStatus = item.status === 'checked' ? 'pending' : 'checked'

    if (nextStatus === 'checked') {
      setSparkBursts((bursts) => ({
        ...bursts,
        [item.id]: (bursts[item.id] ?? 0) + 1,
      }))
      setCelebration((current) => (current ? { id: current.id + 1 } : { id: 1 }))
    }

    await updateTransaction(item.id, {
      amount: item.amount,
      type: 'want',
      date: item.date,
      description: buildWantDescription(item.category, item.itemName, nextStatus),
    })
  }

  async function handleTransferRemainingToSavings() {
    if (isTransferring) return
    if (isWantsDisabled) return

    const nextAmount = moneyInput.toUsd(transferAmount)
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setTransferError('El monto debe ser mayor que cero.')
      return
    }
    if (nextAmount > remaining) {
      setTransferError(`Solo puedes mover hasta ${formatMoney(Math.max(0, remaining))}.`)
      return
    }

    setIsTransferring(true)

    try {
      await addTransaction({
        amount: nextAmount,
        type: 'saving',
        description: buildWantTransferSavingDescription(),
        date: new Date().toISOString().slice(0, 10),
      })
      setTransferOpen(false)
      setTransferAmount('')
      setTransferError(null)
    } finally {
      setIsTransferring(false)
    }
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      await exportWantsReport(transactions)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-on-surface md:text-[36px]">Gustos</h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-gray">
            Convierte los gustos en una lista organizada por categorias. Cada producto sigue guardandose en Prisma como una transaccion de gusto.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:w-auto">
          <ExportExcelButton loading={isExporting} onClick={handleExport} className="w-full sm:w-auto bg-surface-container-high text-on-surface hover:bg-surface-container-higher" />
          <Button
            disabled={isWantsDisabled}
            onClick={() => handleOpen()}
            className="w-full bg-primary-container text-white shadow-vault hover:bg-primary-container/80 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {isWantsDisabled ? <LockKeyhole className="size-4" /> : <Plus className="size-4" />}
            {isWantsDisabled ? 'Gustos desactivados' : 'Agregar gusto'}
          </Button>
        </div>
      </header>

      {isWantsDisabled ? (
        <Card className="border-warning/30 bg-warning/10 p-4 shadow-vault-sm">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 size-5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-on-surface">Sección Gustos desactivada</p>
              <p className="mt-1 text-sm text-muted-gray">
                La fórmula asigna 0% a Gustos. El presupuesto se mantiene en {formatMoney(0)} y no se pueden agregar, editar ni marcar gustos hasta asignarle un porcentaje mayor que cero.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="relative overflow-hidden rounded-xl bg-surface p-4 shadow-vault sm:p-6">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-full bg-secondary/10 blur-2xl" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div>
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-gray">Presupuesto mensual ({formula.wants}%)</p>
              <Badge variant="secondary" className={`w-fit ${isWantsDisabled ? 'bg-warning/10 text-warning' : remaining >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                {isWantsDisabled
                  ? 'Sección desactivada'
                  : remaining >= 0
                    ? `${formatMoney(remaining)} disponible`
                    : `${formatMoney(Math.abs(remaining))} excedido`}
              </Badge>
            </div>
            <h2 className="mb-3 break-words text-[28px] font-semibold leading-tight text-on-surface sm:text-[30px]">
              {formatMoney(overview.totalWants)} <span className="text-base font-normal text-muted-gray">/ {formatMoney(overview.budgetWants)}</span>
            </h2>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div className="h-full rounded-full bg-secondary transition-all duration-1000" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                variant="secondary"
                disabled={isWantsDisabled || remaining <= 0}
                onClick={() => {
                  setTransferAmount(String(Math.max(0, remaining)))
                  setTransferError(null)
                  setTransferOpen(true)
                }}
                className="w-full bg-tertiary-container text-white hover:bg-tertiary-container/80 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                Pasar dinero a ahorros
              </Button>
              <p className="text-xs leading-6 text-muted-gray">
                Si ya no vas a usar ese resto para gustos este mes, puedes moverlo al ahorro.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-medium-gray">Productos</p>
              <p className="mt-2 text-2xl font-semibold text-on-surface">{wantCount}</p>
              <p className="mt-1 text-xs text-muted-gray">Caprichos guardados</p>
            </Card>
            <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-medium-gray">Check hechos</p>
              <p className="mt-2 text-2xl font-semibold text-on-surface">{checkedCount}</p>
              <p className="mt-1 text-xs text-muted-gray">{pendingCount} pendientes por activar</p>
            </Card>
          </div>
        </div>
      </div>

      <PlanningListHistory
        history={monthlyPlanningHistory}
        type="want"
        restoringId={restoringListId}
        disabled={isWantsDisabled}
        onReuse={(entry) => void handleReuseList(entry)}
      />

      {wantItems.length === 0 ? (
        <Card className="border-0 bg-surface shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-gray">
            <Heart className="size-8" />
            <p>No hay gustos registrados</p>
            <Button disabled={isWantsDisabled} variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface hover:bg-surface-container-higher disabled:cursor-not-allowed disabled:opacity-40">
              Crear tu primera lista
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {groupedWants.map(({ key, meta, items, total, completed }) => {
            const Icon = meta.icon

            return (
              <Card key={key} className="border-graphite bg-surface shadow-vault">
                <div className="flex flex-col gap-4 border-b border-graphite p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-11 items-center justify-center rounded-xl bg-abyss ${meta.accent} shadow-vault-sm`}>
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-on-surface">{meta.label}</h3>
                        <p className="text-xs leading-5 text-muted-gray">{meta.hint}</p>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className={`w-fit ${meta.badge}`}>
                    {items.length} items
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-3 border-b border-graphite px-4 py-4 sm:grid-cols-2 sm:px-5">
                  <div className="rounded-xl bg-abyss p-3 shadow-vault-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-medium-gray">Total</p>
                    <p className="mt-2 text-lg font-semibold text-on-surface">{formatMoney(total)}</p>
                  </div>
                  <div className="rounded-xl bg-abyss p-3 shadow-vault-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-medium-gray">Completados</p>
                    <p className="mt-2 text-lg font-semibold text-on-surface">{completed}/{items.length}</p>
                  </div>
                </div>

                <ScrollArea className="h-[360px]">
                  <div className="space-y-3 p-3 sm:p-4">
                    {items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-graphite bg-abyss/70 p-5 text-sm text-muted-gray">
                        Aun no hay gustos en esta categoria.
                      </div>
                    ) : (
                      items.map((item) => {
                        const isChecked = item.status === 'checked'

                        return (
                          <div
                            key={item.id}
                            className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 ${isChecked
                              ? 'border-secondary/30 bg-abyss/90 opacity-80'
                              : 'border-graphite bg-abyss hover:border-outline-variant'
                              }`}
                          >
                            {isChecked ? <HandDrawnStrike color={meta.stroke} /> : null}

                            <div className="relative z-10 flex items-start gap-3">
                              <div className="relative mt-0.5 shrink-0">
                                {sparkBursts[item.id] && isChecked ? <SparkBurst key={`${item.id}-${sparkBursts[item.id]}`} color={meta.stroke} /> : null}
                                <Checkbox
                                  checked={isChecked}
                                  disabled={isWantsDisabled}
                                  onCheckedChange={() => void toggleChecked(item)}
                                  aria-label={`Marcar ${item.itemName}`}
                                  className="gap-0"
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                  <div>
                                    <p className={`text-sm font-medium ${isChecked ? 'text-muted-gray line-through' : 'text-on-surface'}`}>
                                      {item.itemName}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-gray">{item.date}</p>
                                  </div>
                                  <span className={`text-sm font-semibold ${isChecked ? 'text-muted-gray' : 'text-secondary'} sm:text-right`}>
                                    {formatMoney(item.amount)}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-xs leading-5 text-muted-gray">
                                    {isChecked ? 'Marcado como disfrutado' : 'Pendiente por comprar'}
                                  </span>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={isWantsDisabled || isChecked}
                                      className="text-muted-gray hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                                      onClick={() => handleOpen(transactions.find((entry) => entry.id === item.id))}
                                    >
                                      <Pencil data-icon="inline-start" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={isChecked}
                                      className="text-muted-gray hover:text-error disabled:cursor-not-allowed disabled:opacity-30"
                                      onClick={() => void removeTransaction(item.id)}
                                    >
                                      <Trash2 data-icon="inline-start" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!isSaving) setOpen(nextOpen) }}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto border-graphite bg-surface sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar gusto' : 'Agregar gusto'}</DialogTitle>
            <DialogDescription>Guarda cada gusto como un item individual, organizado por categoria.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-medium-gray">Categoria</Label>
                <Select value={form.category} onValueChange={(value) => { setFormError(null); categoryWasChanged.current = true; setForm((current) => ({ ...current, category: value as WantCategory })) }}>
                  <SelectTrigger className="bg-abyss border-graphite text-on-surface">
                    <SelectValue>{getCategoryMeta(form.category).label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border-graphite bg-surface">
                    {wantCategories.map((key) => (
                      <SelectItem key={key} value={key}>
                        {getCategoryMeta(key).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    value={customCategoryName}
                    maxLength={48}
                    placeholder="Ej. Actividades del niño"
                    aria-label="Nombre de la nueva categoría de gusto"
                    onChange={(event) => { setFormError(null); setCustomCategoryName(event.target.value) }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleCreateCategory()
                      }
                    }}
                    className="border-graphite bg-abyss text-on-surface"
                  />
                  <Button type="button" variant="secondary" disabled={!customCategoryName.trim()} onClick={handleCreateCategory}>
                    <Plus className="size-4" /> Crear
                  </Button>
                </div>
                <p className="text-xs text-muted-gray">Crea una categoría propia y quedará disponible con tus gustos guardados.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Precio ({moneyInput.currency.code})</Label>
                <Input
                  type="number"
                  placeholder="35"
                  value={form.amount}
                  onChange={(e) => { setFormError(null); setForm((current) => ({ ...current, amount: e.target.value })) }}
                  className="bg-abyss border-graphite text-on-surface"
                />
                {liveBudgetError ? <p className="text-xs text-error">{liveBudgetError}</p> : <p className="text-xs text-muted-gray">Puedes planificar hasta {formatMoney(availableToPlan)} sin pasarte.</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-medium-gray">Producto o experiencia</Label>
              <Input
                placeholder="Cena sushi, skin care, entrada al cine..."
                value={form.itemName}
                onChange={(e) => { const itemName = e.target.value; const rule = findCategorizationRule(itemName, userRules); setFormError(null); setForm((current) => ({ ...current, itemName, category: !categoryWasChanged.current && rule?.transactionType === 'want' ? rule.category : current.category })) }}
                className="bg-abyss border-graphite text-on-surface"
              />
            </div>

            {!editId ? (
              <PlanningHistoryPicker
                suggestions={historySuggestions}
                query={form.itemName}
                getCategoryLabel={(category) => getCategoryMeta(category as WantCategory).label}
                onReuse={(suggestion) => {
                  setFormError(null)
                  setForm({
                    amount: moneyInput.fromUsd(suggestion.amount),
                    itemName: suggestion.itemName,
                    category: suggestion.category as WantCategory,
                    date: getTodayDateKey(),
                  })
                }}
              />
            ) : null}

<DatePickerField
              label="Fecha"
              value={form.date}
              onChange={(value) => { setFormError(null); setForm((current) => ({ ...current, date: value })) }}
              description="Marca el dia en que planeas comprar o disfrutar este gusto."
            />

            <ReceiptOcrPanel transactionType="want" userRules={userRules} onApply={applyReceiptDraft} onAddItems={handleAddReceiptItems} />

            <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Vista previa</p>
              <p className="mt-2 text-lg font-semibold text-on-surface">
                {form.itemName || 'Gusto sin nombre'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className={getCategoryMeta(form.category).badge}>
                  {getCategoryMeta(form.category).label}
                </Badge>
                <span className="text-sm text-muted-gray">
                  {form.amount ? moneyInput.formatInput(Number(form.amount)) : 'Sin precio'}
                </span>
                <span className="text-sm text-muted-gray">
                  {form.date || 'Sin fecha'}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-gray">
                Disponible para planificar: {formatMoney(availableToPlan)}
              </p>
              <p className="mt-1 text-xs text-muted-gray">
                El dinero solo se descuenta del presupuesto cuando marques el checkbox del gusto.
              </p>
            </Card>
            {formError ? <p className="text-sm text-error">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={isSaving} onClick={() => { resetForm(); setOpen(false) }} className="text-muted-gray">Cancelar</Button>
            <Button
              loading={isSaving}
              onClick={() => void handleSave()}
              disabled={isWantsDisabled || isSaving || !form.amount || !form.itemName}
              className="bg-primary-container text-white shadow-vault hover:brightness-110"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={(nextOpen) => { if (!isTransferring) setTransferOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">Mover dinero a ahorros</DialogTitle>
            <DialogDescription>
              Elige cuanto del restante de gustos quieres pasar a ahorros este mes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Monto a mover ({moneyInput.currency.code})</Label>
              <Input
                type="number"
                min="0"
                max={Math.max(0, remaining)}
                value={transferAmount}
                onChange={(event) => {
                  setTransferError(null)
                  setTransferAmount(event.target.value)
                }}
                className="bg-abyss border-graphite text-on-surface"
              />
              <p className="text-xs text-muted-gray">
                Disponible para mover: {formatMoney(Math.max(0, remaining))}
              </p>
            </div>
            {transferError ? <p className="text-sm text-error">{transferError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={isTransferring}
              onClick={() => {
                setTransferOpen(false)
                setTransferError(null)
              }}
              className="text-muted-gray"
            >
              Cancelar
            </Button>
            <Button
              loading={isTransferring}
              disabled={isTransferring || remaining <= 0}
              onClick={() => void handleTransferRemainingToSavings()}
              className="bg-tertiary-container text-white hover:brightness-110"
            >
              Mover a ahorros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {celebration ? (
        <WantCelebration key={celebration.id} onClose={() => setCelebration(null)} />
      ) : null}
    </div>
  )
}
