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
} from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatMoney } from '@/lib/currency'

type HistoryKind = 'expense' | 'want' | 'saving'
type DateFilterPreset = 'today' | 'cycle' | 'custom'

type HistoryRow = {
  id: string
  name: string
  category: string
  amount: number
  date: string
  borrowedAmount?: number
  closedAt?: string
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
    badgeClass: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
  },
  want: {
    label: 'Gustos',
    singular: 'gusto',
    totalLabel: 'Total en gustos',
    badgeClass: 'border-secondary/20 bg-secondary/10 text-secondary',
  },
  saving: {
    label: 'Ahorros',
    singular: 'compra con ahorros',
    totalLabel: 'Total usado de ahorros',
    badgeClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  },
} satisfies Record<HistoryKind, {
  label: string
  singular: string
  totalLabel: string
  badgeClass: string
}>

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
  row: HistoryRow,
  preset: DateFilterPreset,
  todayKey: string,
  periodStart: string,
  customFrom: string,
  customTo: string,
) {
  const normalizedDate = normalizeDateKey(row.date)
  if (!normalizedDate) return false

  if (preset === 'today') return normalizedDate === todayKey
  if (preset === 'cycle') {
    if (row.closedAt && Date.parse(row.closedAt) <= Date.parse(periodStart)) return false
    return normalizedDate >= periodStart.slice(0, 10) && normalizedDate <= todayKey
  }

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

function buildCycleComparison(rows: HistoryRow[], periodStart: string, previousPeriodStart: string) {
  const currentStartKey = periodStart.slice(0, 10)
  const previousStartKey = previousPeriodStart.slice(0, 10)
  let currentMonthTotal = 0
  let previousMonthTotal = 0
  let currentMonthCount = 0
  let previousMonthCount = 0

  rows.forEach((row) => {
    const dateKey = row.date.slice(0, 10)
    if (dateKey >= currentStartKey) {
      currentMonthTotal += row.amount
      currentMonthCount += 1
      return
    }

    if (dateKey >= previousStartKey && dateKey < currentStartKey) {
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
    currentMonthKey: currentStartKey,
    previousMonthKey: previousStartKey,
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
        closedAt: snapshot.createdAt,
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

interface SpendingHistoryProps {
  transactions: Transaction[]
  monthlyPlanningHistory: MonthlyPlanningHistory[]
  wishlist: WishlistItem[]
  periodStart: string
}

export function SpendingHistory({ transactions, monthlyPlanningHistory, wishlist, periodStart }: SpendingHistoryProps) {
  const [kind, setKind] = useState<HistoryKind>('expense')
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('cycle')
  const [searchText, setSearchText] = useState('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState('10')
  const deferredSearchText = useDeferredValue(searchText)

  const today = useMemo(() => new Date(), [])
  const todayKey = formatDateInputValue(today)
  const previousPeriodStart = useMemo(() => {
    const previousReset = [...monthlyPlanningHistory]
      .filter((entry) => Date.parse(entry.createdAt) < Date.parse(periodStart))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]
    return previousReset?.createdAt ?? `${getPreviousMonthKey(periodStart.slice(0, 7))}-01T00:00:00.000Z`
  }, [monthlyPlanningHistory, periodStart])

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
      if (!matchesDateFilter(row, dateFilter, todayKey, periodStart, customFrom, customTo)) return false
      if (!searchQuery) return true
      return buildSearchIndex(row).includes(searchQuery)
    }),
    [customFrom, customTo, dateFilter, periodStart, rows, searchQuery, todayKey],
  )
  const total = filteredRows.reduce((sum, row) => sum + row.amount, 0)
  const totalBorrowedUsed = filteredRows.reduce((sum, row) => sum + (row.borrowedAmount ?? 0), 0)
  const meta = historyMeta[kind]
  const monthComparison = useMemo(
    () => buildCycleComparison(rows, periodStart, previousPeriodStart),
    [periodStart, previousPeriodStart, rows],
  )
  const perPageNumber = Number(perPage)
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPageNumber))
  const paginatedRows = filteredRows.slice((page - 1) * perPageNumber, page * perPageNumber)
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
                  { id: 'cycle', label: 'Este ciclo' },
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
                  <p className="text-[10px] uppercase tracking-[0.16em] text-medium-gray">Ciclo actual</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-on-surface">{formatCurrency(monthComparison.currentMonthTotal)}</p>
                  <p className="mt-1 text-xs text-muted-gray">{monthComparison.currentMonthCount} movimientos desde {monthComparison.currentMonthKey}</p>
                </div>
                <div className="rounded-2xl border border-graphite/80 bg-surface px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-medium-gray">Ciclo anterior</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-on-surface">{formatCurrency(monthComparison.previousMonthTotal)}</p>
                  <p className="mt-1 text-xs text-muted-gray">{monthComparison.previousMonthCount} movimientos desde {monthComparison.previousMonthKey}</p>
                </div>
                <div className="rounded-2xl border border-graphite/80 bg-surface px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-medium-gray">Comparación mensual</p>
                  <p className={`mt-1 text-lg font-semibold tabular-nums ${monthComparison.difference <= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
                    {monthComparison.difference > 0 ? '+' : ''}{formatCurrency(monthComparison.difference)}
                  </p>
                  <p className="mt-1 text-xs text-muted-gray">
                    {monthComparison.previousMonthTotal > 0
                      ? `${monthComparison.percentChange > 0 ? '+' : ''}${monthComparison.percentChange.toFixed(1)}% frente al ciclo anterior`
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

    </section>
  )
}
