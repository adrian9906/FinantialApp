import { useMemo, useState, type ComponentProps } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  getWishlistReservedAmount,
  isInFinancialPeriod,
  isWishlistPurchased,
  parseExpenseDescription,
  parseWantDescription,
  type MonthlyPlanningHistory,
  type Transaction,
  type WishlistItem,
} from '@plata/shared'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatMoney, formatMoneyInput, useCurrencyInput } from '@/lib/currency'
import { getCanonicalPlanningHistory } from '@/lib/planningHistory'
import { cn } from '@/lib/utils'

type Granularity = 'daily' | 'weekly' | 'monthly'
type CategoryKey = 'gastos' | 'gustos' | 'ahorroUsado'
type SpendingEntry = { date: string; category: CategoryKey; amount: number }
type CategoryVisibility = Record<CategoryKey, boolean>

const DAY_IN_MS = 86_400_000
const categories: Array<{ key: CategoryKey; label: string; color: string }> = [
  { key: 'gastos', label: 'Gastos', color: '#3b82f6' },
  { key: 'gustos', label: 'Gustos', color: '#a855f7' },
  { key: 'ahorroUsado', label: 'Ahorro usado', color: '#10b981' },
]

const trendConfig = {
  gastos: { label: 'Gastos', color: '#3b82f6' },
  gustos: { label: 'Gustos', color: '#a855f7' },
  ahorroUsado: { label: 'Ahorro usado en deseos', color: '#10b981' },
  gastosActual: { label: 'Gastos · actual', color: '#3b82f6' },
  gastosAnterior: { label: 'Gastos · anterior', color: '#3b82f6' },
  gustosActual: { label: 'Gustos · actual', color: '#a855f7' },
  gustosAnterior: { label: 'Gustos · anterior', color: '#a855f7' },
  ahorroUsadoActual: { label: 'Ahorro usado · actual', color: '#10b981' },
  ahorroUsadoAnterior: { label: 'Ahorro usado · anterior', color: '#10b981' },
} satisfies ChartConfig

const cycleDateFormatter = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' })
const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' })

function dayNumber(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return Date.UTC(year, month - 1, day) / DAY_IN_MS
}

function dayDistance(start: string, end: string) {
  return Math.round(dayNumber(end) - dayNumber(start))
}

function previousMonthDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const targetMonth = month === 1 ? 12 : month - 1
  const targetYear = month === 1 ? year - 1 : year
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

function sumCategory(entries: SpendingEntry[], category: CategoryKey) {
  return entries.reduce((sum, entry) => entry.category === category ? sum + entry.amount : sum, 0)
}

function nextMonthKey(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const next = new Date(Date.UTC(year, month, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
}

function formatMonth(monthKey: string, showYear: boolean) {
  const [year, month] = monthKey.split('-').map(Number)
  const name = monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)))
  const label = name.charAt(0).toUpperCase() + name.slice(1)
  return showYear ? `${label} ${year}` : label
}

function buildMonthlySeries(
  closedCycles: MonthlyPlanningHistory[],
  currentTotals: Record<CategoryKey, number>,
  wishlist: WishlistItem[],
  currentPeriodStart: string,
  currentEnd: string,
) {
  const totals = new Map<string, Record<CategoryKey, number>>()
  const ensureMonth = (monthKey: string) => {
    const current = totals.get(monthKey) ?? { gastos: 0, gustos: 0, ahorroUsado: 0 }
    totals.set(monthKey, current)
    return current
  }
  closedCycles.forEach((cycle) => {
    const month = ensureMonth(cycle.month)
    month.gastos += cycle.expenses.reduce(
      (sum, entry) => entry.status === 'checked' ? sum + Math.max(0, entry.amount) : sum,
      0,
    )
    month.gustos += cycle.wants.reduce(
      (sum, entry) => entry.status === 'checked' ? sum + Math.max(0, entry.amount) : sum,
      0,
    )
  })

  wishlist.forEach((item) => {
    if (!isWishlistPurchased(item) || !item.purchasedAt) return
    if (Date.parse(item.purchasedAt) >= Date.parse(currentPeriodStart)) return
    const monthKey = item.purchasedAt.slice(0, 7)
    const month = totals.get(monthKey)
    if (month) month.ahorroUsado += getWishlistReservedAmount(item)
  })

  const currentMonth = currentEnd.slice(0, 7)
  const current = ensureMonth(currentMonth)
  current.gastos += currentTotals.gastos
  current.gustos += currentTotals.gustos
  current.ahorroUsado += currentTotals.ahorroUsado
  const populatedMonths = [...totals.keys()].filter((monthKey) => monthKey <= currentMonth).sort()
  const firstMonth = populatedMonths[0] ?? currentMonth
  const monthKeys: string[] = []
  for (let monthKey = firstMonth; monthKey <= currentMonth; monthKey = nextMonthKey(monthKey)) {
    monthKeys.push(monthKey)
  }
  const showYear = new Set(monthKeys.map((monthKey) => monthKey.slice(0, 4))).size > 1

  return monthKeys.map((monthKey) => ({
    label: formatMonth(monthKey, showYear),
    ...ensureMonth(monthKey),
  }))
}

