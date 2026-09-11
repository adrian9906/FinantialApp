import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { buildWantTransferSavingDescription, createLearnedCategorizationRule, findCategorizationRule, isCashPayment, type ReceiptOCRLineItem, type ReceiptOCRParsedDraft } from '@plata/shared'
import { ArrowLeftRight, Banknote, Clapperboard, Gamepad2, Heart, LockKeyhole, Pencil, Plus, ScanLine, ShoppingBag, Sparkles, Ticket, Trash2, type LucideIcon } from 'lucide-react'
import { useFinanceStore } from '@/store/financeStore'
import { buildWantDescription, createCustomWantCategory, getPlannedWantTotal, getWantCategoryLabel, parseWantDescription, type WantBuiltInCategory, type WantCategory } from '@/lib/want-utils'
import { getPlannedExpenseTotal } from '@/lib/expense-utils'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'
import { convertToUsd, convertUsdToInput, formatMoney, formatMoneyInput, formatMoneyWithCode, getCurrencyByCode } from '@/lib/currency'
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
import { TransactionDateFilter } from '@/components/planning/TransactionDateFilter'
import { buildPlanningHistorySuggestions, buildReusablePlanningListDrafts } from '@/lib/productivity'
import { toast } from 'sonner'
import { filterAndSortTransactionsByDate, getTodayDateKey, type TransactionDateFilter as TransactionDateFilterValue } from '@/lib/date'
import { ReceiptOcrPanel } from '@/components/ocr/ReceiptOcrPanel'
import { ReceiptItemsReviewDialog } from '@/components/ocr/ReceiptItemsReviewDialog'
import { buildReceiptCategoryGroups, buildReceiptTransaction, getReceiptTotalsByType, type ReceiptReviewResult } from '@/lib/receipt-review'
import { useAuthStore } from '@/store/authStore'
import { IncomeAccountSelect } from '@/components/income/IncomeAccountSelect'
import { getIncomeAccountOverview, getIncomeAccountsForMonth, type IncomeAccountView } from '@/lib/income-account-view'
import { getAccountAllocationFormula } from '@/lib/account-savings'
import { useActiveIncomeAccount } from '@/lib/useActiveIncomeAccount'

interface WantFormState {
  amount: string
  itemName: string
  category: WantCategory
  date: string
  /** True for cash, false for a transfer. Defaults to cash. */
  isCash: boolean
}

interface WantViewItem {
  id: string
  amount: number
  date: string
  itemName: string
  category: WantCategory
  status: 'pending' | 'checked'
  /** True for cash, false for a transfer. */
  isCash: boolean
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
  const salaries = useFinanceStore((state) => state.salaries)
  const incomeSources = useFinanceStore((state) => state.incomeSources)
  const overview = useMonthlyOverview()
  const formula = usePreferencesStore((state) => state.formula)
  const accountSavingsFormulas = usePreferencesStore((state) => state.accountSavingsFormulas)
  const profileId = useAuthStore((state) => state.user?.id) ?? 'guest'
  const userRules = usePreferencesStore(useShallow((state) => state.categoryRulesByProfile[profileId] ?? []))
  const saveCategoryRule = usePreferencesStore((state) => state.saveCategoryRule)
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
  const [dateFilter, setDateFilter] = useState<TransactionDateFilterValue>('cycle')
  const [receiptItems, setReceiptItems] = useState<ReceiptOCRLineItem[]>([])
  const [receiptDate, setReceiptDate] = useState<string | undefined>(undefined)
  const [receiptReviewOpen, setReceiptReviewOpen] = useState(false)
  const [receiptScanOpen, setReceiptScanOpen] = useState(false)
  const [receiptScanId, setReceiptScanId] = useState(0)
  const { accounts, activeIncomeSourceId: selectedIncomeSourceId, selectAccount: setSelectedIncomeSourceId } = useActiveIncomeAccount()
  // The receipt dialog chooses its own currency, so it needs every account.
  const receiptAccounts = useMemo(
    () => getIncomeAccountsForMonth(salaries, incomeSources),
    [incomeSources, salaries],
  )
  const [formIncomeSourcePreference, setFormIncomeSourceId] = useState('')
  const formIncomeSourceId = accounts.some((account) => account.source.id === formIncomeSourcePreference)
    ? formIncomeSourcePreference
    : accounts[0]?.source.id ?? ''
  const selectedAccount = accounts.find((account) => account.source.id === selectedIncomeSourceId)
  const formAccount = accounts.find((account) => account.source.id === formIncomeSourceId)
  const accountCurrency = getCurrencyByCode(selectedAccount?.salary.currencyCode)
  const formCurrency = getCurrencyByCode(formAccount?.salary.currencyCode)
  const accountFormula = getAccountAllocationFormula(accountSavingsFormulas, selectedIncomeSourceId, formula)
  const formAccountFormula = getAccountAllocationFormula(accountSavingsFormulas, formIncomeSourceId, formula)
  const isWantsDisabled = accountFormula.wants === 0
  const isFormWantsDisabled = formAccountFormula.wants === 0
  const accountOverview = getIncomeAccountOverview(selectedAccount, overview.periodTransactions, accountFormula)
  const formAccountOverview = getIncomeAccountOverview(formAccount, overview.periodTransactions, formAccountFormula)
  const formatAccountMoney = (value: number) => formatMoneyWithCode(value, accountCurrency)
  const receiptCategoryGroups = useMemo(() => buildReceiptCategoryGroups(transactions), [transactions])
  const categoryWasChanged = useRef(false)
  const [form, setForm] = useState<WantFormState>({
    amount: '',
    itemName: '',
    isCash: true,
    category: 'outings',
    date: getTodayDateKey(),
  })

