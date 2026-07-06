import {
  getMonthlyOverview,
  type AllocationFormula,
  type Debt,
  type MonthlyPlanningHistory,
  type Salary,
  type Transaction,
} from '@plata/shared'

import { parseExpenseDescription } from '@/lib/expense-utils'
import { parseWantDescription } from '@/lib/want-utils'

export type ReportMonthSummary = {
  month: string
  label: string
  shortLabel: string
  salary: number
  expenses: number
  wants: number
  savings: number
  debtPaid: number
  debtRemaining: number
  freeBalance: number
  budgetExpenses: number
  budgetWants: number
  budgetSavings: number
  expenseItems: number
  wantItems: number
}

export type RankedCategory = {
  label: string
  type: 'expense' | 'want'
  totalAmount: number
  count: number
}

export type RankedProduct = {
  label: string
  type: 'expense' | 'want'
  category: string
  totalAmount: number
  count: number
}

export type TrendDirection = 'up' | 'down' | 'stable'

function getMonthKeyFromDate(value: Date | string) {
  return new Date(value).toISOString().slice(0, 7)
}

export function getMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7)
}

export function getPreviousMonthKey(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
}

export function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

export function formatShortMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(new Date(year, month - 1, 1))
}

function getMonthEnd(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
}

function sumDebtPaymentsForMonth(debts: Debt[], monthKey: string) {
  return debts.reduce(
    (sum, debt) => sum + (debt.payments ?? []).reduce(
      (subtotal, payment) => subtotal + (getMonthKeyFromDate(payment.date) === monthKey ? payment.amount : 0),
      0,
    ),
    0,
  )
}

function sumDebtRemainingAtMonthEnd(debts: Debt[], monthKey: string) {
  const monthEnd = getMonthEnd(monthKey)

  return debts.reduce((sum, debt) => {
    if (new Date(debt.startDate).getTime() > monthEnd.getTime()) return sum

    const paidToMonthEnd = (debt.payments ?? []).reduce((subtotal, payment) => {
      return new Date(payment.date).getTime() <= monthEnd.getTime() ? subtotal + payment.amount : subtotal
    }, 0)

    return sum + Math.max(0, debt.amount - Math.min(debt.amount, paidToMonthEnd))
  }, 0)
}

function toDisplayCategory(category: string) {
  const categoryMap: Record<string, string> = {
    food: 'Comida',
    home: 'Hogar',
    gym: 'Gym',
    health: 'Salud',
    essentials: 'Esenciales',
    outings: 'Salidas',
    shopping: 'Compras',
    gaming: 'Gaming',
    subscriptions: 'Suscripciones',
    selfcare: 'Cuidado personal',
  }

  return categoryMap[category] ?? category
}

function getTransactionMeta(transaction: Transaction) {
  if (transaction.type === 'expense') {
    const parsed = parseExpenseDescription(transaction.description)
    return {
      type: 'expense' as const,
      itemName: parsed.itemName,
      category: parsed.category,
      status: parsed.status,
    }
  }

  const parsed = parseWantDescription(transaction.description)
  return {
    type: 'want' as const,
    itemName: parsed.itemName,
    category: parsed.category,
    status: parsed.status,
  }
}

export function buildMonthlySummaries(params: {
  salaries: Salary[]
  transactions: Transaction[]
  debts: Debt[]
  monthlyPlanningHistory: MonthlyPlanningHistory[]
  formula: AllocationFormula
}) {
  const { salaries, transactions, debts, monthlyPlanningHistory, formula } = params
  const monthKeys = new Set<string>([getMonthKey()])

  salaries.forEach((salary) => monthKeys.add(salary.month))
  transactions.forEach((transaction) => monthKeys.add(transaction.date.slice(0, 7)))
  monthlyPlanningHistory.forEach((entry) => monthKeys.add(entry.month))
  debts.forEach((debt) => {
    monthKeys.add(debt.startDate.slice(0, 7))
    monthKeys.add(debt.endDate.slice(0, 7))
    ;(debt.payments ?? []).forEach((payment) => monthKeys.add(payment.date.slice(0, 7)))
  })

  const historyByMonth = new Map(monthlyPlanningHistory.map((entry) => [entry.month, entry]))
  const sortedMonths = [...monthKeys].sort((left, right) => left.localeCompare(right))

  return sortedMonths.map<ReportMonthSummary>((monthKey) => {
    const monthSalaries = salaries.filter((salary) => salary.month === monthKey)
    const monthTransactions = transactions.filter((transaction) => transaction.date.slice(0, 7) === monthKey)
    const overview = getMonthlyOverview(monthSalaries, monthTransactions, [], formula)
    const history = historyByMonth.get(monthKey)
    const debtPaid = sumDebtPaymentsForMonth(debts, monthKey)
    const debtRemaining = sumDebtRemainingAtMonthEnd(debts, monthKey)

    return {
      month: monthKey,
      label: formatMonthLabel(monthKey),
      shortLabel: formatShortMonthLabel(monthKey),
      salary: overview.grossSalary,
      expenses: overview.totalExpenses,
      wants: overview.totalWants,
      savings: overview.totalSavings,
      debtPaid,
      debtRemaining,
      freeBalance: Math.max(0, overview.grossSalary - overview.totalExpenses - overview.totalWants - overview.totalSavings - debtPaid),
      budgetExpenses: overview.budgetExpenses,
      budgetWants: overview.budgetWants,
      budgetSavings: overview.budgetSavings,
      expenseItems: history?.expenses.length ?? monthTransactions.filter((transaction) => transaction.type === 'expense').length,
      wantItems: history?.wants.length ?? monthTransactions.filter((transaction) => transaction.type === 'want').length,
    }
  })
}

