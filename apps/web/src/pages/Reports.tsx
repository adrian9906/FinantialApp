import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Landmark,
  PiggyBank,
  ReceiptText,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { getWishlistReservedAmount, isWishlistPurchased } from '@plata/shared'

import { ExportExcelButton } from '@/components/reports/ExportExcelButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { exportMonthlyReport } from '@/lib/reportExports'
import {
  buildFinancialTimeline,
  buildMonthComparison,
  buildMonthlyRankings,
  buildMonthlySummaries,
  formatMonthLabel,
  getMonthKey,
  getPreviousMonthKey,
  getTrendDirection,
} from '@/lib/reporting'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'

type ReportMetric = {
  label: string
  current: number
  previous: number
  budget?: number
  tone: 'primary' | 'danger' | 'secondary' | 'success'
}

const shortMonthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'short' })

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString()}`
}

function toneClasses(tone: ReportMetric['tone']) {
  if (tone === 'danger') return 'bg-rose-500/12 text-rose-200 border-rose-500/20'
  if (tone === 'secondary') return 'bg-secondary/12 text-secondary border-secondary/20'
  if (tone === 'success') return 'bg-emerald-500/12 text-emerald-200 border-emerald-500/20'
  return 'bg-primary/12 text-primary border-primary/20'
}

function getLatestCloseSnapshot(history: ReturnType<typeof useFinanceStore.getState>['monthlyPlanningHistory'], monthKey: string) {
  return history.find((entry) => entry.month === monthKey) ?? history[0] ?? null
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

  function getTimelineTone(kind: ReturnType<typeof buildFinancialTimeline>[number]['kind']) {
    if (kind === 'salary') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
    if (kind === 'expense') return 'border-rose-500/25 bg-rose-500/10 text-rose-200'
    if (kind === 'want') return 'border-secondary/25 bg-secondary/10 text-secondary'
    if (kind === 'saving') return 'border-sky-500/25 bg-sky-500/10 text-sky-200'
    if (kind === 'debt-payment') return 'border-amber-500/25 bg-amber-500/10 text-amber-200'
    return 'border-primary/20 bg-primary/10 text-primary'
  }

  const report = useMemo(() => {
    const currentMonthKey = getMonthKey(new Date())
    const previousMonthKey = getPreviousMonthKey(currentMonthKey)
    const monthlySummaries = buildMonthlySummaries({
      salaries,
      transactions,
      debts,
      monthlyPlanningHistory,
      formula,
    })
    const currentSummary = monthlySummaries.find((entry) => entry.month === currentMonthKey)
    const previousSummary = monthlySummaries.find((entry) => entry.month === previousMonthKey)
    const comparisonRows = buildMonthComparison(currentSummary, previousSummary)

    const reservedForPurchasedWishlist = wishlist.reduce(
      (sum, item) => sum + (isWishlistPurchased(item) ? getWishlistReservedAmount(item) : 0),
      0,
    )
    const activeDebts = debts.filter((debt) => !debt.isSettled)
    const totalDebtRemaining = activeDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0)
    const totalDebtPaid = debts.reduce((sum, debt) => sum + debt.paidAmount, 0)
    const currentEvents = events.filter((event) => event.date.slice(0, 7) === currentMonthKey)
    const previousEvents = events.filter((event) => event.date.slice(0, 7) === previousMonthKey)
    const currentSnapshot = getLatestCloseSnapshot(monthlyPlanningHistory, currentMonthKey)
    const previousSnapshot = getLatestCloseSnapshot(monthlyPlanningHistory, previousMonthKey)
    const currentRankings = buildMonthlyRankings(transactions, currentMonthKey)
    const previousRankings = buildMonthlyRankings(transactions, previousMonthKey)
    const currentTimeline = buildFinancialTimeline({
      monthKey: currentMonthKey,
      salaries,
      transactions,
      debts,
      events,
    })

    const metrics: ReportMetric[] = [
      {
        label: 'Salario del mes',
        current: currentSummary?.salary ?? 0,
        previous: previousSummary?.salary ?? 0,
        tone: 'primary',
      },
      {
        label: 'Gasto real',
        current: currentSummary?.expenses ?? 0,
        previous: previousSummary?.expenses ?? 0,
        budget: currentSummary?.budgetExpenses ?? 0,
        tone: 'danger',
      },
      {
        label: 'Gusto real',
        current: currentSummary?.wants ?? 0,
        previous: previousSummary?.wants ?? 0,
        budget: currentSummary?.budgetWants ?? 0,
        tone: 'secondary',
      },
      {
        label: 'Ahorro real',
        current: Math.max(0, (currentSummary?.savings ?? 0) - reservedForPurchasedWishlist),
        previous: previousSummary?.savings ?? 0,
        budget: currentSummary?.budgetSavings ?? 0,
        tone: 'success',
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
        title: 'Sin salario registrado para este mes',
        body: 'El informe existe, pero varias metas y desviaciones quedaran incompletas hasta que registres salario.',
        tone: 'warn',
      })
    } else if (currentSummary?.effectiveSalaryMonth && currentSummary.effectiveSalaryMonth !== currentMonthKey) {
      findings.push({
        title: 'La meta distribuida usa tu ultimo salario vigente',
        body: `Como no cambiaste el salario en ${formatMonthLabel(currentMonthKey)}, la formula sigue usando el monto registrado en ${formatMonthLabel(currentSummary.effectiveSalaryMonth)}.`,
        tone: 'neutral',
      })
    }

    if ((currentSummary?.expenses ?? 0) > (currentSummary?.budgetExpenses ?? 0)) {
      findings.push({
        title: 'Los gastos esenciales estan por encima del objetivo',
        body: `Te pasaste por ${formatCurrency((currentSummary?.expenses ?? 0) - (currentSummary?.budgetExpenses ?? 0))} frente al presupuesto mensual de gastos.`,
        tone: 'warn',
      })
    } else {
      findings.push({
        title: 'Los gastos esenciales siguen bajo control',
        body: `Aun tienes ${formatCurrency(Math.max(0, (currentSummary?.budgetExpenses ?? 0) - (currentSummary?.expenses ?? 0)))} libres dentro del bloque de gastos del mes.`,
        tone: 'good',
      })
    }

    if (Math.max(0, (currentSummary?.savings ?? 0) - reservedForPurchasedWishlist) < (currentSummary?.budgetSavings ?? 0)) {
      findings.push({
        title: 'El ahorro real va por debajo de la meta',
        body: `Te faltan ${formatCurrency(Math.max(0, (currentSummary?.budgetSavings ?? 0) - Math.max(0, (currentSummary?.savings ?? 0) - reservedForPurchasedWishlist)))} para cerrar el objetivo de ahorro de este mes.`,
        tone: 'neutral',
      })
    } else {
      findings.push({
        title: 'La meta de ahorro del mes ya esta cubierta',
        body: 'Tu ahorro real iguala o supera lo que exigia la formula para este periodo.',
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
        title: 'Este mes tiene mas movimiento en agenda',
        body: `Hay ${currentEvents.length} evento(s) registrados frente a ${previousEvents.length} del mes anterior.`,
        tone: 'neutral',
      })
    }

    if ((currentSummary?.daysRemainingInCycle ?? 0) > 0) {
      findings.push({
        title: 'El salario actual debe aguantar hasta el cierre de mes',
        body: `Quedan ${currentSummary?.daysRemainingInCycle} dia(s) hasta ${new Date(currentSummary?.cycleEndsAt ?? new Date().toISOString()).toLocaleDateString('es-ES')}. Tu saldo libre recomendado es ${formatCurrency(currentSummary?.recommendedDailyAvailable ?? 0)} por dia.`,
        tone: (currentSummary?.freeBalance ?? 0) > 0 ? 'neutral' : 'warn',
      })
    }

    const trendSeries = monthlySummaries
      .filter((entry) => entry.month === previousMonthKey || entry.month === currentMonthKey)
      .sort((left, right) => left.month.localeCompare(right.month))
      .map((entry) => ({
      label: entry.shortLabel,
      salario: entry.salary,
      gastos: entry.expenses,
      gustos: entry.wants,
      ahorros: entry.savings,
      deuda: entry.debtRemaining,
      libre: entry.freeBalance,
      }))

    const trendSignals = [
      { label: 'Gastos', direction: getTrendDirection(trendSeries.map((entry) => entry.gastos)) },
      { label: 'Gustos', direction: getTrendDirection(trendSeries.map((entry) => entry.gustos)) },
      { label: 'Ahorros', direction: getTrendDirection(trendSeries.map((entry) => entry.ahorros)) },
      { label: 'Deuda', direction: getTrendDirection(trendSeries.map((entry) => entry.deuda)) },
    ]

    return {
      currentMonthKey,
      previousMonthKey,
      currentLabel: formatMonthLabel(currentMonthKey),
      previousLabel: formatMonthLabel(previousMonthKey),
      currentSummary,
      previousSummary,
      metrics,
      comparisonRows,
      comparisonData,
      budgetData,
      findings,
      totalDebtPaid,
      totalDebtRemaining,
      activeDebtCount: activeDebts.length,
      reservedForPurchasedWishlist,
      currentSnapshot,
      previousSnapshot,
      currentRankings,
      previousRankings,
      currentTimeline,
      trendSeries,
      trendSignals,
    }
  }, [debts, events, formula, monthlyPlanningHistory, salaries, transactions, wishlist])

  const comparisonConfig = {
    actual: { label: shortMonthFormatter.format(new Date()), color: 'var(--color-primary)' },
    previous: { label: 'Mes anterior', color: 'var(--color-secondary)' },
  } satisfies ChartConfig

  const trendConfig = {
    gastos: { label: 'Gastos', color: 'var(--color-primary)' },
    gustos: { label: 'Gustos', color: 'var(--color-secondary)' },
    ahorros: { label: 'Ahorros', color: 'var(--color-tertiary-container)' },
    deuda: { label: 'Deuda', color: 'var(--color-warning)' },
    libre: { label: 'Saldo libre', color: 'var(--color-on-surface)' },
  } satisfies ChartConfig

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
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="relative overflow-hidden rounded-[28px] border border-primary/10 bg-surface px-4 py-5 shadow-vault sm:px-6 md:px-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,0.18),transparent_52%)]" />
        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit border-primary/20 bg-primary/10 text-primary">
              <ReceiptText className="size-3.5" />
              Informe mensual automatico
            </Badge>
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-on-surface md:text-[40px]">
                Reports
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-gray">
                Tu tablero mensual con comparador entre meses, tendencias, rankings de compra y lectura rapida del estado financiero.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[21rem]">
            <div className="rounded-2xl border border-graphite bg-abyss/80 px-4 py-4 shadow-vault-sm">
              <p className="text-[11px] uppercase tracking-[0.22em] text-medium-gray">Mes analizado</p>
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

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
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
                  <p className="text-xs text-muted-gray">Mes anterior</p>
                  <p className="mt-1 text-sm font-medium text-on-surface">{formatCurrency(metric.previous)}</p>
                </div>
                {metric.budget !== undefined ? (
                  <div className="flex items-center justify-between text-xs text-muted-gray">
                    <span>Meta del mes</span>
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

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-on-surface">Comparador entre meses</CardTitle>
              <CardDescription className="text-muted-gray">
                Cruce visual del mes actual contra el anterior para salario, gasto, gusto, ahorro y saldo libre.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
              <CalendarDays className="size-3.5" />
              {report.currentMonthKey} vs {report.previousMonthKey}
            </Badge>
          </CardHeader>
          <CardContent>
            <ChartContainer config={comparisonConfig} className="h-[310px] w-full">
              <BarChart data={report.comparisonData} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="actual" radius={10} fill="var(--color-primary)" />
                <Bar dataKey="previous" radius={10} fill="var(--color-secondary)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Variacion absoluta y porcentual</CardTitle>
            <CardDescription className="text-muted-gray">
              Tabla compacta con cambios exactos para cada bloque financiero.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-graphite text-left text-[11px] uppercase tracking-[0.18em] text-medium-gray">
                    <th className="px-0 py-3">Indicador</th>
                    <th className="px-3 py-3">Delta</th>
                    <th className="px-3 py-3">% </th>
                    <th className="px-3 py-3">Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {report.comparisonRows.map((row) => (
                    <tr key={row.key} className="border-b border-graphite/70 last:border-b-0">
                      <td className="px-0 py-3 font-medium text-on-surface">{row.label}</td>
                      <td className={`px-3 py-3 ${row.delta >= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>
                        {row.delta > 0 ? '+' : ''}{formatCurrency(row.delta)}
                      </td>
                      <td className="px-3 py-3 text-muted-gray">{row.percent}%</td>
                      <td className="px-3 py-3 text-muted-gray">{row.budget ? formatCurrency(row.budget) : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-on-surface">Tendencia entre ambos meses</CardTitle>
              <CardDescription className="text-muted-gray">
                Comparacion directa entre el mes anterior y el mes actual para ver hacia donde se mueve cada bloque.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
              {report.previousLabel} vs {report.currentLabel}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {report.trendSignals.map((signal) => (
                <Badge key={signal.label} variant="secondary" className={getDirectionTone(signal.direction)}>
                  <Activity className="size-3.5" />
                  {signal.label}: {getDirectionLabel(signal.direction)}
                </Badge>
              ))}
            </div>
            <ChartContainer config={trendConfig} className="h-[340px] w-full">
              <LineChart data={report.trendSeries} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="gastos" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="gustos" stroke="var(--color-secondary)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="ahorros" stroke="var(--color-tertiary-container)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="deuda" stroke="var(--color-warning)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="libre" stroke="var(--color-on-surface)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Lectura rapida</CardTitle>
            <CardDescription className="text-muted-gray">
              Estado actual de deuda, deseos comprados y cierre de lista.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-graphite bg-abyss/85 p-4">
              <div className="flex items-center gap-2 text-muted-gray">
                <Landmark className="size-4" />
                <span className="text-xs uppercase tracking-[0.2em]">Deuda pagada acumulada</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-on-surface">{formatCurrency(report.totalDebtPaid)}</p>
              <p className="mt-1 text-xs text-muted-gray">
                Quedan {formatCurrency(report.totalDebtRemaining)} pendientes en {report.activeDebtCount} deuda(s) activas.
              </p>
            </div>

            <div className="rounded-2xl border border-graphite bg-abyss/85 p-4">
              <div className="flex items-center gap-2 text-muted-gray">
                <PiggyBank className="size-4" />
                <span className="text-xs uppercase tracking-[0.2em]">Deseos ya descontados</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-on-surface">{formatCurrency(report.reservedForPurchasedWishlist)}</p>
              <p className="mt-1 text-xs text-muted-gray">
                Este monto ya salio del ahorro real por deseos marcados como comprados.
              </p>
            </div>

              <div className="rounded-2xl border border-graphite bg-abyss/85 p-4">
                <div className="flex items-center gap-2 text-muted-gray">
                  <Target className="size-4" />
                  <span className="text-xs uppercase tracking-[0.2em]">Cierre mensual</span>
                </div>
              <p className="mt-3 text-lg font-semibold text-on-surface">
                {report.currentSnapshot?.label ?? 'Aun no hay cierre guardado'}
              </p>
              <p className="mt-1 text-xs text-muted-gray">
                {report.currentSnapshot
                  ? `${report.currentSnapshot.expenses.length} gasto(s) y ${report.currentSnapshot.wants.length} gusto(s) guardados en el reset mensual.`
                  : 'Haz el reset mensual cuando cierres el mes para alimentar este bloque automaticamente.'}
                </p>
              </div>

            <div className="rounded-2xl border border-graphite bg-abyss/85 p-4">
              <div className="flex items-center gap-2 text-muted-gray">
                <CalendarDays className="size-4" />
                <span className="text-xs uppercase tracking-[0.2em]">Alcance hasta cobro</span>
              </div>
              <p className="mt-3 text-lg font-semibold text-on-surface">
                {report.currentSummary?.daysRemainingInCycle
                  ? `${report.currentSummary.daysRemainingInCycle} dia(s) hasta fin de mes`
                  : 'Mes cerrado'}
              </p>
              <p className="mt-1 text-xs text-muted-gray">
                {report.currentSummary?.daysRemainingInCycle
                  ? `Para aguantar hasta ${new Date(report.currentSummary.cycleEndsAt).toLocaleDateString('es-ES')} te conviene no pasar de ${formatCurrency(report.currentSummary.recommendedDailyAvailable)} por dia de saldo libre.`
                  : 'Este bloque se recalcula solo en el mes actual, cuando aun falta para el proximo cobro.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-on-surface">Timeline financiero</CardTitle>
              <CardDescription className="text-muted-gray">
                Una lectura visual del flujo del mes con salario, compras, ahorro, pagos y eventos en una sola vista.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
              Flujo de {report.currentLabel}
            </Badge>
          </CardHeader>
          <CardContent>
            {report.currentTimeline.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-graphite bg-abyss/70 p-8 text-center text-sm text-muted-gray">
                Aun no hay movimientos suficientes este mes para dibujar el timeline financiero.
              </div>
            ) : (
              <div className="space-y-4">
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
                                  ? 'Salario'
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
                              className={`text-base font-semibold ${
                                entry.signedAmount > 0
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

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Top categorias del mes actual</CardTitle>
            <CardDescription className="text-muted-gray">
              Las categorias que mas dinero consumieron en {report.currentLabel}.
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
              <p className="text-sm text-muted-gray">Todavia no hay movimientos este mes para calcular categorias.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Top productos del mes anterior</CardTitle>
            <CardDescription className="text-muted-gray">
              Lo mas costoso agrupado por nombre de item en {report.previousLabel}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.previousRankings.topProductsByAmount.length > 0 ? report.previousRankings.topProductsByAmount.map((entry, index) => (
              <div key={`${entry.type}-${entry.category}-${entry.label}`} className="rounded-2xl border border-graphite bg-abyss/85 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{index + 1}. {entry.label}</p>
                    <p className="mt-1 text-xs text-muted-gray">
                      {entry.category} · {entry.count} registro(s)
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-secondary/15 text-secondary">
                    {formatCurrency(entry.totalAmount)}
                  </Badge>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-gray">No hay items suficientes en el mes anterior para este ranking.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Lo mas repetido</CardTitle>
            <CardDescription className="text-muted-gray">
              Patrones comparados entre el mes anterior y el actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-medium-gray">Categorias repetidas este mes</p>
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
              <p className="text-xs uppercase tracking-[0.2em] text-medium-gray">Productos repetidos mes anterior</p>
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
            <CardTitle className="text-on-surface">Desviacion contra presupuesto</CardTitle>
            <CardDescription className="text-muted-gray">
              Mide que tan lejos esta el comportamiento real frente a la formula del mes.
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

        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
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
                className={`rounded-2xl border p-4 ${
                  finding.tone === 'good'
                    ? 'border-emerald-500/20 bg-emerald-500/8'
                    : finding.tone === 'warn'
                      ? 'border-amber-500/20 bg-amber-500/8'
                      : 'border-graphite bg-abyss/70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${
                    finding.tone === 'good'
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

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Historial de cierre</CardTitle>
            <CardDescription className="text-muted-gray">
              Ultimo cierre guardado contra el mes anterior para reutilizar listas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[report.currentSnapshot, report.previousSnapshot].filter(Boolean).map((snapshot, index) => (
              <div key={snapshot?.id ?? index} className="rounded-2xl border border-graphite bg-abyss/85 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-on-surface">{snapshot?.label}</p>
                  <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
                    {snapshot?.month}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-muted-gray">
                  {snapshot?.expenses.length ?? 0} gasto(s) guardados, {snapshot?.wants.length ?? 0} gusto(s) guardados.
                </p>
              </div>
            ))}
            {!report.currentSnapshot && !report.previousSnapshot ? (
              <p className="text-sm text-muted-gray">
                Todavia no existe historial mensual. Usa el reset del mes cuando cierres compras para que esta seccion tenga memoria.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Siguientes pasos sugeridos</CardTitle>
            <CardDescription className="text-muted-gray">
              Accesos rapidos para corregir lo que el informe detecta.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="secondary" className="justify-between bg-surface-container-high text-on-surface hover:bg-surface-container-higher" onClick={() => navigate('/salary')}>
              Revisar salario del mes
              <ArrowRight className="size-4" />
            </Button>
            <Button variant="secondary" className="justify-between bg-surface-container-high text-on-surface hover:bg-surface-container-higher" onClick={() => navigate('/expenses')}>
              Ajustar gastos esenciales
              <ArrowRight className="size-4" />
            </Button>
            <Button variant="secondary" className="justify-between bg-surface-container-high text-on-surface hover:bg-surface-container-higher" onClick={() => navigate('/wants')}>
              Ajustar gustos y caprichos
              <ArrowRight className="size-4" />
            </Button>
            <Button variant="secondary" className="justify-between bg-surface-container-high text-on-surface hover:bg-surface-container-higher" onClick={() => navigate('/debts')}>
              Revisar plan de deudas
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
