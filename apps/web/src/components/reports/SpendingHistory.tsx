import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Landmark,
  PiggyBank,
  ReceiptText,
  Search,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  getExpenseCategoryLabel,
  getSavingsFundingBreakdown,
  getWantCategoryLabel,
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
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatMoney } from '@/lib/currency'

type HistoryKind = 'expense' | 'want' | 'saving'
type DateFilterPreset = 'today' | 'month' | 'custom'

type HistoryRow = {
  id: string
  name: string
  category: string
  amount: number
  date: string
  borrowedAmount?: number
}

const expenseCategoryLabels: Record<string, string> = {
  food: 'Alimentación',
  home: 'Hogar',
  services: 'Servicios',
  gym: 'Gimnasio',
  health: 'Salud',
  essentials: 'Esenciales',
}

const wantCategoryLabels: Record<string, string> = {
  outings: 'Salidas',
  shopping: 'Compras',
  gaming: 'Videojuegos',
  subscriptions: 'Suscripciones',
  selfcare: 'Cuidado personal',
}

const historyMeta = {
  expense: {
    label: 'Gastos',
    singular: 'gasto',
    totalLabel: 'Total gastado',
    color: 'var(--color-primary)',
    badgeClass: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
  },
  want: {
    label: 'Gustos',
    singular: 'gusto',
    totalLabel: 'Total en gustos',
    color: 'var(--color-secondary)',
    badgeClass: 'border-secondary/20 bg-secondary/10 text-secondary',
  },
  saving: {
    label: 'Ahorros',
    singular: 'compra con ahorros',
    totalLabel: 'Total usado de ahorros',
    color: 'var(--color-tertiary-container)',
    badgeClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  },
} satisfies Record<HistoryKind, {
  label: string
  singular: string
  totalLabel: string
  color: string
  badgeClass: string
}>

const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' })
const longDateFormatter = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
const amountFormatter = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const formatCurrency = formatMoney

function formatDate(date: string) {
  if (!date) return 'Fecha no registrada'
  return longDateFormatter.format(new Date(`${date.slice(0, 10)}T12:00:00`))
}

function normalizeDateKey(value: string) {
  return value.slice(0, 10)
}

function formatDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getPreviousMonthKey(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function matchesDateFilter(
  rowDate: string,
  preset: DateFilterPreset,
  todayKey: string,
  currentMonthKey: string,
  customFrom: string,
  customTo: string,
) {
  const normalizedDate = normalizeDateKey(rowDate)
  if (!normalizedDate) return false

  if (preset === 'today') return normalizedDate === todayKey
  if (preset === 'month') return normalizedDate.startsWith(currentMonthKey)

  if (customFrom && normalizedDate < customFrom) return false
  if (customTo && normalizedDate > customTo) return false
  return true
}

function buildSearchIndex(row: HistoryRow) {
  return [
    row.name,
    row.category,
    formatDate(row.date),
    row.date,
    amountFormatter.format(row.amount),
    String(row.amount),
    row.borrowedAmount ? amountFormatter.format(row.borrowedAmount) : '',
  ].join(' ').toLowerCase()
}

function buildMonthComparison(rows: HistoryRow[], currentMonthKey: string) {
  const previousMonthKey = getPreviousMonthKey(currentMonthKey)
  let currentMonthTotal = 0
  let previousMonthTotal = 0
  let currentMonthCount = 0
  let previousMonthCount = 0

  rows.forEach((row) => {
    const monthKey = row.date.slice(0, 7)
    if (monthKey === currentMonthKey) {
      currentMonthTotal += row.amount
      currentMonthCount += 1
      return
    }

    if (monthKey === previousMonthKey) {
      previousMonthTotal += row.amount
      previousMonthCount += 1
    }
  })

  const difference = currentMonthTotal - previousMonthTotal
  const percentChange = previousMonthTotal > 0
    ? (difference / previousMonthTotal) * 100
    : currentMonthTotal > 0
      ? 100
      : 0

  return {
    currentMonthKey,
    previousMonthKey,
    currentMonthTotal,
    previousMonthTotal,
    currentMonthCount,
    previousMonthCount,
    difference,
    percentChange,
  }
}

function getExpenseLabel(category: ReturnType<typeof parseExpenseDescription>['category']) {
  return getExpenseCategoryLabel(category) ?? expenseCategoryLabels[category] ?? category
}

function getWantLabel(category: ReturnType<typeof parseWantDescription>['category']) {
  return getWantCategoryLabel(category) ?? wantCategoryLabels[category] ?? category
}

function buildTransactionRows(transactions: Transaction[], kind: 'expense' | 'want'): HistoryRow[] {
  return transactions.flatMap((transaction) => {
    if (transaction.type !== kind) return []

    const parsed = kind === 'expense'
      ? parseExpenseDescription(transaction.description)
      : parseWantDescription(transaction.description)

    if (parsed.status !== 'checked') return []

    return [{
      id: transaction.id,
      name: parsed.itemName,
      category: kind === 'expense'
        ? getExpenseLabel(parsed.category as ReturnType<typeof parseExpenseDescription>['category'])
        : getWantLabel(parsed.category as ReturnType<typeof parseWantDescription>['category']),
      amount: Math.max(0, transaction.amount),
      date: transaction.date,
    }]
  })
}

function buildSnapshotRows(history: MonthlyPlanningHistory[], kind: 'expense' | 'want'): HistoryRow[] {
  return history.flatMap((snapshot) => {
    const entries = kind === 'expense' ? snapshot.expenses : snapshot.wants

    return entries.flatMap((entry, index) => {
      if (entry.status !== 'checked') return []

      return [{
        id: `${snapshot.id}-${kind}-${index}`,
        name: entry.itemName,
        category: kind === 'expense'
          ? getExpenseLabel(entry.category as ReturnType<typeof parseExpenseDescription>['category'])
          : getWantLabel(entry.category as ReturnType<typeof parseWantDescription>['category']),
        amount: Math.max(0, entry.amount),
        date: entry.date,
      }]
    })
  })
}

function buildSavingRows(transactions: Transaction[], wishlist: WishlistItem[]): HistoryRow[] {
  return getSavingsFundingBreakdown(transactions, wishlist).usages.map((usage) => ({
    id: usage.id,
    name: usage.label,
    category: usage.category,
    amount: usage.amount,
    date: usage.date,
    borrowedAmount: usage.borrowedAmount,
  }))
}

function buildMonthlySeries(rows: HistoryRow[]) {
  const totals = new Map<string, number>()

  rows.forEach((row) => {
    if (!/^\d{4}-\d{2}/.test(row.date)) return
    const month = row.date.slice(0, 7)
    totals.set(month, (totals.get(month) ?? 0) + row.amount)
  })

  const recordedMonths = [...totals.keys()].sort()
  if (recordedMonths.length === 0) return []

  const [startYear, startMonth] = recordedMonths[0].split('-').map(Number)
  const [endYear, endMonth] = recordedMonths.at(-1)!.split('-').map(Number)
  const cursor = new Date(startYear, startMonth - 1, 1)
  const end = new Date(endYear, endMonth - 1, 1)
  const series: Array<{ month: string; label: string; total: number }> = []

  while (cursor <= end && series.length < 240) {
    const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    series.push({
      month,
      label: monthFormatter.format(cursor).replace('.', ''),
      total: totals.get(month) ?? 0,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return series
}

interface SpendingHistoryProps {
  transactions: Transaction[]
  monthlyPlanningHistory: MonthlyPlanningHistory[]
  wishlist: WishlistItem[]
}

export function SpendingHistory({ transactions, monthlyPlanningHistory, wishlist }: SpendingHistoryProps) {
  const [kind, setKind] = useState<HistoryKind>('expense')
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('month')
  const [searchText, setSearchText] = useState('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState('10')
  const deferredSearchText = useDeferredValue(searchText)

  const today = useMemo(() => new Date(), [])
  const todayKey = formatDateInputValue(today)
  const currentMonthKey = todayKey.slice(0, 7)

  const histories = useMemo(() => ({
    expense: [
      ...buildTransactionRows(transactions, 'expense'),
      ...buildSnapshotRows(monthlyPlanningHistory, 'expense'),
    ],
    want: [
      ...buildTransactionRows(transactions, 'want'),
      ...buildSnapshotRows(monthlyPlanningHistory, 'want'),
    ],
    saving: buildSavingRows(transactions, wishlist),
  }), [monthlyPlanningHistory, transactions, wishlist])

  const rows = useMemo(
    () => [...histories[kind]].sort((left, right) => right.date.localeCompare(left.date)),
    [histories, kind],
  )
  const searchQuery = deferredSearchText.trim().toLowerCase()
  const filteredRows = useMemo(
    () => rows.filter((row) => {
      if (!matchesDateFilter(row.date, dateFilter, todayKey, currentMonthKey, customFrom, customTo)) return false
      if (!searchQuery) return true
      return buildSearchIndex(row).includes(searchQuery)
    }),
    [currentMonthKey, customFrom, customTo, dateFilter, rows, searchQuery, todayKey],
  )
  const monthlySeries = useMemo(() => buildMonthlySeries(filteredRows), [filteredRows])
  const total = filteredRows.reduce((sum, row) => sum + row.amount, 0)
  const totalBorrowedUsed = filteredRows.reduce((sum, row) => sum + (row.borrowedAmount ?? 0), 0)
  const meta = historyMeta[kind]
  const highestMonth = monthlySeries.reduce<(typeof monthlySeries)[number] | null>(
    (highest, month) => !highest || month.total > highest.total ? month : highest,
    null,
  )
  const lowestMonth = monthlySeries.reduce<(typeof monthlySeries)[number] | null>(
    (lowest, month) => !lowest || month.total < lowest.total ? month : lowest,
    null,
  )
  const monthComparison = useMemo(
    () => buildMonthComparison(rows, currentMonthKey),
    [currentMonthKey, rows],
  )
  const perPageNumber = Number(perPage)
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPageNumber))
  const paginatedRows = filteredRows.slice((page - 1) * perPageNumber, page * perPageNumber)
  const chartConfig = {
    total: { label: meta.totalLabel, color: meta.color },
  } satisfies ChartConfig

  useEffect(() => {
    setPage(1)
  }, [kind, dateFilter, customFrom, customTo, searchQuery, perPage])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  return (
    <section className="space-y-4" aria-labelledby="money-trail-title">
      <Card className="overflow-hidden border-graphite bg-surface shadow-vault">
        <CardHeader className="gap-5 border-b border-graphite/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-primary">
              <Landmark className="size-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">Traza del dinero</span>
            </div>
            <CardTitle id="money-trail-title" className="text-on-surface">¿A dónde se ha ido mi dinero?</CardTitle>
            <CardDescription className="mt-2 text-muted-gray">
              Consulta todas las compras registradas, incluidos los cierres mensuales y los deseos pagados con tus ahorros.
            </CardDescription>
          </div>

          <div className="w-full lg:w-[260px]">
            <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-medium-gray">Mostrar histórico de</p>
            <Select value={kind} onValueChange={(value) => setKind(value as HistoryKind)}>
              <SelectTrigger className="h-11 border-graphite bg-abyss text-on-surface focus:ring-primary/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-graphite bg-surface text-on-surface">
                <SelectItem value="expense">Gastos</SelectItem>
                <SelectItem value="want">Gustos</SelectItem>
                <SelectItem value="saving">Ahorros usados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="border-b border-graphite/80 bg-abyss/35 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { id: 'today', label: 'Hoy' },
                  { id: 'month', label: 'Este mes' },
                  { id: 'custom', label: 'Fecha personalizada' },
                ] as const).map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant={dateFilter === option.id ? 'secondary' : 'outline'}
                    size="sm"
                    className={dateFilter === option.id
                      ? 'border-secondary/30 bg-secondary/15 text-secondary'
                      : 'border-graphite bg-surface text-muted-gray hover:bg-surface-container-low hover:text-on-surface'}
                    onClick={() => setDateFilter(option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_auto_auto_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-medium-gray" />
                  <Input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Buscar por concepto, categoría, fecha o importe"
                    className="h-10 border-graphite bg-surface-container-low pl-9 text-on-surface placeholder:text-medium-gray"
                  />
                </div>

                {dateFilter === 'custom' ? (
                  <>
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(event) => setCustomFrom(event.target.value)}
                      className="h-10 border-graphite bg-surface-container-low text-on-surface"
                      aria-label="Fecha inicial personalizada"
                    />
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(event) => setCustomTo(event.target.value)}
                      className="h-10 border-graphite bg-surface-container-low text-on-surface"
                      aria-label="Fecha final personalizada"
                    />
                  </>
                ) : null}

                <div className="min-w-[132px]">
                  <Select value={perPage} onValueChange={(value) => setPerPage(value ?? '10')}>
                    <SelectTrigger className="h-10 w-full border-graphite bg-surface-container-low text-on-surface focus:ring-primary/40">
                      <SelectValue placeholder="Filas por página" />
                    </SelectTrigger>
                    <SelectContent className="border-graphite bg-surface text-on-surface">
                      <SelectItem value="10">10 por página</SelectItem>
                      <SelectItem value="25">25 por página</SelectItem>
                      <SelectItem value="50">50 por página</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-2xl border border-graphite/80 bg-surface px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-medium-gray">Este mes</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-on-surface">{formatCurrency(monthComparison.currentMonthTotal)}</p>
                  <p className="mt-1 text-xs text-muted-gray">{monthComparison.currentMonthCount} movimientos en {monthComparison.currentMonthKey}</p>
                </div>
                <div className="rounded-2xl border border-graphite/80 bg-surface px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-medium-gray">Mes anterior</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-on-surface">{formatCurrency(monthComparison.previousMonthTotal)}</p>
                  <p className="mt-1 text-xs text-muted-gray">{monthComparison.previousMonthCount} movimientos en {monthComparison.previousMonthKey}</p>
                </div>
                <div className="rounded-2xl border border-graphite/80 bg-surface px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-medium-gray">Comparación mensual</p>
                  <p className={`mt-1 text-lg font-semibold tabular-nums ${monthComparison.difference <= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
                    {monthComparison.difference > 0 ? '+' : ''}{formatCurrency(monthComparison.difference)}
                  </p>
                  <p className="mt-1 text-xs text-muted-gray">
                    {monthComparison.previousMonthTotal > 0
                      ? `${monthComparison.percentChange > 0 ? '+' : ''}${monthComparison.percentChange.toFixed(1)}% frente al mes anterior`
                      : monthComparison.currentMonthTotal > 0
                        ? 'Sin base previa: este es el primer mes con movimientos'
                        : 'Aún no hay movimientos en ninguno de los dos meses'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid border-b border-graphite/80 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className={`flex size-10 items-center justify-center rounded-2xl border ${meta.badgeClass}`}>
                  {kind === 'expense' ? <ReceiptText className="size-4" /> : kind === 'want' ? <ShoppingBag className="size-4" /> : <PiggyBank className="size-4" />}
                </div>
                <div>
                  <p className="text-xs text-muted-gray">{meta.totalLabel}</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-on-surface">{formatCurrency(total)}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-graphite/80 px-5 py-4 md:border-l md:border-t-0 sm:px-6">
              {kind === 'saving' ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-amber-200">Dinero de deuda usado</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-amber-200">{formatCurrency(totalBorrowedUsed)}</p>
                </div>
              ) : null}
              <Badge variant="secondary" className={meta.badgeClass}>
                {filteredRows.length} {filteredRows.length === 1 ? meta.singular : 'movimientos'}
              </Badge>
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <CalendarDays className="mx-auto size-7 text-medium-gray" />
              <p className="mt-4 text-sm font-medium text-on-surface">No encontramos movimientos para ese filtro</p>
              <p className="mt-1 text-sm text-muted-gray">
                Ajusta la fecha, la búsqueda o el tipo de histórico para ver más resultados.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-abyss/55">
                    <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-medium-gray">
                      <th className="px-5 py-3.5 font-medium sm:px-6">Producto o concepto</th>
                      <th className="px-5 py-3.5 font-medium">Categoría</th>
                      <th className="px-5 py-3.5 font-medium">Fecha</th>
                      {kind === 'saving' ? <th className="px-5 py-3.5 text-right font-medium">Deuda usada</th> : null}
                      <th className="px-5 py-3.5 text-right font-medium sm:px-6">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row) => (
                      <tr key={row.id} className="border-t border-graphite/70 transition-colors hover:bg-surface-container-low">
                        <td className="px-5 py-4 font-medium text-on-surface sm:px-6">{row.name}</td>
                        <td className="px-5 py-4 text-muted-gray">{row.category}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-muted-gray">{formatDate(row.date)}</td>
                        {kind === 'saving' ? (
                          <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums">
                            {(row.borrowedAmount ?? 0) > 0 ? (
                              <span className="font-semibold text-amber-200">{formatCurrency(row.borrowedAmount ?? 0)}</span>
                            ) : (
                              <span className="text-medium-gray">Ahorro propio</span>
                            )}
                          </td>
                        ) : null}
                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-on-surface sm:px-6">
                          {formatCurrency(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-graphite/80 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-muted-gray">
                  Mostrando {Math.min(filteredRows.length, (page - 1) * perPageNumber + 1)}-
                  {Math.min(filteredRows.length, page * perPageNumber)} de {filteredRows.length} movimientos
                </p>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-graphite bg-surface text-on-surface hover:bg-surface-container-low"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="size-4" />
                    Anterior
                  </Button>
                  <div className="min-w-[88px] text-center text-xs uppercase tracking-[0.16em] text-medium-gray">
                    Página {page} / {totalPages}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-graphite bg-surface text-on-surface hover:bg-surface-container-low"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page === totalPages}
                  >
                    Siguiente
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-graphite bg-surface shadow-vault">
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-on-surface">Gasto mes por mes</CardTitle>
            <CardDescription className="mt-2 text-muted-gray">
              Evolución mensual de {meta.label.toLowerCase()} para detectar en qué meses utilizaste más y menos dinero.
            </CardDescription>
          </div>
          {highestMonth && lowestMonth ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3">
                <div className="flex items-center gap-2 text-rose-200">
                  <TrendingUp className="size-3.5" />
                  <span className="text-[10px] uppercase tracking-[0.18em]">Mayor gasto</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-on-surface">{highestMonth.label} · {formatCurrency(highestMonth.total)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
                <div className="flex items-center gap-2 text-emerald-200">
                  <TrendingDown className="size-3.5" />
                  <span className="text-[10px] uppercase tracking-[0.18em]">Menor gasto</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-on-surface">{lowestMonth.label} · {formatCurrency(lowestMonth.total)}</p>
              </div>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {monthlySeries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-graphite bg-abyss/60 p-8 text-center text-sm text-muted-gray">
              El gráfico aparecerá cuando existan compras con una fecha registrada.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[320px] w-full">
              <LineChart data={monthlySeries} margin={{ top: 18, right: 14, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={22} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(Number(value))} width={74} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-total)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: 'var(--color-total)', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: 'var(--color-total)', stroke: 'var(--color-surface)', strokeWidth: 3 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