function convertSeriesValues<T extends Record<string, string | number | null>>(rows: T[], exchangeRate: number) {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, typeof value === 'number' ? value * exchangeRate : value]),
  ) as T)
}

function buildAlignedSeries({
  currentEntries,
  previousEntries,
  currentStart,
  currentEnd,
  previousStart,
  previousEnd,
  granularity,
}: {
  currentEntries: SpendingEntry[]
  previousEntries: SpendingEntry[]
  currentStart: string
  currentEnd: string
  previousStart: string
  previousEnd: string
  granularity: Exclude<Granularity, 'monthly'>
}) {
  const bucketSize = granularity === 'daily' ? 1 : 7
  const currentBucketCount = Math.max(1, Math.floor(dayDistance(currentStart, currentEnd) / bucketSize) + 1)
  const previousBucketCount = Math.max(1, Math.ceil(Math.max(0, dayDistance(previousStart, previousEnd)) / bucketSize))
  const bucketCount = Math.max(currentBucketCount, previousBucketCount)
  const points = Array.from({ length: bucketCount }, (_, index) => ({
    label: granularity === 'daily' ? `Día ${index + 1}` : `Semana ${index + 1}`,
    gastosActual: index < currentBucketCount ? 0 : null,
    gastosAnterior: index < previousBucketCount ? 0 : null,
    gustosActual: index < currentBucketCount ? 0 : null,
    gustosAnterior: index < previousBucketCount ? 0 : null,
    ahorroUsadoActual: index < currentBucketCount ? 0 : null,
    ahorroUsadoAnterior: index < previousBucketCount ? 0 : null,
  }))

  const addEntries = (entries: SpendingEntry[], start: string, suffix: 'Actual' | 'Anterior') => {
    entries.forEach((entry) => {
      const index = Math.floor(dayDistance(start, entry.date) / bucketSize)
      if (index < 0 || index >= points.length) return
      const key = `${entry.category}${suffix}` as keyof typeof points[number]
      const currentValue = points[index][key]
      if (typeof currentValue === 'number') {
        Object.assign(points[index], { [key]: currentValue + entry.amount })
      }
    })
  }

  addEntries(currentEntries, currentStart, 'Actual')
  addEntries(previousEntries, previousStart, 'Anterior')
  return points
}