export function buildMonthComparison(current: ReportMonthSummary | undefined, previous: ReportMonthSummary | undefined) {
  const metrics = [
    { key: 'salary', label: 'Salario', current: current?.salary ?? 0, previous: previous?.salary ?? 0, budget: 0 },
    { key: 'expenses', label: 'Gastos', current: current?.expenses ?? 0, previous: previous?.expenses ?? 0, budget: current?.budgetExpenses ?? 0 },
    { key: 'wants', label: 'Gustos', current: current?.wants ?? 0, previous: previous?.wants ?? 0, budget: current?.budgetWants ?? 0 },
    { key: 'savings', label: 'Ahorros', current: current?.savings ?? 0, previous: previous?.savings ?? 0, budget: current?.budgetSavings ?? 0 },
    { key: 'debtPaid', label: 'Deuda pagada', current: current?.debtPaid ?? 0, previous: previous?.debtPaid ?? 0, budget: 0 },
    { key: 'freeBalance', label: 'Saldo libre', current: current?.freeBalance ?? 0, previous: previous?.freeBalance ?? 0, budget: 0 },
  ]

  return metrics.map((metric) => {
    const delta = metric.current - metric.previous
    const percent = metric.previous === 0 ? (metric.current === 0 ? 0 : 100) : Math.round((delta / metric.previous) * 100)

    return {
      ...metric,
      delta,
      percent,
    }
  })
}

export function buildMonthlyRankings(transactions: Transaction[], monthKey: string) {
  const monthTransactions = transactions.filter(
    (transaction) => transaction.date.slice(0, 7) === monthKey && (transaction.type === 'expense' || transaction.type === 'want'),
  )

  const categories = new Map<string, RankedCategory>()
  const products = new Map<string, RankedProduct>()

  monthTransactions.forEach((transaction) => {
    const meta = getTransactionMeta(transaction)
    const categoryKey = `${meta.type}:${meta.category}`
    const productKey = `${meta.type}:${meta.category}:${meta.itemName.trim().toLowerCase()}`

    const categoryEntry = categories.get(categoryKey) ?? {
      label: toDisplayCategory(meta.category),
      type: meta.type,
      totalAmount: 0,
      count: 0,
    }
    categoryEntry.totalAmount += transaction.amount
    categoryEntry.count += 1
    categories.set(categoryKey, categoryEntry)

    const productEntry = products.get(productKey) ?? {
      label: meta.itemName,
      type: meta.type,
      category: toDisplayCategory(meta.category),
      totalAmount: 0,
      count: 0,
    }
    productEntry.totalAmount += transaction.amount
    productEntry.count += 1
    products.set(productKey, productEntry)
  })

  return {
    topCategoriesByAmount: [...categories.values()].sort((left, right) => right.totalAmount - left.totalAmount).slice(0, 5),
    topCategoriesByCount: [...categories.values()].sort((left, right) => right.count - left.count).slice(0, 5),
    topProductsByAmount: [...products.values()].sort((left, right) => right.totalAmount - left.totalAmount).slice(0, 5),
    topProductsByCount: [...products.values()].sort((left, right) => right.count - left.count).slice(0, 5),
  }
}

export function getTrendDirection(values: number[]): TrendDirection {
  if (values.length < 2) return 'stable'

  const first = values[0] ?? 0
  const last = values[values.length - 1] ?? 0
  if (first === 0 && last === 0) return 'stable'

  const base = first === 0 ? 1 : Math.abs(first)
  const changeRatio = (last - first) / base

  if (changeRatio >= 0.05) return 'up'
  if (changeRatio <= -0.05) return 'down'
  return 'stable'
}