  function resetForm() {
    categoryWasChanged.current = false
    setForm({
      amount: '',
      itemName: '',
      category: 'outings',
      date: getTodayDateKey(),
      isCash: true,
    })
    setEditId(null)
    setFormIncomeSourceId(selectedIncomeSourceId || accounts[0]?.source.id || '')
    setFormError(null)
  }

  function handleOpen(entry?: (typeof transactions)[number]) {
    if (isWantsDisabled) return
    setCustomCategoryName('')
    categoryWasChanged.current = false

    if (entry) {
      const parsed = parseWantDescription(entry.description)
      const entryAccount = accounts.find((account) => account.source.id === entry.incomeSourceId)
      setEditId(entry.id)
      setFormIncomeSourceId(entry.incomeSourceId ?? selectedIncomeSourceId)
      setForm({
        amount: convertUsdToInput(entry.amount, getCurrencyByCode(entryAccount?.salary.currencyCode)),
        itemName: parsed.itemName,
        category: parsed.category,
        date: entry.date,
        isCash: isCashPayment(entry),
      })
    } else {
      resetForm()
    }
    setOpen(true)
  }

  const wantItems = useMemo<WantViewItem[]>(() => {
    return overview.periodTransactions
      .filter((transaction) => transaction.type === 'want'
      && transaction.incomeSourceId === selectedIncomeSourceId)
      .map((transaction) => {
        const parsed = parseWantDescription(transaction.description)
        return {
          id: transaction.id,
          amount: transaction.amount,
          date: transaction.date,
          itemName: parsed.itemName,
          category: parsed.category,
          status: parsed.status,
          isCash: isCashPayment(transaction),
        }
      })
  }, [overview.periodTransactions, selectedIncomeSourceId])

  const wantCategories = (() => {
    const categories = new Set<WantCategory>(Object.keys(CATEGORY_META) as WantBuiltInCategory[])
    wantItems.forEach((item) => categories.add(item.category))
    categories.add(form.category)
    return Array.from(categories)
  })()

  const filteredWantItems = useMemo(
    () => filterAndSortTransactionsByDate(wantItems, dateFilter),
    [dateFilter, wantItems],
  )