export function SpendingTrendCard({
  history,
  transactions,
  wishlist,
  currentPeriodStart,
  strictSameDayBoundary,
}: {
  history: MonthlyPlanningHistory[]
  transactions: Transaction[]
  wishlist: WishlistItem[]
  currentPeriodStart: string
  strictSameDayBoundary: boolean
}) {
  const { currency } = useCurrencyInput()
  const [granularity, setGranularity] = useState<Granularity>('weekly')
  const [showPrevious, setShowPrevious] = useState(true)
  const [visibleCategories, setVisibleCategories] = useState<CategoryVisibility>({
    gastos: true,
    gustos: true,
    ahorroUsado: true,
  })

  const analysis = useMemo(() => {
    const currentStart = currentPeriodStart.slice(0, 10)
    const currentEnd = new Date().toISOString().slice(0, 10)
    const closedCycles = getCanonicalPlanningHistory(history)
      .filter((cycle) => Number.isFinite(Date.parse(cycle.createdAt)) && Date.parse(cycle.createdAt) <= Date.parse(currentPeriodStart))
    const previousCycle = closedCycles.at(-1)
    const previousStart = closedCycles.at(-2)?.createdAt.slice(0, 10) ?? previousMonthDate(currentStart)
    const previousEnd = currentStart

    const currentEntries = transactions.flatMap<SpendingEntry>((transaction) => {
      if (!isInFinancialPeriod(transaction, currentPeriodStart, strictSameDayBoundary) || transaction.date.slice(0, 10) > currentEnd) return []
      if (transaction.type === 'expense') {
        return parseExpenseDescription(transaction.description).status === 'checked'
          ? [{ date: transaction.date, category: 'gastos', amount: Math.max(0, transaction.amount) }]
          : []
      }
      if (transaction.type === 'want') {
        return parseWantDescription(transaction.description).status === 'checked'
          ? [{ date: transaction.date, category: 'gustos', amount: Math.max(0, transaction.amount) }]
          : []
      }
      return []
    })

    const previousEntries: SpendingEntry[] = previousCycle ? [
      ...previousCycle.expenses
        .filter((entry) => entry.status === 'checked')
        .map((entry) => ({ date: entry.date, category: 'gastos' as const, amount: Math.max(0, entry.amount) })),
      ...previousCycle.wants
        .filter((entry) => entry.status === 'checked')
        .map((entry) => ({ date: entry.date, category: 'gustos' as const, amount: Math.max(0, entry.amount) })),
    ] : []

    wishlist.forEach((item) => {
      if (!isWishlistPurchased(item) || !item.purchasedAt) return
      const date = item.purchasedAt.slice(0, 10)
      const amount = getWishlistReservedAmount(item)
      if (amount <= 0) return
      if (Date.parse(item.purchasedAt) >= Date.parse(currentPeriodStart) && date <= currentEnd) {
        currentEntries.push({ date, category: 'ahorroUsado', amount })
      } else if (date >= previousStart && date < previousEnd) {
        previousEntries.push({ date, category: 'ahorroUsado', amount })
      }
    })

    const currentTotals = Object.fromEntries(categories.map(({ key }) => [key, sumCategory(currentEntries, key)])) as Record<CategoryKey, number>
    const monthlySeries = buildMonthlySeries(closedCycles, currentTotals, wishlist, currentPeriodStart, currentEnd)

    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
      hasPreviousCycle: Boolean(previousCycle),
      currentTotals,
      monthlySeries,
      currentEntries,
      previousEntries,
    }
  }, [currentPeriodStart, history, strictSameDayBoundary, transactions, wishlist])

  const alignedSeries = useMemo(() => granularity === 'monthly' ? [] : buildAlignedSeries({
    currentEntries: analysis.currentEntries,
    previousEntries: analysis.previousEntries,
    currentStart: analysis.currentStart,
    currentEnd: analysis.currentEnd,
    previousStart: analysis.previousStart,
    previousEnd: analysis.previousEnd,
    granularity,
  }), [analysis, granularity])
  const convertedAlignedSeries = useMemo(
    () => convertSeriesValues(alignedSeries, currency.exchangeRate),
    [alignedSeries, currency.exchangeRate],
  )
  const convertedMonthlySeries = useMemo(
    () => convertSeriesValues(analysis.monthlySeries, currency.exchangeRate),
    [analysis.monthlySeries, currency.exchangeRate],
  )

  const tooltipFormatter: NonNullable<ComponentProps<typeof ChartTooltipContent>['formatter']> = (value, name) => {
    const numericValue = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0)
    return (
      <div className="flex min-w-48 items-center justify-between gap-4">
        <span className="text-muted-foreground">{trendConfig[String(name) as keyof typeof trendConfig]?.label ?? String(name)}</span>
        <span className="font-mono font-medium text-foreground tabular-nums">{formatMoneyInput(numericValue, currency)}</span>
      </div>
    )
  }

  function toggleCategory(category: CategoryKey) {
    setVisibleCategories((current) => {
      const activeCount = Object.values(current).filter(Boolean).length
      if (current[category] && activeCount === 1) return current
      return { ...current, [category]: !current[category] }
    })
  }

  return (
    <Card className="min-w-0 overflow-hidden border-graphite bg-surface shadow-vault">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-on-surface">Evolución de gastos, gustos y ahorro usado</CardTitle>
            <CardDescription className="text-muted-gray">
              {granularity === 'monthly'
                ? 'Muestra la evolución cronológica por meses. El ahorro usado solo cuenta el dinero reservado que se gastó al comprar deseos.'
                : 'Compara el ciclo actual con el anterior. El ahorro usado solo cuenta el dinero reservado que se gastó al comprar deseos.'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
              {granularity === 'monthly'
                ? `${analysis.monthlySeries.length} mes(es)`
                : `Desde ${cycleDateFormatter.format(new Date(`${analysis.currentStart}T12:00:00Z`)).replace('.', '')}`}
            </Badge>
            {granularity !== 'monthly' ? (
              <Button
                type="button"
                size="sm"
                variant={showPrevious ? 'secondary' : 'outline'}
                aria-pressed={showPrevious}
                disabled={!analysis.hasPreviousCycle}
                onClick={() => setShowPrevious((current) => !current)}
              >
                {analysis.hasPreviousCycle ? (showPrevious ? 'Comparando anterior' : 'Comparar anterior') : 'Sin ciclo anterior'}
              </Button>
            ) : null}
          </div>
        </div>

        <Tabs value={granularity} onValueChange={(value) => setGranularity(value as Granularity)}>
          <TabsList className="grid w-full grid-cols-3 bg-abyss sm:w-80">
            <TabsTrigger value="daily">Diario</TabsTrigger>
            <TabsTrigger value="weekly">Semanal</TabsTrigger>
            <TabsTrigger value="monthly">Mensual</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" aria-label="Series visibles">
          {categories.map((category) => {
            const isVisible = visibleCategories[category.key]
            return (
              <Button
                key={category.key}
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={isVisible}
                onClick={() => toggleCategory(category.key)}
                className={cn('border-graphite bg-abyss text-on-surface', !isVisible && 'opacity-45')}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                {category.label}
                <span className="text-muted-foreground">{formatMoney(analysis.currentTotals[category.key], currency)}</span>
              </Button>
            )
          })}
        </div>

        {granularity === 'monthly' ? (
          <div className="overflow-x-auto overscroll-x-contain pb-2">
            <ChartContainer config={trendConfig} className="h-[320px] w-full min-w-[640px] lg:min-w-0">
              <LineChart accessibilityLayer data={convertedMonthlySeries} margin={{ top: 18, right: 16, left: -12, bottom: 4 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} />
                <YAxis tickLine={false} axisLine={false} width={112} tickFormatter={(value) => formatMoneyInput(Number(value), currency)} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" formatter={tooltipFormatter} />} />
                {categories.map((category) => visibleCategories[category.key] && (
                  <Line
                    key={category.key}
                    type="monotone"
                    dataKey={category.key}
                    stroke={`var(--color-${category.key})`}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ChartContainer>
          </div>
        ) : (
          <ChartContainer config={trendConfig} className="h-[320px] w-full">
            <LineChart accessibilityLayer data={convertedAlignedSeries} margin={{ top: 18, right: 16, left: -12, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={granularity === 'daily' ? 'preserveStartEnd' : 0} />
              <YAxis tickLine={false} axisLine={false} width={112} tickFormatter={(value) => formatMoneyInput(Number(value), currency)} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" formatter={tooltipFormatter} />} />
              {categories.map((category) => visibleCategories[category.key] && (
                <Line
                  key={`${category.key}-actual`}
                  type="monotone"
                  dataKey={`${category.key}Actual`}
                  stroke={`var(--color-${category.key}Actual)`}
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              ))}
              {showPrevious && analysis.hasPreviousCycle && categories.map((category) => visibleCategories[category.key] && (
                <Line
                  key={`${category.key}-anterior`}
                  type="monotone"
                  dataKey={`${category.key}Anterior`}
                  stroke={`var(--color-${category.key}Anterior)`}
                  strokeWidth={2}
                  strokeDasharray="6 5"
                  dot={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-gray">
          <span className="flex items-center gap-2"><span className="h-0.5 w-7 bg-on-surface" /> {granularity === 'monthly' ? 'Evolución mensual' : 'Ciclo actual'}</span>
          {granularity !== 'monthly' && showPrevious && analysis.hasPreviousCycle ? (
            <span className="flex items-center gap-2"><span className="w-7 border-t-2 border-dashed border-muted-gray" /> Ciclo anterior</span>
          ) : null}
          <span>Haz clic en una categoría para ocultarla o mostrarla.</span>
        </div>
      </CardContent>
    </Card>
  )
}
