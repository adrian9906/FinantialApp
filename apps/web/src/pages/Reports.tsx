import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ReceiptText,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  getFinancialPeriodStart,
  getFinancialPeriodEnd,
  getMonthlyOverview,
  isInFinancialPeriod,
  getWishlistReservedAmount,
  isWishlistPurchased,
  parseExpenseDescription,
  parseWantDescription,
  type MonthlyPlanningHistory,
  type Transaction,
  type WishlistItem,
} from '@plata/shared'

import { ExportExcelButton } from '@/components/reports/ExportExcelButton'
import { SpendingHistory } from '@/components/reports/SpendingHistory'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { exportMonthlyReport } from '@/lib/reportExports'
import { formatMoney } from '@/lib/currency'
import {
  buildFinancialTimeline,
  buildSnapshotTransactions,
  buildMonthComparison,
  buildMonthlyRankings,
  buildMonthlySummaries,
  formatMonthLabel,
  getMonthKey,
  getPreviousMonthKey,
  getTrendDirection,
} from '@/lib/reporting'
import { buildUnnecessarySpendingInsights } from '@/lib/unnecessary-spending'
import { getCanonicalPlanningHistory } from '@/lib/planningHistory'
import { buildMonthlySpendingTrend } from '@/lib/monthlySpendingTrend'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'

type ReportMetric = {
  label: string
  current: number
  previous: number
  budget?: number
  tone: 'primary' | 'danger' | 'secondary' | 'success'
}

type SpendingTrendGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly'
type SpendingTrendCategory = 'gastos' | 'gustos' | 'ahorroUsado'
type SpendingTrendEntry = { date: string; type: SpendingTrendCategory; amount: number }
type SpendingTrendPoint = {
  label: string
  period: string
  gastos: number
  gustos: number
  ahorroUsado: number
  gastosAnterior?: number | null
  gustosAnterior?: number | null
  ahorroUsadoAnterior?: number | null
}
type SpendingTrendVisibility = Record<SpendingTrendCategory, boolean>

const formatCurrency = formatMoney
const DAY_IN_MS = 86_400_000
const fullDateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const spendingTrendCopy: Record<SpendingTrendGranularity, { description: string; unit: string }> = {
  daily: { description: 'Movimientos diarios desde el último reset hasta hoy.', unit: 'día(s)' },
  weekly: { description: 'Movimientos agrupados en semanas desde el último reset.', unit: 'semana(s)' },
  monthly: { description: 'Ciclos cerrados agrupados por mes y el ciclo actual.', unit: 'periodo(s)' },
  yearly: { description: 'Gastos y gustos acumulados por año.', unit: 'año(s)' },
}
const spendingTrendCategories: Array<{ key: SpendingTrendCategory; label: string; color: string }> = [
  { key: 'gastos', label: 'Gastos', color: '#3b82f6' },
  { key: 'gustos', label: 'Gustos', color: '#a855f7' },
  { key: 'ahorroUsado', label: 'Ahorro usado', color: '#10b981' },
]