  const groupedWants = wantCategories.map((key) => {
      const meta = getCategoryMeta(key)
      const items = filteredWantItems
        .filter((item) => item.category === key)

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

  const wantCount = filteredWantItems.length
  const checkedCount = filteredWantItems.filter((item) => item.status === 'checked').length
  const pendingCount = filteredWantItems.filter((item) => item.status === 'pending').length
  const editingTransaction = editId ? transactions.find((transaction) => transaction.id === editId) : undefined
  const currentItemAmount = editingTransaction?.incomeSourceId === formIncomeSourceId ? editingTransaction.amount : 0
  const plannedTotal = getPlannedWantTotal(formAccountOverview.periodTransactions) - currentItemAmount
  const availableToPlan = Math.max(0, formAccountOverview.budgetWants - plannedTotal)
  const pct = accountOverview.budgetWants > 0 ? Math.min(100, Math.round((accountOverview.totalWants / accountOverview.budgetWants) * 100)) : 0
  const remaining = accountOverview.budgetWants - accountOverview.totalWants
  const typedAmount = convertToUsd(Number(form.amount), formCurrency)
  const liveBudgetError = !form.amount
    ? null
    : !Number.isFinite(typedAmount) || typedAmount <= 0
      ? 'El precio debe ser mayor que cero.'
      : typedAmount > availableToPlan
        ? `Te pasas por ${formatMoneyWithCode(typedAmount - availableToPlan, formCurrency)}. Solo te quedan ${formatMoneyWithCode(availableToPlan, formCurrency)} disponibles para planificar.`
        : plannedTotal + typedAmount > formAccountOverview.budgetWants
          ? `No puedes agregar este gusto porque la lista subiría a ${formatMoneyWithCode(plannedTotal + typedAmount, formCurrency)} y tu límite es ${formatMoneyWithCode(formAccountOverview.budgetWants, formCurrency)}.`
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
    setReceiptScanOpen(false)
    setOpen(true)
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

  function handleAddReceiptItems(items: ReceiptOCRLineItem[], date?: string) {
    setReceiptItems(items)
    setReceiptDate(date)
    setReceiptScanId((current) => current + 1)
    setReceiptScanOpen(false)
    setReceiptReviewOpen(true)
    return Promise.resolve()
  }

  async function handleConfirmReceiptItems(
    reviewed: ReceiptReviewResult[],
    date: string,
    receiptAccount: IncomeAccountView,
  ) {
    // The dialog picks the account by currency and payment method, so budgets
    // must be checked against that account and not the one selected on screen.
    const receiptOverview = getIncomeAccountOverview(receiptAccount, overview.periodTransactions, formula)
    const receiptCurrency = getCurrencyByCode(receiptAccount.salary.currencyCode)
    const formatReceiptMoney = (value: number) => formatMoneyWithCode(value, receiptCurrency)
    const totals = getReceiptTotalsByType(reviewed)
    const availableExpenses = Math.max(0, receiptOverview.budgetExpenses - getPlannedExpenseTotal(receiptOverview.periodTransactions))
    const availableWants = Math.max(0, receiptOverview.budgetWants - getPlannedWantTotal(receiptOverview.periodTransactions))

    if (totals.expense > availableExpenses) {
      toast.error(`Los gastos del recibo suman ${formatReceiptMoney(totals.expense)} y solo tienes ${formatReceiptMoney(availableExpenses)} disponibles para planificar.`)
      throw new Error('over-budget')
    }
    if (totals.want > availableWants) {
      toast.error(`Los gustos del recibo suman ${formatReceiptMoney(totals.want)} y solo tienes ${formatReceiptMoney(availableWants)} disponibles para planificar.`)
      throw new Error('over-budget')
    }

    await Promise.all(reviewed.map((item) => addTransaction({
      ...buildReceiptTransaction(item, date),
      incomeSourceId: receiptAccount.source.id,
      incomeSourceName: receiptAccount.source.name,
      isCash: receiptAccount.source.isCash !== false,
    })))
    reviewed.forEach((item) => {
      const learned = item.transactionType === 'expense'
        ? createLearnedCategorizationRule(item.name, { transactionType: 'expense', category: item.category })
        : createLearnedCategorizationRule(item.name, { transactionType: 'want', category: item.category })
      if (learned) saveCategoryRule(profileId, learned)
    })
    toast.success(`Se crearon ${reviewed.length} producto${reviewed.length === 1 ? '' : 's'} del recibo.`)
  }

  async function handleSave() {
    if (!form.amount || !form.itemName || isSaving) return
    if (isFormWantsDisabled) {
      setFormError('La sección Gustos está desactivada porque su porcentaje es 0%.')
      return
    }
    if (!formAccount) {
      setFormError('Selecciona el ingreso desde donde se descontará el dinero.')
      return
    }

    const nextAmount = convertToUsd(Number(form.amount), formCurrency)
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setFormError('El precio debe ser mayor que cero.')
      return
    }

    if (nextAmount > availableToPlan) {
      setFormError(`Ese precio supera el disponible para planificar: ${formatMoneyWithCode(availableToPlan, formCurrency)}.`)
      return
    }

    if (plannedTotal + nextAmount > formAccountOverview.budgetWants) {
      setFormError(`No puedes agregarlo porque la lista total se iría a ${formatMoneyWithCode(plannedTotal + nextAmount, formCurrency)} y tu límite es ${formatMoneyWithCode(formAccountOverview.budgetWants, formCurrency)}.`)
      return
    }

    const previousRefund = editingTransaction?.incomeSourceId === formAccount.source.id ? editingTransaction.amount : 0
    const availableAccountBalance = Number(formAccount.salary.balance ?? formAccount.salary.amount) + previousRefund
    if (nextAmount > availableAccountBalance) {
      setFormError(`Ese ingreso solo tiene ${formatMoneyWithCode(availableAccountBalance, formCurrency)} de saldo.`)
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
      isCash: formAccount.source.isCash !== false,
      incomeSourceId: formAccount.source.id,
      incomeSourceName: formAccount.source.name,
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
      toast.error(`La lista necesita ${formatAccountMoney(total)} y solo tienes ${formatAccountMoney(availableToPlan)} disponibles.`)
      return
    }

    setRestoringListId(entry.id)
    try {
      if (!selectedAccount) throw new Error('Selecciona primero un ingreso.')
      await Promise.all(drafts.map((draft) => addTransaction({
        ...draft,
        incomeSourceId: selectedAccount.source.id,
        incomeSourceName: selectedAccount.source.name,
        isCash: selectedAccount.source.isCash !== false,
      })))
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

    const nextAmount = convertToUsd(Number(transferAmount), accountCurrency)
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setTransferError('El monto debe ser mayor que cero.')
      return
    }
    if (nextAmount > remaining) {
      setTransferError(`Solo puedes mover hasta ${formatAccountMoney(Math.max(0, remaining))}.`)
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
            variant="secondary"
            onClick={() => setReceiptScanOpen(true)}
            className="w-full sm:w-auto"
          >
            <ScanLine className="size-4" /> Agregar por recibo
          </Button>
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

      <Card className="border-graphite bg-surface p-4 shadow-vault-sm">
        <IncomeAccountSelect
          accounts={accounts}
          value={selectedIncomeSourceId}
          onValueChange={setSelectedIncomeSourceId}
          label="Ver gustos del ingreso"
        />
      </Card>

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
              <p className="text-xs uppercase tracking-wider text-muted-gray">Presupuesto mensual ({accountFormula.wants}%)</p>
              <Badge variant="secondary" className={`w-fit ${isWantsDisabled ? 'bg-warning/10 text-warning' : remaining >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                {isWantsDisabled
                  ? 'Sección desactivada'
                  : remaining >= 0
                    ? `${formatAccountMoney(remaining)} disponible`
                    : `${formatAccountMoney(Math.abs(remaining))} excedido`}
              </Badge>
            </div>
            <h2 className="mb-3 break-words text-[28px] font-semibold leading-tight text-on-surface sm:text-[30px]">
              {formatAccountMoney(accountOverview.totalWants)} <span className="text-base font-normal text-muted-gray">/ {formatAccountMoney(accountOverview.budgetWants)}</span>
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

      <TransactionDateFilter
        value={dateFilter}
        onChange={setDateFilter}
        resultCount={filteredWantItems.length}
        itemLabel="gusto"
      />

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
                    <p className="mt-2 text-lg font-semibold text-on-surface">{formatAccountMoney(total)}</p>
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
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <p className="text-xs text-muted-gray">{item.date}</p>
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                          item.isCash
                                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                            : 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                                        }`}
                                      >
                                        {item.isCash
                                          ? <Banknote className="size-3.5" aria-hidden="true" />
                                          : <ArrowLeftRight className="size-3.5" aria-hidden="true" />}
                                        {item.isCash ? 'Efectivo' : 'Transferencia'}
                                      </span>
                                    </div>
                                  </div>
                                  <span className={`text-sm font-semibold ${isChecked ? 'text-muted-gray' : 'text-secondary'} sm:text-right`}>
                                    {formatAccountMoney(item.amount)}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-xs leading-5 text-muted-gray">
                                    {isChecked ? 'Marcado como disfrutado' : 'Pendiente por comprar'}
                                  </span>
                                  <div className="flex gap-1">
                                    <Button
                                      aria-label={`Editar gusto ${item.itemName}`}
                                      variant="ghost"
                                      size="icon"
                                      disabled={isWantsDisabled || isChecked}
                                      className="text-muted-gray hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                                      onClick={() => handleOpen(transactions.find((entry) => entry.id === item.id))}
                                    >
                                      <Pencil data-icon="inline-start" />
                                    </Button>
                                    <Button
                                      aria-label={`Eliminar gusto ${item.itemName}`}
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

      <Dialog open={open && !isWantsDisabled} onOpenChange={(nextOpen) => { if (!isSaving) setOpen(nextOpen) }}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto border-graphite bg-surface sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar gusto' : 'Agregar gusto'}</DialogTitle>
            <DialogDescription>Guarda cada gusto como un item individual, organizado por categoría.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <IncomeAccountSelect
              accounts={accounts}
              value={formIncomeSourceId}
              onValueChange={(value) => { setFormError(null); setFormIncomeSourceId(value); setForm((current) => ({ ...current, amount: '' })) }}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-medium-gray">Categoría</Label>
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
                <Label className="text-medium-gray">Precio ({formCurrency.code})</Label>
                <Input
                  type="number"
                  placeholder="35"
                  value={form.amount}
                  onChange={(e) => { setFormError(null); setForm((current) => ({ ...current, amount: e.target.value })) }}
                  className="bg-abyss border-graphite text-on-surface"
                />
                {liveBudgetError ? <p className="text-xs text-error">{liveBudgetError}</p> : <p className="text-xs text-muted-gray">Puedes planificar hasta {formatMoneyWithCode(availableToPlan, formCurrency)} sin pasarte.</p>}
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
                    amount: convertUsdToInput(suggestion.amount, formCurrency),
                    itemName: suggestion.itemName,
                    isCash: true,
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
              description="Marca el día en que planeas comprar o disfrutar este gusto."
            />

            <div className="space-y-2">
              <Label className="text-medium-gray">Forma de pago</Label>
              <div className="flex items-center justify-between rounded-xl border border-graphite bg-abyss px-3 py-2.5">
                <span className={`inline-flex items-center gap-2 text-sm ${formAccount?.source.isCash === false ? 'text-sky-300' : 'text-emerald-300'}`}>
                  {formAccount?.source.isCash === false ? <ArrowLeftRight className="size-4" /> : <Banknote className="size-4" />}
                  {formAccount?.source.isCash === false ? 'Transferencia' : 'Efectivo'}
                </span>
                <span className="text-xs text-muted-gray">Definido por el ingreso</span>
              </div>
            </div>

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
                  {form.amount ? formatMoneyInput(Number(form.amount), formCurrency) : 'Sin precio'}
                </span>
                <span className="text-sm text-muted-gray">
                  {form.date || 'Sin fecha'}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-gray">
                Disponible para planificar: {formatMoneyWithCode(availableToPlan, formCurrency)}
              </p>
              <p className="mt-1 text-xs text-muted-gray">
                Al guardar, el dinero se descuenta del saldo de {formAccount?.source.name ?? 'ese ingreso'}.
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

      <Dialog open={receiptScanOpen} onOpenChange={setReceiptScanOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 overflow-x-hidden border-graphite bg-surface sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">Agregar por recibo</DialogTitle>
            <DialogDescription>
              Sube o toma una foto. Después podrás corregir la fecha y decidir el destino de cada producto.
            </DialogDescription>
          </DialogHeader>
          <ReceiptOcrPanel
            transactionType="want"
            userRules={userRules}
            onApply={applyReceiptDraft}
            onAddItems={handleAddReceiptItems}
          />
        </DialogContent>
      </Dialog>

      {receiptReviewOpen ? (
        <ReceiptItemsReviewDialog
          key={receiptScanId}
          open={receiptReviewOpen}
          onOpenChange={setReceiptReviewOpen}
          items={receiptItems}
          initialDate={receiptDate}
          defaultTransactionType="want"
          categoryGroups={receiptCategoryGroups}
          userRules={userRules}
          accounts={receiptAccounts}
          onConfirm={handleConfirmReceiptItems}
        />
      ) : null}

      <Dialog open={transferOpen && !isWantsDisabled} onOpenChange={(nextOpen) => { if (!isTransferring) setTransferOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">Mover dinero a ahorros</DialogTitle>
            <DialogDescription>
              Elige cuanto del restante de gustos quieres pasar a ahorros este mes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Monto a mover ({accountCurrency.code})</Label>
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
                Disponible para mover: {formatAccountMoney(Math.max(0, remaining))}
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
    </div>
  )
}
