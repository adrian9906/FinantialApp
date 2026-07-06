import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CalendarDays, Landmark, PiggyBank, ReceiptText, Sparkles, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { getMonthlyOverview, getWishlistReservedAmount, isWishlistPurchased, type MonthlyPlanningHistory } from '@plata/shared'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExportExcelButton } from '@/components/reports/ExportExcelButton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { exportMonthlyReport } from '@/lib/reportExports'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'

type ReportMetric = {
  label: string
  current: number
  previous: number
  budget?: number
  tone: 'primary' | 'danger' | 'secondary' | 'success'
}

const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
const shortMonthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'short' })

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString()}`
}

function getMonthKey(date: Date) {
  return date.toISOString().slice(0, 7)
}

function getPreviousMonthKey(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 2, 1))
  return getMonthKey(date)
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return monthFormatter.format(new Date(year, month - 1, 1))
}

function getChange(current: number, previous: number) {
  const delta = current - previous
  const percent = previous === 0
    ? (current === 0 ? 0 : 100)
    : Math.round((delta / previous) * 100)

  return { delta, percent }
}

function toneClasses(tone: ReportMetric['tone']) {
  if (tone === 'danger') return 'bg-rose-500/12 text-rose-200 border-rose-500/20'
  if (tone === 'secondary') return 'bg-secondary/12 text-secondary border-secondary/20'
  if (tone === 'success') return 'bg-emerald-500/12 text-emerald-200 border-emerald-500/20'
  return 'bg-primary/12 text-primary border-primary/20'
}

function getLatestCloseSnapshot(history: MonthlyPlanningHistory[], monthKey: string) {
  return history.find((entry) => entry.month === monthKey) ?? history[0] ?? null
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

  const report = useMemo(() => {
    const currentMonthKey = getMonthKey(new Date())
    const previousMonthKey = getPreviousMonthKey(currentMonthKey)

    const currentSalaries = salaries.filter((salary) => salary.month === currentMonthKey)
    const previousSalaries = salaries.filter((salary) => salary.month === previousMonthKey)
    const currentTransactions = transactions.filter((transaction) => transaction.date.slice(0, 7) === currentMonthKey)
    const previousTransactions = transactions.filter((transaction) => transaction.date.slice(0, 7) === previousMonthKey)
    const currentEvents = events.filter((event) => event.date.slice(0, 7) === currentMonthKey)
    const previousEvents = events.filter((event) => event.date.slice(0, 7) === previousMonthKey)

    const currentOverview = getMonthlyOverview(currentSalaries, currentTransactions, [], formula)
    const previousOverview = getMonthlyOverview(previousSalaries, previousTransactions, [], formula)

    const reservedForPurchasedWishlist = wishlist.reduce(
      (sum, item) => sum + (isWishlistPurchased(item) ? getWishlistReservedAmount(item) : 0),
      0,
    )
    const activeDebts = debts.filter((debt) => !debt.isSettled)
    const totalDebtRemaining = activeDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0)
    const totalDebtPaid = debts.reduce((sum, debt) => sum + debt.paidAmount, 0)

    const currentSnapshot = getLatestCloseSnapshot(monthlyPlanningHistory, currentMonthKey)
    const previousSnapshot = getLatestCloseSnapshot(monthlyPlanningHistory, previousMonthKey)

    const metrics: ReportMetric[] = [
      {
        label: 'Salario del mes',
        current: currentOverview.grossSalary,
        previous: previousOverview.grossSalary,
        tone: 'primary',
      },
      {
        label: 'Gasto real',
        current: currentOverview.totalExpenses,
        previous: previousOverview.totalExpenses,
        budget: currentOverview.budgetExpenses,
        tone: 'danger',
      },
      {
        label: 'Gusto real',
        current: currentOverview.totalWants,
        previous: previousOverview.totalWants,
        budget: currentOverview.budgetWants,
        tone: 'secondary',
      },
      {
        label: 'Ahorro real',
        current: Math.max(0, currentOverview.totalSavings - reservedForPurchasedWishlist),
        previous: previousOverview.totalSavings,
        budget: currentOverview.budgetSavings,
        tone: 'success',
      },
    ]

    const comparisonData = metrics.map((metric) => ({
      label: metric.label.replace(' del mes', '').replace(' real', ''),
      actual: metric.current,
      previous: metric.previous,
    }))

    const budgetData = [
      {
        key: 'gastos',
        label: 'Gastos',
        actual: currentOverview.totalExpenses,
        budget: currentOverview.budgetExpenses,
        fill: 'var(--color-gastos)',
      },
      {
        key: 'gustos',
        label: 'Gustos',
        actual: currentOverview.totalWants,
        budget: currentOverview.budgetWants,
        fill: 'var(--color-gustos)',
      },
      {
        key: 'ahorros',
        label: 'Ahorros',
        actual: Math.max(0, currentOverview.totalSavings - reservedForPurchasedWishlist),
        budget: currentOverview.budgetSavings,
        fill: 'var(--color-ahorros)',
      },
    ]

    const findings: Array<{ title: string; body: string; tone: 'good' | 'warn' | 'neutral' }> = []

    if (currentOverview.grossSalary <= 0) {
      findings.push({
        title: 'Sin salario registrado para este mes',
        body: 'El informe existe, pero varias metas y desviaciones quedaran incompletas hasta que registres salario.',
        tone: 'warn',
      })
    }

    if (currentOverview.totalExpenses > currentOverview.budgetExpenses) {
      findings.push({
        title: 'Los gastos esenciales estan por encima del objetivo',
        body: `Te pasaste por ${formatCurrency(currentOverview.totalExpenses - currentOverview.budgetExpenses)} frente al presupuesto mensual de gastos.`,
        tone: 'warn',
      })
    } else {
      findings.push({
        title: 'Los gastos esenciales siguen bajo control',
        body: `Aun tienes ${formatCurrency(currentOverview.budgetExpenses - currentOverview.totalExpenses)} libres dentro del bloque de gastos del mes.`,
        tone: 'good',
      })
    }

    if (Math.max(0, currentOverview.totalSavings - reservedForPurchasedWishlist) < currentOverview.budgetSavings) {
      findings.push({
        title: 'El ahorro real va por debajo de la meta',
        body: `Te faltan ${formatCurrency(currentOverview.budgetSavings - Math.max(0, currentOverview.totalSavings - reservedForPurchasedWishlist))} para cerrar el objetivo de ahorro de este mes.`,
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

    return {
      currentMonthKey,
      previousMonthKey,
      currentLabel: formatMonthLabel(currentMonthKey),
      previousLabel: formatMonthLabel(previousMonthKey),
      currentOverview,
      previousOverview,
      metrics,
      comparisonData,
      budgetData,
      findings,
      totalDebtPaid,
      totalDebtRemaining,
      activeDebtCount: activeDebts.length,
      reservedForPurchasedWishlist,
      currentSnapshot,
      previousSnapshot,
    }
  }, [debts, events, formula, monthlyPlanningHistory, salaries, transactions, wishlist])

  const comparisonConfig = {
    actual: { label: shortMonthFormatter.format(new Date()), color: 'var(--color-primary)' },
    previous: { label: 'Mes anterior', color: 'var(--color-secondary)' },
    gastos: { label: 'Gastos', color: 'var(--color-primary)' },
    gustos: { label: 'Gustos', color: 'var(--color-secondary)' },
    ahorros: { label: 'Ahorros', color: 'var(--color-tertiary-container)' },
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
      <header className="relative overflow-hidden rounded-[28px] border border-primary/10 bg-surface px-6 py-6 shadow-vault md:px-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,0.18),transparent_52%)]" />
        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit border-primary/20 bg-primary/10 text-primary">
              <ReceiptText className="size-3.5" />
              Informe mensual automatico
            </Badge>
            <div>
              <h1 className="text-[30px] font-semibold tracking-tight text-on-surface md:text-[40px]">
                Reports
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-gray">
                Un corte financiero del mes con KPIs reales, desviacion frente a presupuesto, deuda acumulada y lectura rapida de lo que esta pasando.
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
          const change = getChange(metric.current, metric.previous)
          const overBudget = metric.budget !== undefined && metric.current > metric.budget

          return (
            <Card key={metric.label} className="border-graphite bg-surface shadow-vault">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardDescription className="text-[11px] uppercase tracking-[0.22em] text-medium-gray">
                      {metric.label}
                    </CardDescription>
                    <CardTitle className="mt-3 text-[30px] font-semibold text-on-surface">
                      {formatCurrency(metric.current)}
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className={`border ${toneClasses(metric.tone)}`}>
                    {change.delta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                    {change.percent}%
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

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-on-surface">Comparativa del mes</CardTitle>
              <CardDescription className="text-muted-gray">
                Cruce rapido entre este mes y el anterior para salario, gasto, gusto y ahorro.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
              <CalendarDays className="size-3.5" />
              Auto-generado
            </Badge>
          </CardHeader>
          <CardContent>
            <ChartContainer config={comparisonConfig} className="h-[320px] w-full">
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