function dateKeyToUtc(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function addUtcDays(value: string, days: number) {
  return new Date(dateKeyToUtc(value) + days * DAY_IN_MS).toISOString().slice(0, 10)
}

function sumCompletedCycle(cycle: MonthlyPlanningHistory, type: 'expenses' | 'wants') {
  return cycle[type].reduce(
    (sum, entry) => entry.status === 'checked' ? sum + Math.max(0, entry.amount) : sum,
    0,
  )
}

function buildCurrentSpendingEntries(transactions: Transaction[]): SpendingTrendEntry[] {
  return transactions.flatMap<SpendingTrendEntry>((transaction) => {
    if (transaction.type === 'expense') {
      return parseExpenseDescription(transaction.description).status === 'checked'
        ? [{ date: transaction.date.slice(0, 10), type: 'gastos', amount: Math.max(0, transaction.amount) }]
        : []
    }
    if (transaction.type === 'want') {
      return parseWantDescription(transaction.description).status === 'checked'
        ? [{ date: transaction.date.slice(0, 10), type: 'gustos', amount: Math.max(0, transaction.amount) }]
        : []
    }
    return []
  })
}

function addEntry(point: SpendingTrendPoint, entry: SpendingTrendEntry) {
  point[entry.type] += entry.amount
}

function buildWishlistSpendingEntries(wishlist: WishlistItem[]) {
  return wishlist.flatMap<SpendingTrendEntry>((item) => {
    if (!isWishlistPurchased(item) || !item.purchasedAt) return []
    const amount = getWishlistReservedAmount(item)
    return amount > 0
      ? [{ date: item.purchasedAt.slice(0, 10), type: 'ahorroUsado', amount }]
      : []
  })
}

function emptyTrendPoint(label: string, period: string): SpendingTrendPoint {
  return { label, period, gastos: 0, gustos: 0, ahorroUsado: 0 }
}

function alignWithPrevious(current: SpendingTrendPoint[], previous: SpendingTrendPoint[]) {
  return current.map((point, index) => ({
    ...point,
    gastosAnterior: previous[index]?.gastos ?? null,
    gustosAnterior: previous[index]?.gustos ?? null,
    ahorroUsadoAnterior: previous[index]?.ahorroUsado ?? null,
  }))
}

function compareWithPreviousPeriod(points: SpendingTrendPoint[]) {
  return points.map((point, index) => ({
    ...point,
    gastosAnterior: index > 0 ? points[index - 1].gastos : null,
    gustosAnterior: index > 0 ? points[index - 1].gustos : null,
    ahorroUsadoAnterior: index > 0 ? points[index - 1].ahorroUsado : null,
  }))
}

function buildDailyTrend(entries: SpendingTrendEntry[], start: string, end: string) {
  const dayCount = Math.max(1, Math.floor((dateKeyToUtc(end) - dateKeyToUtc(start)) / DAY_IN_MS) + 1)
  const points = Array.from({ length: dayCount }, (_, index) => {
    const date = addUtcDays(start, index)
    return emptyTrendPoint(
      String(Number(date.slice(8, 10))),
      fullDateFormatter.format(new Date(`${date}T00:00:00.000Z`)),
    )
  })

  entries.forEach((entry) => {
    const index = Math.floor((dateKeyToUtc(entry.date) - dateKeyToUtc(start)) / DAY_IN_MS)
    if (index >= 0 && index < points.length) addEntry(points[index], entry)
  })
  return points
}

function buildWeeklyTrend(entries: SpendingTrendEntry[], start: string, end: string) {
  const dayCount = Math.max(1, Math.floor((dateKeyToUtc(end) - dateKeyToUtc(start)) / DAY_IN_MS) + 1)
  const weekCount = Math.ceil(dayCount / 7)
  const points = Array.from({ length: weekCount }, (_, index) => {
    const weekStart = addUtcDays(start, index * 7)
    const weekEnd = addUtcDays(start, Math.min(dayCount - 1, index * 7 + 6))
    return emptyTrendPoint(
      `Semana ${index + 1}`,
      `${fullDateFormatter.format(new Date(`${weekStart}T00:00:00.000Z`))} – ${fullDateFormatter.format(new Date(`${weekEnd}T00:00:00.000Z`))}`,
    )
  })

  entries.forEach((entry) => {
    const index = Math.floor((dateKeyToUtc(entry.date) - dateKeyToUtc(start)) / DAY_IN_MS / 7)
    if (index >= 0 && index < points.length) addEntry(points[index], entry)
  })
  return points
}

function buildYearlyTrend(
  closedCycles: MonthlyPlanningHistory[],
  currentExpenses: number,
  currentWants: number,
  currentSavingsUsed: number,
  currentPeriodStart: string,
  wishlistEntries: SpendingTrendEntry[],
) {
  const years = new Map<string, SpendingTrendPoint>()
  closedCycles.forEach((cycle) => {
    const year = cycle.month.slice(0, 4)
    const point = years.get(year) ?? emptyTrendPoint(year, `Año ${year}`)
    point.gastos += sumCompletedCycle(cycle, 'expenses')
    point.gustos += sumCompletedCycle(cycle, 'wants')
    years.set(year, point)
  })

  wishlistEntries.forEach((entry) => {
    if (entry.date >= currentPeriodStart.slice(0, 10)) return
    const year = entry.date.slice(0, 4)
    const point = years.get(year)
    if (point) point.ahorroUsado += entry.amount
  })

  const currentYear = currentPeriodStart.slice(0, 4)
  const currentPoint = years.get(currentYear) ?? emptyTrendPoint(currentYear, `Año ${currentYear}`)
  currentPoint.gastos += currentExpenses
  currentPoint.gustos += currentWants
  currentPoint.ahorroUsado += currentSavingsUsed
  years.set(currentYear, currentPoint)

  return Array.from(years.values()).sort((left, right) => left.label.localeCompare(right.label))
}

function toneClasses(tone: ReportMetric['tone']) {
  if (tone === 'danger') return 'bg-rose-500/12 text-rose-200 border-rose-500/20'
  if (tone === 'secondary') return 'bg-secondary/12 text-secondary border-secondary/20'
  if (tone === 'success') return 'bg-emerald-500/12 text-emerald-200 border-emerald-500/20'
  return 'bg-primary/12 text-primary border-primary/20'
}

function getDirectionLabel(direction: ReturnType<typeof getTrendDirection>) {
  if (direction === 'up') return 'Sube'
  if (direction === 'down') return 'Baja'
  return 'Estable'
}

function getDirectionTone(direction: ReturnType<typeof getTrendDirection>) {
  if (direction === 'up') return 'bg-emerald-500/12 text-emerald-200'
  if (direction === 'down') return 'bg-amber-500/12 text-amber-200'
  return 'bg-surface-container-high text-on-surface'
}

export default function Reports() {
  const navigate = useNavigate()
  const salaries = useFinanceStore((state) => state.salaries)
  const transactions = useFinanceStore((state) => state.transactions)
  const debts = useFinanceStore((state) => state.debts)
  const wishlist = useFinanceStore((state) => state.wishlist)
  const events = useFinanceStore((state) => state.events)
  const monthlyPlanningHistory = useFinanceStore((state) => state.monthlyPlanningHistory)
  const formula = usePreferencesStore((state) => state.formula)
  const [isExporting, setIsExporting] = useState(false)
  const [spendingTrendGranularity, setSpendingTrendGranularity] = useState<SpendingTrendGranularity>('monthly')
  const [comparePreviousTrend, setComparePreviousTrend] = useState(true)
  const [visibleSpendingTrendCategories, setVisibleSpendingTrendCategories] = useState<SpendingTrendVisibility>({
    gastos: true,
    gustos: true,
    ahorroUsado: true,
  })

  function getTimelineTone(kind: ReturnType<typeof buildFinancialTimeline>[number]['kind']) {
    if (kind === 'salary') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
    if (kind === 'expense') return 'border-rose-500/25 bg-rose-500/10 text-rose-200'
    if (kind === 'want') return 'border-secondary/25 bg-secondary/10 text-secondary'
    if (kind === 'saving') return 'border-sky-500/25 bg-sky-500/10 text-sky-200'
    if (kind === 'debt-payment') return 'border-amber-500/25 bg-amber-500/10 text-amber-200'
    return 'border-primary/20 bg-primary/10 text-primary'
  }

  const report = useMemo(() => {
    const now = new Date()
    const currentMonthKey = getMonthKey(now)
    const currentPeriodEnd = now.toISOString().slice(0, 10)
    const previousMonthKey = getPreviousMonthKey(currentMonthKey)
    const monthlySummaries = buildMonthlySummaries({
      salaries,
      transactions,
      debts,
      monthlyPlanningHistory,
      formula,
    })
    const calendarCurrentSummary = monthlySummaries.find((entry) => entry.month === currentMonthKey)
    const closedCycles = getCanonicalPlanningHistory(monthlyPlanningHistory)
      .filter((entry) => Number.isFinite(Date.parse(entry.createdAt)) && Date.parse(entry.createdAt) <= now.getTime())
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    const latestClosedCycle = closedCycles[0]
    const cycleBeforeLatest = closedCycles[1]
    const currentPeriodStart = getFinancialPeriodStart(monthlyPlanningHistory, now)
    const latestReset = monthlyPlanningHistory.find((entry) => entry.createdAt === currentPeriodStart)
    const strictSameDayBoundary = Boolean(latestReset)
    const excludedTransactionIds = latestReset?.savingTransactionIds ?? []
    const excludedTransactionIdSet = new Set(excludedTransactionIds)
    const currentCycleTransactions = transactions.filter((transaction) => (
      !excludedTransactionIdSet.has(transaction.id)
      && isInFinancialPeriod(transaction, currentPeriodStart, strictSameDayBoundary)
      && transaction.date.slice(0, 10) <= currentPeriodEnd
    ))
    const currentOverview = getMonthlyOverview(salaries, transactions, debts, formula, {
      periodStart: currentPeriodStart,
      periodEnd: currentPeriodEnd,
      salaryMonth: currentMonthKey,
      strictSameDayBoundary,
      excludedTransactionIds,
    })
    const cycleEndsAt = getFinancialPeriodEnd(currentPeriodStart)
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const daysRemainingInCycle = Math.max(0, Math.ceil((cycleEndsAt.getTime() - startOfToday.getTime()) / 86_400_000))
    const freeBalance = Math.max(0, currentOverview.totalSalary - currentOverview.totalExpenses - currentOverview.totalWants - currentOverview.totalSavings)
    const currentSummary = {
      ...(calendarCurrentSummary ?? monthlySummaries.at(-1)!),
      salary: currentOverview.totalSalary,
      expenses: currentOverview.totalExpenses,
      wants: currentOverview.totalWants,
      savings: currentOverview.totalSavings,
      debtPaid: currentOverview.totalDebtPaid,
      freeBalance,
      budgetExpenses: currentOverview.budgetExpenses,
      budgetWants: currentOverview.budgetWants,
      budgetSavings: currentOverview.budgetSavings,
      expenseItems: currentCycleTransactions.filter((entry) => entry.type === 'expense').length,
      wantItems: currentCycleTransactions.filter((entry) => entry.type === 'want').length,
      cycleEndsAt: cycleEndsAt.toISOString(),
      daysRemainingInCycle,
      recommendedDailyAvailable: daysRemainingInCycle > 0 ? Math.round((freeBalance / daysRemainingInCycle) * 100) / 100 : 0,
    }
    const calendarPreviousSummary = monthlySummaries.find((entry) => entry.month === previousMonthKey)
    const previousSummaryBase = latestClosedCycle
      ? monthlySummaries.find((entry) => entry.month === latestClosedCycle.month) ?? calendarPreviousSummary
      : calendarPreviousSummary
    const previousSummary = latestClosedCycle && previousSummaryBase ? {
      ...previousSummaryBase,
      expenses: latestClosedCycle.expenses.filter((entry) => entry.status === 'checked').reduce((sum, entry) => sum + entry.amount, 0),
      wants: latestClosedCycle.wants.filter((entry) => entry.status === 'checked').reduce((sum, entry) => sum + entry.amount, 0),
      expenseItems: latestClosedCycle.expenses.length,
      wantItems: latestClosedCycle.wants.length,
    } : calendarPreviousSummary
    const comparisonRows = buildMonthComparison(currentSummary, previousSummary)

    const reservedForPurchasedWishlist = wishlist.reduce(
      (sum, item) => sum + (isWishlistPurchased(item) ? getWishlistReservedAmount(item) : 0),
      0,
    )
    const activeDebts = debts.filter((debt) => !debt.isSettled)
    const totalDebtRemaining = activeDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0)
    const currentEvents = events.filter((event) => event.date >= currentPeriodStart.slice(0, 10) && event.date.slice(0, 10) <= currentPeriodEnd)
    const previousCycleStart = cycleBeforeLatest?.createdAt ?? `${latestClosedCycle?.month ?? previousMonthKey}-01T00:00:00.000Z`
    const previousEvents = latestClosedCycle
      ? events.filter((event) => event.date >= previousCycleStart.slice(0, 10) && event.date < currentPeriodStart.slice(0, 10))
      : events.filter((event) => event.date.slice(0, 7) === previousMonthKey)
    const currentRankings = buildMonthlyRankings(transactions, currentMonthKey, currentPeriodStart, currentPeriodEnd)
    const previousRankings = latestClosedCycle
      ? buildMonthlyRankings(buildSnapshotTransactions(latestClosedCycle), latestClosedCycle.month)
      : buildMonthlyRankings(transactions, previousMonthKey)
    const unnecessaryInsights = buildUnnecessarySpendingInsights(transactions, currentMonthKey, currentPeriodStart, currentPeriodEnd)
    const currentTimeline = buildFinancialTimeline({
      monthKey: currentMonthKey,
      periodStart: currentPeriodStart,
      periodEnd: currentPeriodEnd,
      salaries,
      transactions,
      debts,
      events,
    })

    const metrics: ReportMetric[] = [
      {
        label: 'Ingresos del ciclo',
        current: currentSummary?.salary ?? 0,
        previous: previousSummary?.salary ?? 0,
        tone: 'primary',
      },
    ]

    const comparisonData = comparisonRows
      .filter((row) => row.key !== 'debtPaid')
      .map((row) => ({
        label: row.label,
        actual: row.current,
        previous: row.previous,
      }))

    const budgetData = [
      {
        key: 'gastos',
        label: 'Gastos',
        actual: currentSummary?.expenses ?? 0,
        budget: currentSummary?.budgetExpenses ?? 0,
        fill: 'var(--color-gastos)',
      },
      {
        key: 'gustos',
        label: 'Gustos',
        actual: currentSummary?.wants ?? 0,
        budget: currentSummary?.budgetWants ?? 0,
        fill: 'var(--color-gustos)',
      },
      {
        key: 'ahorros',
        label: 'Ahorros',
        actual: Math.max(0, (currentSummary?.savings ?? 0) - reservedForPurchasedWishlist),
        budget: currentSummary?.budgetSavings ?? 0,
        fill: 'var(--color-tertiary-container)',
      },
    ]

    const findings: Array<{ title: string; body: string; tone: 'good' | 'warn' | 'neutral' }> = []

    if ((currentSummary?.salary ?? 0) <= 0) {
      findings.push({
        title: 'Sin salario registrado para este ciclo',
        body: 'El informe existe, pero varias metas y desviaciones quedaran incompletas hasta que registres salario.',
        tone: 'warn',
      })
    } else if (currentSummary?.effectiveSalaryMonth && currentSummary.effectiveSalaryMonth !== currentMonthKey) {
      findings.push({
        title: 'La meta distribuida usa tu último salario vigente',
        body: `Como no cambiaste el salario en ${formatMonthLabel(currentMonthKey)}, la formula sigue usando el monto registrado en ${formatMonthLabel(currentSummary.effectiveSalaryMonth)}.`,
        tone: 'neutral',
      })
    }

    if ((currentSummary?.expenses ?? 0) > (currentSummary?.budgetExpenses ?? 0)) {
      findings.push({
        title: 'Los gastos esenciales estan por encima del objetivo',
        body: `Te pasaste por ${formatCurrency((currentSummary?.expenses ?? 0) - (currentSummary?.budgetExpenses ?? 0))} frente al presupuesto de gastos del ciclo.`,
        tone: 'warn',
      })
    } else {
      findings.push({
        title: 'Los gastos esenciales siguen bajo control',
        body: `Aún tienes ${formatCurrency(Math.max(0, (currentSummary?.budgetExpenses ?? 0) - (currentSummary?.expenses ?? 0)))} libres dentro del bloque de gastos del ciclo.`,
        tone: 'good',
      })
    }

    if (Math.max(0, (currentSummary?.savings ?? 0) - reservedForPurchasedWishlist) < (currentSummary?.budgetSavings ?? 0)) {
      findings.push({
        title: 'El ahorro real va por debajo de la meta',
        body: `Te faltan ${formatCurrency(Math.max(0, (currentSummary?.budgetSavings ?? 0) - Math.max(0, (currentSummary?.savings ?? 0) - reservedForPurchasedWishlist)))} para cerrar el objetivo de ahorro de este ciclo.`,
        tone: 'neutral',
      })
    } else {
      findings.push({
        title: 'La meta de ahorro del ciclo ya está cubierta',
        body: 'Tu ahorro real iguala o supera lo que exigía la fórmula para este período.',
        tone: 'good',
      })
    }

    if (activeDebts.length > 0) {
      findings.push({
        title: 'Las deudas siguen presionando la liquidez',
        body: `Quedan ${formatCurrency(totalDebtRemaining)} pendientes repartidos en ${activeDebts.length} deuda(s) activas.`,
        tone: 'warn',
      })
    }

    if (currentEvents.length > previousEvents.length) {
      findings.push({
        title: 'Este ciclo tiene más movimiento en agenda',
        body: `Hay ${currentEvents.length} evento(s) registrados frente a ${previousEvents.length} del ciclo anterior.`,
        tone: 'neutral',
      })
    }

    if ((currentSummary?.daysRemainingInCycle ?? 0) > 0) {
      findings.push({
        title: 'El salario actual debe aguantar hasta el próximo cobro',
        body: `Quedan ${currentSummary?.daysRemainingInCycle} día(s) hasta ${new Date(currentSummary?.cycleEndsAt ?? new Date().toISOString()).toLocaleDateString('es-ES')}. Tu saldo libre recomendado es ${formatCurrency(currentSummary?.recommendedDailyAvailable ?? 0)} por dia.`,
        tone: (currentSummary?.freeBalance ?? 0) > 0 ? 'neutral' : 'warn',
      })
    }

    if (unnecessaryInsights.unnecessaryTotal > 0) {
      findings.push({
        title: 'Ya detectaste dinero recuperable en gastos innecesarios',
        body: `Marcaste ${unnecessaryInsights.unnecessaryCount} gasto(s) evitables por ${formatCurrency(unnecessaryInsights.unnecessaryTotal)}. Si ese dinero hubiera ido a ahorro, el cierre de este ciclo sería más fuerte.`,
        tone: 'warn',
      })
    }

    const currentStartKey = currentPeriodStart.slice(0, 10)
    const wishlistSpendingEntries = buildWishlistSpendingEntries(wishlist)
    const currentSpendingEntries = [
      ...buildCurrentSpendingEntries(currentCycleTransactions),
      ...wishlistSpendingEntries.filter((entry) => entry.date >= currentStartKey && entry.date <= currentPeriodEnd),
    ]
    const previousCycleEntries: SpendingTrendEntry[] = latestClosedCycle ? [
      ...latestClosedCycle.expenses.flatMap((entry) => entry.status === 'checked'
        ? [{ date: entry.date.slice(0, 10), type: 'gastos' as const, amount: Math.max(0, entry.amount) }]
        : []),
      ...latestClosedCycle.wants.flatMap((entry) => entry.status === 'checked'
        ? [{ date: entry.date.slice(0, 10), type: 'gustos' as const, amount: Math.max(0, entry.amount) }]
        : []),
    ] : []
    const firstPreviousEntryDate = previousCycleEntries.reduce<string | undefined>(
      (earliest, entry) => !earliest || entry.date < earliest ? entry.date : earliest,
      undefined,
    )
    const previousTrendStart = cycleBeforeLatest?.createdAt.slice(0, 10)
      ?? firstPreviousEntryDate
      ?? currentStartKey
    const previousTrendEnd = addUtcDays(currentStartKey, -1)
    const previousSpendingEntries = [
      ...previousCycleEntries,
      ...wishlistSpendingEntries.filter((entry) => entry.date >= previousTrendStart && entry.date <= previousTrendEnd),
    ]
    const currentSavingsUsed = currentSpendingEntries.reduce(
      (sum, entry) => entry.type === 'ahorroUsado' ? sum + entry.amount : sum,
      0,
    )
    const monthlySpendingTrend = buildMonthlySpendingTrend({
      history: monthlyPlanningHistory,
      transactions,
      wishlist,
      currentPeriodStart,
      currentPeriodEnd,
      strictSameDayBoundary,
      excludedTransactionIds,
    })
    const currentTrendTotals: Record<SpendingTrendCategory, number> = {
      ...monthlySpendingTrend.currentTotals,
    }
    const spendingTrendSeries = spendingTrendGranularity === 'daily'
      ? alignWithPrevious(
          buildDailyTrend(currentSpendingEntries, currentStartKey, currentPeriodEnd),
          buildDailyTrend(previousSpendingEntries, previousTrendStart, previousTrendEnd),
        )
      : spendingTrendGranularity === 'weekly'
        ? alignWithPrevious(
            buildWeeklyTrend(currentSpendingEntries, currentStartKey, currentPeriodEnd),
            buildWeeklyTrend(previousSpendingEntries, previousTrendStart, previousTrendEnd),
          )
        : spendingTrendGranularity === 'yearly'
          ? compareWithPreviousPeriod(buildYearlyTrend(
              closedCycles,
              currentSummary.expenses,
              currentSummary.wants,
              currentSavingsUsed,
              currentPeriodStart,
              wishlistSpendingEntries,
            ))
          : compareWithPreviousPeriod(monthlySpendingTrend.series)

    const spendingTrendSignals = spendingTrendCategories.map((category) => ({
      ...category,
      total: currentTrendTotals[category.key],
      direction: getTrendDirection(spendingTrendSeries.map((entry) => entry[category.key])),
    }))

    return {
      currentMonthKey,
      currentPeriodStart,
      previousMonthKey,
      currentLabel: `Desde ${new Date(currentPeriodStart).toLocaleDateString('es-ES')}`,
      previousLabel: latestClosedCycle?.label ?? formatMonthLabel(previousMonthKey),
      currentSummary,
      previousSummary,
      metrics,
      comparisonData,
      budgetData,
      findings,
      currentRankings,
      previousRankings,
      unnecessaryInsights,
      currentTimeline,
      spendingTrendSeries,
      spendingTrendSignals,
      hasPreviousTrend: Boolean(latestClosedCycle),
    }
  }, [debts, events, formula, monthlyPlanningHistory, salaries, spendingTrendGranularity, transactions, wishlist])

  const comparisonConfig = {
    actual: { label: 'Ciclo actual', color: 'var(--color-primary)' },
    previous: { label: 'Ciclo anterior', color: 'var(--color-secondary)' },
  } satisfies ChartConfig

  const spendingTrendConfig = {
    gastos: { label: 'Gastos', color: '#3b82f6' },
    gustos: { label: 'Gustos', color: '#a855f7' },
    ahorroUsado: { label: 'Ahorro usado', color: '#10b981' },
    gastosAnterior: { label: 'Gastos · anterior', color: '#3b82f6' },
    gustosAnterior: { label: 'Gustos · anterior', color: '#a855f7' },
    ahorroUsadoAnterior: { label: 'Ahorro usado · anterior', color: '#10b981' },
  } satisfies ChartConfig
  const activeSpendingTrendCopy = spendingTrendCopy[spendingTrendGranularity]
  const canCompareSpendingTrend = spendingTrendGranularity === 'daily' || spendingTrendGranularity === 'weekly'

  function toggleSpendingTrendCategory(category: SpendingTrendCategory) {
    setVisibleSpendingTrendCategories((current) => {
      const visibleCount = Object.values(current).filter(Boolean).length
      if (current[category] && visibleCount === 1) return current
      return { ...current, [category]: !current[category] }
    })
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      await exportMonthlyReport({
        salaries,
        transactions,
        debts,
        wishlist,
        events,
        monthlyPlanningHistory,
        formula,
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-w-0 space-y-6 animate-in fade-in duration-500">
      <header className="relative overflow-hidden rounded-[28px] border border-primary/10 bg-surface px-4 py-5 shadow-vault sm:px-6 md:px-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,0.18),transparent_52%)]" />
        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit border-primary/20 bg-primary/10 text-primary">
              <ReceiptText className="size-3.5" />
              Informe del ciclo actual
            </Badge>
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-on-surface md:text-[40px]">
                Reportes
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-gray">
                Datos desde el último reset por cobro hasta hoy, con comparación contra el ciclo anterior.
              </p>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:min-w-[21rem]">
            <div className="rounded-2xl border border-graphite bg-abyss/80 px-4 py-4 shadow-vault-sm">
              <p className="text-[11px] uppercase tracking-[0.22em] text-medium-gray">Ciclo analizado</p>
              <p className="mt-2 text-lg font-semibold text-on-surface">{report.currentLabel}</p>
            </div>
            <div className="rounded-2xl border border-graphite bg-abyss/80 px-4 py-4 shadow-vault-sm">
              <p className="text-[11px] uppercase tracking-[0.22em] text-medium-gray">Comparativa</p>
              <p className="mt-2 text-lg font-semibold text-on-surface">{report.previousLabel}</p>
            </div>
            <ExportExcelButton
              loading={isExporting}
              onClick={handleExport}
              label="Descargar reporte Excel"
              className="sm:col-span-2 bg-surface-container-high text-on-surface hover:bg-surface-container-higher"
            />
          </div>
        </div>
      </header>

      <section className="grid max-w-xl gap-4">
        {report.metrics.map((metric) => {
          const delta = metric.current - metric.previous
          const percent = metric.previous === 0 ? (metric.current === 0 ? 0 : 100) : Math.round((delta / metric.previous) * 100)
          const overBudget = metric.budget !== undefined && metric.current > metric.budget

          return (
            <Card key={metric.label} className="border-graphite bg-surface shadow-vault">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardDescription className="text-[11px] uppercase tracking-[0.22em] text-medium-gray">
                      {metric.label}
                    </CardDescription>
                    <CardTitle className="mt-3 text-[28px] font-semibold text-on-surface sm:text-[30px]">
                      {formatCurrency(metric.current)}
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className={`border ${toneClasses(metric.tone)}`}>
                    {delta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                    {percent}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="rounded-2xl border border-graphite bg-abyss/85 px-4 py-3">
                  <p className="text-xs text-muted-gray">Ciclo anterior</p>
                  <p className="mt-1 text-sm font-medium text-on-surface">{formatCurrency(metric.previous)}</p>
                </div>
                {metric.budget !== undefined ? (
                  <div className="flex items-center justify-between text-xs text-muted-gray">
                    <span>Meta del ciclo</span>
                    <span className={overBudget ? 'text-warning' : 'text-on-surface'}>
                      {formatCurrency(metric.budget)}
                    </span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-amber-500/20 bg-surface shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Ahorro potencial rescatable</CardTitle>
            <CardDescription className="text-muted-gray">
              Simulación directa de cuánto dinero pudo quedarse contigo en vez de salir en compras evitables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-graphite bg-abyss/85 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-medium-gray">Marcado innecesario</p>
                <p className="mt-2 text-2xl font-semibold text-on-surface">{formatCurrency(report.unnecessaryInsights.unnecessaryTotal)}</p>
              </div>
              <div className="rounded-2xl border border-graphite bg-abyss/85 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-medium-gray">Gastos marcados</p>
                <p className="mt-2 text-2xl font-semibold text-on-surface">{report.unnecessaryInsights.unnecessaryCount}</p>
              </div>
              <div className="rounded-2xl border border-graphite bg-abyss/85 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-medium-gray">Ahorro simulado</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-200">
                  {formatCurrency((report.currentSummary?.savings ?? 0) + report.unnecessaryInsights.unnecessaryTotal)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4">
              <p className="text-sm font-semibold text-on-surface">¿Qué significa esto?</p>
              <p className="mt-2 text-sm leading-6 text-muted-gray">
                Si los {formatCurrency(report.unnecessaryInsights.unnecessaryTotal)} que marcaste como innecesarios no hubieran salido de tu bolsillo y en cambio los hubieras pasado a ahorro, cerrarías el ciclo con un ahorro simulado de {formatCurrency((report.currentSummary?.savings ?? 0) + report.unnecessaryInsights.unnecessaryTotal)}.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Fugas detectadas</CardTitle>
            <CardDescription className="text-muted-gray">
              Ranking de las salidas evitables desde el último reset hasta hoy.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-medium-gray">Por categoría</p>
              {report.unnecessaryInsights.topCategories.length > 0 ? report.unnecessaryInsights.topCategories.map((entry, index) => (
                <div key={entry.label} className="rounded-2xl border border-graphite bg-abyss/85 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{index + 1}. {entry.label}</p>
                      <p className="mt-1 text-xs text-muted-gray">{entry.count} gasto(s) marcados</p>
                    </div>
                    <Badge variant="secondary" className="bg-amber-500/12 text-amber-200">
                      {formatCurrency(entry.totalAmount)}
                    </Badge>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-graphite bg-abyss/60 p-4 text-sm text-muted-gray">
                  Aún no has marcado gastos innecesarios en este ciclo.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-medium-gray">Por producto</p>
              {report.unnecessaryInsights.topProducts.length > 0 ? report.unnecessaryInsights.topProducts.map((entry, index) => (
                <div key={entry.label} className="rounded-2xl border border-graphite bg-abyss/85 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{index + 1}. {entry.label}</p>
                      <p className="mt-1 text-xs text-muted-gray">{entry.count} repetición(es)</p>
                    </div>
                    <Badge variant="secondary" className="bg-rose-500/12 text-rose-200">
                      {formatCurrency(entry.totalAmount)}
                    </Badge>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-graphite bg-abyss/60 p-4 text-sm text-muted-gray">
                  Cuando marques fugas evitables, aquí verás cuáles son las que más dinero se están tragando.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <SpendingHistory
        transactions={transactions}
        monthlyPlanningHistory={monthlyPlanningHistory}
        wishlist={wishlist}
        periodStart={report.currentPeriodStart}
      />

      <section>
        <Card className="min-w-0 overflow-hidden border-graphite bg-surface shadow-vault">
          <CardHeader className="flex flex-col items-start justify-between gap-4 sm:flex-row">
            <div className="min-w-0">
              <CardTitle className="text-on-surface">Comparador entre ciclos</CardTitle>
              <CardDescription className="text-muted-gray">
                Cruce visual del ciclo actual contra el anterior para salario, gasto, gusto, ahorro y saldo libre.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="max-w-full shrink-0 bg-surface-container-high text-on-surface">
              <CalendarDays className="size-3.5" />
              {report.currentMonthKey} vs {report.previousMonthKey}
            </Badge>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="overflow-x-auto overscroll-x-contain pb-2">
              <ChartContainer config={comparisonConfig} className="h-[300px] w-full min-w-[520px] lg:min-w-0">
                <BarChart data={report.comparisonData} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="actual" radius={10} fill="var(--color-primary)" />
                  <Bar dataKey="previous" radius={10} fill="var(--color-secondary)" />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

      </section>

      <section className="grid gap-4">
        <Card className="min-w-0 overflow-hidden border-graphite bg-surface shadow-vault">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-on-surface">Línea temporal: Gastos vs Gustos</CardTitle>
              <CardDescription className="text-muted-gray">
                {activeSpendingTrendCopy.description} Toca cada punto para ver el importe exacto.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
                {report.spendingTrendSeries.length} {activeSpendingTrendCopy.unit}
              </Badge>
              {canCompareSpendingTrend ? (
                <Button
                  type="button"
                  size="sm"
                  variant={comparePreviousTrend ? 'secondary' : 'outline'}
                  aria-pressed={comparePreviousTrend}
                  disabled={!report.hasPreviousTrend}
                  onClick={() => setComparePreviousTrend((current) => !current)}
                >
                  {report.hasPreviousTrend
                    ? (comparePreviousTrend ? 'Comparando anterior' : 'Comparar anterior')
                    : 'Sin periodo anterior'}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs
              value={spendingTrendGranularity}
              onValueChange={(value) => setSpendingTrendGranularity(value as SpendingTrendGranularity)}
            >
              <TabsList className="grid h-auto w-full grid-cols-2 bg-abyss sm:w-[420px] sm:grid-cols-4">
                <TabsTrigger value="daily" className="py-1.5">Diario</TabsTrigger>
                <TabsTrigger value="weekly" className="py-1.5">Semanal</TabsTrigger>
                <TabsTrigger value="monthly" className="py-1.5">Mensual</TabsTrigger>
                <TabsTrigger value="yearly" className="py-1.5">Anual</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-3" aria-label="Series visibles">
              {report.spendingTrendSignals.map((signal) => (
                <Button
                  key={signal.key}
                  type="button"
                  variant="outline"
                  aria-pressed={visibleSpendingTrendCategories[signal.key]}
                  onClick={() => toggleSpendingTrendCategory(signal.key)}
                  className={`h-auto w-full justify-start border-graphite bg-abyss/40 px-3 py-2 text-left hover:bg-surface-container-high sm:w-auto ${visibleSpendingTrendCategories[signal.key] ? '' : 'opacity-45'}`}
                >
                  <span className="size-3 rounded-full" style={{ backgroundColor: signal.color }} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-gray">{signal.label}</span>
                    <span className={`text-sm font-semibold ${getDirectionTone(signal.direction).split(' ')[2]}`}>
                      {formatCurrency(signal.total)} · {getDirectionLabel(signal.direction)}
                    </span>
                  </div>
                </Button>
              ))}
            </div>

            {report.spendingTrendSeries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-graphite bg-abyss/70 p-8 text-center text-sm text-muted-gray">
                No hay datos de gastos o gustos para mostrar la línea temporal.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto overscroll-x-contain pb-2">
                  <ChartContainer config={spendingTrendConfig} className="h-[360px] w-full min-w-[620px] lg:h-[400px] lg:min-w-0">
                  <LineChart data={report.spendingTrendSeries} margin={{ top: 20, right: 16, left: -12, bottom: 8 }}>
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--graphite)"
                      strokeDasharray="2 4"
                      strokeOpacity={0.3}
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: 'var(--muted-gray)', fontWeight: 500 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: 'var(--muted-gray)' }}
                      width={96}
                      tickFormatter={(value) => formatCurrency(Number(value))}
                    />
                    <ChartTooltip
                      cursor={{ stroke: 'var(--primary)', strokeDasharray: '6 3', strokeOpacity: 0.5 }}
                      contentStyle={{
                        backgroundColor: 'var(--abyss)',
                        border: '1px solid var(--graphite)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                      }}
                      content={({ active, payload, label }) => {
                        if (active && payload?.length) {
                          const period = payload[0]?.payload?.period as string | undefined
                          return (
                            <div className="space-y-2 p-4">
                              <p className="text-sm font-semibold text-on-surface">{label}</p>
                              {period && period !== label ? (
                                <p className="text-xs text-muted-gray">{period}</p>
                              ) : null}
                              {payload.map((entry, index) => (
                                <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="size-2 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-xs text-muted-gray">
                                      {spendingTrendConfig[String(entry.name) as keyof typeof spendingTrendConfig]?.label ?? String(entry.name)}
                                    </span>
                                  </div>
                                  <span className="font-mono text-sm font-semibold text-on-surface">
                                    {formatCurrency(Number(entry.value))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )
                        }
                        return null
                      }}
                    />

                    {spendingTrendCategories.map((category) => visibleSpendingTrendCategories[category.key] && (
                      <Line
                        key={category.key}
                        type="monotone"
                        dataKey={category.key}
                        name={category.key}
                        stroke={category.color}
                        strokeWidth={3}
                        isAnimationActive
                        animationDuration={600}
                        dot={{ r: 4, fill: category.color, stroke: 'var(--surface)', strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: category.color, stroke: 'var(--surface)', strokeWidth: 3 }}
                        connectNulls={false}
                      />
                    ))}

                    {canCompareSpendingTrend && comparePreviousTrend && report.hasPreviousTrend && spendingTrendCategories.map((category) => (
                      visibleSpendingTrendCategories[category.key] && (
                        <Line
                          key={`${category.key}-anterior`}
                          type="monotone"
                          dataKey={`${category.key}Anterior`}
                          name={`${category.key}Anterior`}
                          stroke={category.color}
                          strokeWidth={2}
                          strokeDasharray="7 5"
                          strokeOpacity={0.72}
                          isAnimationActive
                          animationDuration={600}
                          dot={false}
                          activeDot={{ r: 5, fill: category.color, stroke: 'var(--surface)', strokeWidth: 2 }}
                          connectNulls={false}
                        />
                      )
                    ))}
                  </LineChart>
                  </ChartContainer>
                </div>

                <div className="grid gap-3 rounded-lg border border-graphite/50 bg-abyss/40 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {spendingTrendCategories.map((category) => {
                    if (!visibleSpendingTrendCategories[category.key]) return null
                    const values = report.spendingTrendSeries.map((item) => item[category.key])
                    const average = values.reduce((sum, value) => sum + value, 0) / values.length
                    return (
                      <div key={`summary-${category.key}`}>
                        <p className="text-xs uppercase tracking-widest text-muted-gray">Promedio de {category.label}</p>
                        <p className="mt-2 text-lg font-semibold" style={{ color: category.color }}>
                          {formatCurrency(average)}
                        </p>
                        <p className="mt-1 text-xs text-muted-gray">
                          Máximo: {formatCurrency(Math.max(...values))} | Mínimo: {formatCurrency(Math.min(...values))}
                        </p>
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-gray">
                  <span className="flex items-center gap-2"><span className="h-0.5 w-7 bg-on-surface" /> Periodo actual</span>
                  {canCompareSpendingTrend && comparePreviousTrend && report.hasPreviousTrend ? (
                    <span className="flex items-center gap-2"><span className="w-7 border-t-2 border-dashed border-muted-gray" /> Periodo anterior</span>
                  ) : null}
                  <span>Haz clic en una categoría para ocultarla o mostrarla.</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

      </section>

      <section className="grid gap-4">
        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-on-surface">Timeline financiero</CardTitle>
              <CardDescription className="text-muted-gray">
                Una lectura del flujo desde el último reset, con salario, compras, ahorro, pagos y eventos.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
              Flujo de {report.currentLabel}
            </Badge>
          </CardHeader>
          <CardContent>
            {report.currentTimeline.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-graphite bg-abyss/70 p-8 text-center text-sm text-muted-gray">
                Aún no hay movimientos suficientes en este ciclo para dibujar el timeline financiero.
              </div>
            ) : (
              <div className="max-h-[520px] space-y-4 overflow-y-auto overscroll-contain pr-3 [scrollbar-gutter:stable]">
                {report.currentTimeline.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="relative"
                  >
                    <div className="hidden sm:block">
                      <div className={`absolute left-0 top-5 flex size-10 items-center justify-center rounded-2xl border ${getTimelineTone(entry.kind)}`}>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">{entry.dayLabel.split(' ')[0]}</span>
                      </div>
                      <div className="absolute left-10 top-10 h-px w-10 bg-gradient-to-r from-primary/35 to-transparent" />
                      {index < report.currentTimeline.length - 1 ? (
                        <div className="absolute left-5 top-[52px] h-8 w-px bg-gradient-to-b from-primary/30 via-secondary/20 to-transparent" />
                      ) : null}
                    </div>

                    <div className="rounded-[24px] border border-graphite bg-[linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] p-4 transition-all hover:border-primary/30 hover:bg-surface-container-low sm:ml-16">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className={`border ${getTimelineTone(entry.kind)}`}>
                              {entry.kind === 'salary'
                                ? 'Ingreso'
                                : entry.kind === 'expense'
                                  ? 'Gasto'
                                  : entry.kind === 'want'
                                    ? 'Gusto'
                                    : entry.kind === 'saving'
                                      ? 'Ahorro'
                                      : entry.kind === 'debt-payment'
                                        ? 'Pago'
                                        : 'Evento'}
                            </Badge>
                            <span className="text-xs uppercase tracking-[0.16em] text-medium-gray">{entry.dayLabel}</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-on-surface">{entry.title}</p>
                          <p className="mt-1 text-sm text-muted-gray">{entry.description}</p>
                        </div>

                        <div className="sm:text-right">
                          <p
                            className={`text-base font-semibold ${entry.signedAmount > 0
                              ? 'text-emerald-200'
                              : entry.signedAmount < 0
                                ? 'text-rose-200'
                                : 'text-on-surface'
                              }`}
                          >
                            {entry.signedAmount > 0 ? '+' : entry.signedAmount < 0 ? '-' : ''}
                            {formatCurrency(Math.abs(entry.amount))}
                          </p>
                          <p className="mt-1 text-xs text-muted-gray">
                            {entry.kind === 'event'
                              ? 'No descuenta saldo directo'
                              : `Saldo: ${formatCurrency(entry.balanceAfter ?? 0)}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Siguientes pasos sugeridos</CardTitle>
            <CardDescription className="text-muted-gray">
              Accesos rápidos para corregir lo que el informe detecta.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" className="justify-between bg-surface-container-high text-on-surface hover:bg-surface-container-higher" onClick={() => navigate('/salary')}>Revisar salario del ciclo<ArrowRight className="size-4" /></Button>
            <Button variant="secondary" className="justify-between bg-surface-container-high text-on-surface hover:bg-surface-container-higher" onClick={() => navigate('/expenses')}>Ajustar gastos esenciales<ArrowRight className="size-4" /></Button>
            <Button variant="secondary" className="justify-between bg-surface-container-high text-on-surface hover:bg-surface-container-higher" onClick={() => navigate('/wants')}>Ajustar gustos y caprichos<ArrowRight className="size-4" /></Button>
            <Button variant="secondary" className="justify-between bg-surface-container-high text-on-surface hover:bg-surface-container-higher" onClick={() => navigate('/debts')}>Revisar plan de deudas<ArrowRight className="size-4" /></Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Top categorías del ciclo actual</CardTitle>
            <CardDescription className="text-muted-gray">
              Las categorías que más dinero consumieron en {report.currentLabel}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.currentRankings.topCategoriesByAmount.length > 0 ? report.currentRankings.topCategoriesByAmount.map((entry, index) => (
              <div key={`${entry.type}-${entry.label}`} className="rounded-2xl border border-graphite bg-abyss/85 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{index + 1}. {entry.label}</p>
                    <p className="mt-1 text-xs text-muted-gray">
                      {entry.type === 'expense' ? 'Gasto' : 'Gusto'} · {entry.count} movimiento(s)
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {formatCurrency(entry.totalAmount)}
                  </Badge>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-gray">Todavía no hay movimientos en este ciclo para calcular categorías.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Lo más repetido</CardTitle>
            <CardDescription className="text-muted-gray">
              Patrones comparados entre el ciclo anterior y el actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-medium-gray">Categorías repetidas este ciclo</p>
              {report.currentRankings.topCategoriesByCount.slice(0, 3).map((entry) => (
                <div key={`repeat-category-${entry.type}-${entry.label}`} className="flex items-center justify-between gap-3 rounded-2xl border border-graphite bg-abyss/85 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-on-surface">{entry.label}</p>
                    <p className="text-xs text-muted-gray">{entry.type === 'expense' ? 'Gasto' : 'Gusto'}</p>
                  </div>
                  <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
                    {entry.count}x
                  </Badge>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-medium-gray">Productos repetidos en el ciclo anterior</p>
              {report.previousRankings.topProductsByCount.slice(0, 3).map((entry) => (
                <div key={`repeat-product-${entry.type}-${entry.label}`} className="flex items-center justify-between gap-3 rounded-2xl border border-graphite bg-abyss/85 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-on-surface">{entry.label}</p>
                    <p className="text-xs text-muted-gray">{entry.category}</p>
                  </div>
                  <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
                    {entry.count}x
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Desviación contra presupuesto</CardTitle>
            <CardDescription className="text-muted-gray">
              Mide qué tan lejos está el comportamiento real frente a la fórmula del ciclo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.budgetData.map((entry) => {
              const delta = entry.actual - entry.budget
              const ratio = entry.budget > 0 ? Math.min(100, Math.round((entry.actual / entry.budget) * 100)) : 0

              return (
                <div key={entry.key} className="rounded-2xl border border-graphite bg-abyss/85 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-on-surface">{entry.label}</p>
                      <p className="text-xs text-muted-gray">Meta {formatCurrency(entry.budget)}</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={delta > 0 ? 'bg-warning/15 text-warning' : 'bg-emerald-500/15 text-emerald-200'}
                    >
                      {delta > 0 ? `+${formatCurrency(delta)}` : formatCurrency(Math.abs(delta))}
                    </Badge>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${ratio}%`, background: entry.fill }} />
                  </div>
                  <p className="mt-3 text-xs text-muted-gray">
                    {delta > 0
                      ? `Vas por encima del presupuesto en ${formatCurrency(delta)}.`
                      : `Todavia te quedan ${formatCurrency(Math.abs(delta))} antes de tocar el limite.`}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden border-graphite bg-surface shadow-vault">
          <CardHeader className="flex flex-col items-start justify-between gap-4 sm:flex-row">
            <div className="min-w-0">
              <CardTitle className="text-on-surface">Hallazgos clave</CardTitle>
              <CardDescription className="text-muted-gray">
                Resumen interpretado para leer el mes sin tener que revisar pantalla por pantalla.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <Sparkles className="size-3.5" />
              Insight block
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {report.findings.map((finding) => (
              <div
                key={finding.title}
                className={`rounded-2xl border p-4 ${finding.tone === 'good'
                  ? 'border-emerald-500/20 bg-emerald-500/8'
                  : finding.tone === 'warn'
                    ? 'border-amber-500/20 bg-amber-500/8'
                    : 'border-graphite bg-abyss/70'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${finding.tone === 'good'
                    ? 'bg-emerald-500/12 text-emerald-200'
                    : finding.tone === 'warn'
                      ? 'bg-amber-500/12 text-amber-200'
                      : 'bg-surface-container-high text-on-surface'
                    }`}>
                    {finding.tone === 'warn' ? <AlertTriangle className="size-4" /> : finding.tone === 'good' ? <TrendingUp className="size-4" /> : <Sparkles className="size-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{finding.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-gray">{finding.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

    </div>
  )
}
