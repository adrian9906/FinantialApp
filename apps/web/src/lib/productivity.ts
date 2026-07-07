import {
  buildExpenseDescription,
  buildWantDescription,
  getWishlistReservedAmount,
  isWishlistPurchased,
  parseExpenseDescription,
  parseWantDescription,
  type Debt,
  type MonthlyPlanningHistory,
  type MonthlyPlanningItem,
  type Reminder,
  type Transaction,
  type WishlistItem,
} from '@plata/shared'

export type SearchSection = 'expense' | 'want' | 'wishlist' | 'debt' | 'reminder'

export type GlobalSearchResult = {
  id: string
  section: SearchSection
  title: string
  subtitle: string
  amount: number
  amountLabel: string
  month: string | null
  monthLabel: string
  category: string
  categoryLabel: string
  status: string
  statusLabel: string
  href: string
  keywords: string
}

export type RecurringPlanningSuggestion = {
  key: string
  type: 'expense' | 'want'
  itemName: string
  category: string
  amount: number
  streak: number
  months: string[]
}

export type RepeatPlanDraft = Omit<Transaction, 'id'>

const MONTH_FORMATTER = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString()}`
}

function formatMonthLabel(month: string | null) {
  if (!month) return 'Sin mes'
  const [year, monthValue] = month.split('-').map(Number)
  if (!year || !monthValue) return month
  return MONTH_FORMATTER.format(new Date(year, monthValue - 1, 1))
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function buildItemKey(type: 'expense' | 'want', itemName: string, category: string) {
  return `${type}:${normalizeText(itemName)}:${normalizeText(category)}`
}

function getPreviousMonthKey(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  date.setMonth(date.getMonth() - 1)
  return date.toISOString().slice(0, 7)
}

function groupHistoryByMonth(history: MonthlyPlanningHistory[]) {
  const byMonth = new Map<string, MonthlyPlanningHistory>()

  history.forEach((entry) => {
    const current = byMonth.get(entry.month)
    if (!current || new Date(entry.createdAt).getTime() > new Date(current.createdAt).getTime()) {
      byMonth.set(entry.month, entry)
    }
  })

  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month))
}

function toRecurringSuggestion(
  type: 'expense' | 'want',
  item: MonthlyPlanningItem,
  streak: number,
  months: string[],
): RecurringPlanningSuggestion {
  return {
    key: buildItemKey(type, item.itemName, item.category),
    type,
    itemName: item.itemName,
    category: item.category,
    amount: item.amount,
    streak,
    months,
  }
}

export function buildRecurringPlanningSuggestions(history: MonthlyPlanningHistory[]) {
  const monthlyHistory = groupHistoryByMonth(history)
  const latestHistory = monthlyHistory[0] ?? null

  if (!latestHistory) {
    return {
      latestHistory: null,
      recurringExpenses: [] as RecurringPlanningSuggestion[],
      recurringWants: [] as RecurringPlanningSuggestion[],
      recurringItems: [] as RecurringPlanningSuggestion[],
    }
  }

  const expenseMapByMonth = new Map<string, Set<string>>()
  const wantMapByMonth = new Map<string, Set<string>>()

  monthlyHistory.forEach((entry) => {
    expenseMapByMonth.set(
      entry.month,
      new Set(entry.expenses.map((item) => buildItemKey('expense', item.itemName, item.category))),
    )
    wantMapByMonth.set(
      entry.month,
      new Set(entry.wants.map((item) => buildItemKey('want', item.itemName, item.category))),
    )
  })

  const getStreak = (type: 'expense' | 'want', item: MonthlyPlanningItem) => {
    const key = buildItemKey(type, item.itemName, item.category)
    const monthMap = type === 'expense' ? expenseMapByMonth : wantMapByMonth
    const months: string[] = []
    let currentMonth = latestHistory.month

    while (monthMap.has(currentMonth) && monthMap.get(currentMonth)?.has(key)) {
      months.push(currentMonth)
      currentMonth = getPreviousMonthKey(currentMonth)
    }

    return { streak: months.length, months }
  }

  const recurringExpenses = latestHistory.expenses
    .map((item) => {
      const { streak, months } = getStreak('expense', item)
      return streak >= 2 ? toRecurringSuggestion('expense', item, streak, months) : null
    })
    .filter((entry): entry is RecurringPlanningSuggestion => entry !== null)
    .sort((a, b) => b.streak - a.streak || b.amount - a.amount || a.itemName.localeCompare(b.itemName))

  const recurringWants = latestHistory.wants
    .map((item) => {
      const { streak, months } = getStreak('want', item)
      return streak >= 2 ? toRecurringSuggestion('want', item, streak, months) : null
    })
    .filter((entry): entry is RecurringPlanningSuggestion => entry !== null)
    .sort((a, b) => b.streak - a.streak || b.amount - a.amount || a.itemName.localeCompare(b.itemName))

  return {
    latestHistory,
    recurringExpenses,
    recurringWants,
    recurringItems: [...recurringExpenses, ...recurringWants].sort(
      (a, b) => b.streak - a.streak || b.amount - a.amount || a.itemName.localeCompare(b.itemName),
    ),
  }
}

export function buildRepeatPlanDrafts(suggestions: RecurringPlanningSuggestion[]): RepeatPlanDraft[] {
  const today = new Date().toISOString().slice(0, 10)

  return suggestions.map((item) => ({
    amount: item.amount,
    type: item.type,
    date: today,
    description:
      item.type === 'expense'
        ? buildExpenseDescription(item.category as never, item.itemName, 'pending')
        : buildWantDescription(item.category as never, item.itemName, 'pending'),
  }))
}

export function buildGlobalSearchIndex({
  transactions,
  wishlist,
  debts,
  reminders,
}: {
  transactions: Transaction[]
  wishlist: WishlistItem[]
  debts: Debt[]
  reminders: Reminder[]
}) {
  const transactionResults: GlobalSearchResult[] = transactions.flatMap((transaction) => {
    if (transaction.type === 'saving') return []

    const parsed =
      transaction.type === 'expense'
        ? parseExpenseDescription(transaction.description)
        : parseWantDescription(transaction.description)
    const section = transaction.type
    const statusLabel = parsed.status === 'checked' ? 'Completado' : 'Pendiente'
    const categoryLabel = parsed.category

    return [{
      id: transaction.id,
      section,
      title: parsed.itemName,
      subtitle:
        section === 'expense'
          ? `Gasto ${statusLabel.toLowerCase()}`
          : `Gusto ${statusLabel.toLowerCase()}`,
      amount: transaction.amount,
      amountLabel: formatCurrency(transaction.amount),
      month: transaction.date.slice(0, 7),
      monthLabel: formatMonthLabel(transaction.date.slice(0, 7)),
      category: parsed.category,
      categoryLabel,
      status: parsed.status,
      statusLabel,
      href: section === 'expense' ? '/expenses' : '/wants',
      keywords: normalizeText(
        `${parsed.itemName} ${parsed.category} ${parsed.status} ${transaction.description ?? ''}`,
      ),
    }]
  })

  const wishlistResults: GlobalSearchResult[] = wishlist.map((item) => {
    const purchased = isWishlistPurchased(item)
    const reserved = getWishlistReservedAmount(item)
    const status = purchased ? 'purchased' : 'pending'

    return {
      id: item.id,
      section: 'wishlist',
      title: item.name,
      subtitle: purchased
        ? `Comprado con ${formatCurrency(reserved)} reservado`
        : `Guardado ${formatCurrency(item.savedAmount)} de ${formatCurrency(item.price)}`,
      amount: item.price,
      amountLabel: formatCurrency(item.price),
      month: null,
      monthLabel: 'Sin mes',
      category: item.priority,
      categoryLabel: `Prioridad ${item.priority}`,
      status,
      statusLabel: purchased ? 'Comprado' : 'Pendiente',
      href: '/wishlist',
      keywords: normalizeText(
        `${item.name} ${item.priority} ${purchased ? 'comprado' : 'pendiente'} ${item.savedAmount} ${item.price}`,
      ),
    }
  })

  const debtResults: GlobalSearchResult[] = debts.map((item) => {
    const status = item.isSettled ? 'settled' : 'active'

    return {
      id: item.id,
      section: 'debt',
      title: item.history || 'Deuda',
      subtitle: `${formatCurrency(item.paidAmount)} pagados de ${formatCurrency(item.amount)}`,
      amount: item.remainingAmount,
      amountLabel: formatCurrency(item.remainingAmount),
      month: item.startDate ? item.startDate.slice(0, 7) : null,
      monthLabel: formatMonthLabel(item.startDate ? item.startDate.slice(0, 7) : null),
      category: 'debt',
      categoryLabel: 'Deuda',
      status,
      statusLabel: item.isSettled ? 'Saldada' : 'Activa',
      href: '/debts',
      keywords: normalizeText(
        `${item.history} ${item.startDate} ${item.endDate} ${item.isSettled ? 'saldada' : 'activa'}`,
      ),
    }
  })

  const reminderResults: GlobalSearchResult[] = reminders.map((item) => ({
    id: item.id,
    section: 'reminder',
    title: item.title,
    subtitle: item.description || 'Recordatorio financiero',
    amount: 0,
    amountLabel: '$0',
    month: item.date ? item.date.slice(0, 7) : null,
    monthLabel: formatMonthLabel(item.date ? item.date.slice(0, 7) : null),
    category: 'reminder',
    categoryLabel: 'Recordatorio',
    status: item.completed ? 'completed' : 'pending',
    statusLabel: item.completed ? 'Completado' : 'Pendiente',
    href: '/reminders',
    keywords: normalizeText(
      `${item.title} ${item.description} ${item.completed ? 'completado' : 'pendiente'} ${item.date}`,
    ),
  }))

  return [...transactionResults, ...wishlistResults, ...debtResults, ...reminderResults].sort((a, b) => {
    if (a.month && b.month && a.month !== b.month) return b.month.localeCompare(a.month)
    if (a.amount !== b.amount) return b.amount - a.amount
    return a.title.localeCompare(b.title)
  })
}

export function getSearchFilterOptions(results: GlobalSearchResult[]) {
  const months = [...new Set(results.map((item) => item.month).filter((value): value is string => Boolean(value)))]
  const categories = [...new Set(results.map((item) => item.category))]
  const statuses = [...new Set(results.map((item) => item.status))]

  return {
    months: months.map((month) => ({ value: month, label: formatMonthLabel(month) })),
    categories: categories.map((category) => ({
      value: category,
      label: results.find((item) => item.category === category)?.categoryLabel ?? category,
    })),
    statuses: statuses.map((status) => ({
      value: status,
      label: results.find((item) => item.status === status)?.statusLabel ?? status,
    })),
  }
}
