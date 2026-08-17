import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useFinanceStore } from '@/store/financeStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Bell, Building2, Calendar, CheckCircle2, ChevronRight, Coffee, FileDown, Landmark, PiggyBank, Plus, RotateCcw, ShieldAlert, Sparkles, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { buildFinancialScore, buildSmartAlerts } from '@/lib/financialInsights'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'
import { buildRecurringPlanningSuggestions, buildRepeatPlanDrafts } from '@/lib/productivity'
import { formatFormulaLabel, usePreferencesStore } from '@/store/preferencesStore'
import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { buildReceivableReminder, defaultDashboardWidgets, getFinancialPeriodStart, getPlannedExpenseTotal, getPlannedWantTotal, isReceivable } from '@plata/shared'
import { QuickExpenseEntry } from '@/components/dashboard/QuickExpenseEntry'
import { DashboardWidgetPanel } from '@/components/dashboard/DashboardWidgetPanel'
import { buildMonthlyForecast, type BudgetForecast } from '@/lib/monthlyForecast'
import { convertFromUsd, formatMoney } from '@/lib/currency'
import { downloadMonthlyPdfReport } from '@/lib/monthlyPdfReport'
import { useAuthStore } from '@/store/authStore'

function getScoreToneClasses(status: ReturnType<typeof buildFinancialScore>['status']) {
  if (status === 'fuerte') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (status === 'estable') return 'border-sky-500/30 bg-sky-500/10 text-sky-200'
  if (status === 'atencion') return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  return 'border-rose-500/30 bg-rose-500/10 text-rose-200'
}

function getAlertToneClasses(level: ReturnType<typeof buildSmartAlerts>[number]['level']) {
  if (level === 'success') return 'border-emerald-500/25 bg-emerald-500/10'
  if (level === 'warning') return 'border-amber-500/25 bg-amber-500/10'
  if (level === 'critical') return 'border-rose-500/25 bg-rose-500/10'
  return 'border-primary/20 bg-primary/10'
}

function getForecastTone(forecast: BudgetForecast) {
  if (forecast.status === 'over') return 'text-error'
  if (forecast.status === 'watch') return 'text-warning'
  return 'text-success'
}

function getForecastLabel(forecast: BudgetForecast) {
  if (forecast.status === 'no-data') return 'Sin movimientos todavia'
  if (forecast.status === 'over') return `${formatMoney(Math.abs(forecast.difference))} sobre el limite`
  if (forecast.status === 'watch') return `${formatMoney(forecast.difference)} de margen proyectado`
  return `${formatMoney(forecast.difference)} por debajo del limite`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const overview = useMonthlyOverview()
  const authMode = useAuthStore((state) => state.authMode)
  const user = useAuthStore((state) => state.user)
  const transactions = useFinanceStore((state) => state.transactions)
  const reminders = useFinanceStore((state) => state.reminders)
  const events = useFinanceStore((state) => state.events)
  const debts = useFinanceStore((state) => state.debts)
  const wishlist = useFinanceStore((state) => state.wishlist)
  const savingsGoals = useFinanceStore((state) => state.savingsGoals)
  const monthlyPlanningHistory = useFinanceStore((state) => state.monthlyPlanningHistory)
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const restoreMonthlyPlan = useFinanceStore((state) => state.restoreMonthlyPlan)
  const formula = usePreferencesStore((state) => state.formula)
  const profileId = user?.id ?? 'guest'
  const dashboardWidgets = usePreferencesStore((state) => state.dashboardWidgetsByProfile[profileId] ?? defaultDashboardWidgets)
  const [isRepeatingRecurring, setIsRepeatingRecurring] = useState(false)
  const [restoringScope, setRestoringScope] = useState<'expenses' | 'wants' | 'all' | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  const payableDebts = useMemo(() => debts.filter((debt) => !isReceivable(debt)), [debts])
  const receivableReminders = useMemo(
    () => debts.flatMap((debt) => isReceivable(debt) && !debt.isSettled ? [buildReceivableReminder(debt, formatMoney)] : []),
    [debts],
  )
  const effectiveReminders = useMemo(() => [...reminders, ...receivableReminders], [receivableReminders, reminders])
  const pendingReminders = effectiveReminders.filter((r) => !r.completed)
  const upcomingEvents = events
    .filter((event) => new Date(event.date).getTime() >= new Date().setHours(0, 0, 0, 0))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const activeDebts = payableDebts.filter((debt) => !debt.isSettled)
  const totalDebt = activeDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0)
  const allocationData = [
    { bucket: 'Salario', value: convertFromUsd(overview.totalSalary) },
    { bucket: 'Gastos', value: convertFromUsd(overview.totalExpenses) },
    { bucket: 'Gustos', value: convertFromUsd(overview.totalWants) },
    { bucket: 'Ahorros', value: convertFromUsd(overview.totalSavings) },
  ]
  const compositionData = [
    { name: 'gastos', value: convertFromUsd(overview.totalExpenses), fill: 'var(--color-gastos)' },
    { name: 'gustos', value: convertFromUsd(overview.totalWants), fill: 'var(--color-gustos)' },
    { name: 'ahorros', value: convertFromUsd(overview.totalSavings), fill: 'var(--color-ahorros)' },
  ].filter((entry) => entry.value > 0)
  const allocationConfig = {
    Salario: { label: 'Salario', color: 'var(--color-primary)' },
    Gastos: { label: 'Gastos', color: 'var(--color-chart-2, #5b8def)' },
    Gustos: { label: 'Gustos', color: 'var(--color-secondary)' },
    Ahorros: { label: 'Ahorros', color: 'var(--color-tertiary-container)' },
  } satisfies ChartConfig
  const compositionConfig = {
    gastos: { label: 'Gastos', color: 'var(--color-primary)' },
    gustos: { label: 'Gustos', color: 'var(--color-secondary)' },
    ahorros: { label: 'Ahorros', color: 'var(--color-tertiary-container)' },
  } satisfies ChartConfig
  const smartPlanning = useMemo(
    () => buildRecurringPlanningSuggestions(monthlyPlanningHistory),
    [monthlyPlanningHistory],
  )
  const financialScore = useMemo(
    () => buildFinancialScore({ overview, debts: payableDebts, reminders: effectiveReminders }),
    [effectiveReminders, overview, payableDebts],
  )
  const smartAlerts = useMemo(
    () => buildSmartAlerts({ overview, debts: payableDebts, reminders: effectiveReminders, wishlist }),
    [effectiveReminders, overview, payableDebts, wishlist],
  )
  const recurringPreview = smartPlanning.recurringItems.slice(0, 6)
  const latestHistory = smartPlanning.latestHistory
  const forecast = useMemo(() => {
    const periodStart = getFinancialPeriodStart(monthlyPlanningHistory).slice(0, 10)
    const periodTransactions = transactions.filter((transaction) => transaction.date >= periodStart)

    return buildMonthlyForecast({
      currentExpenses: overview.totalExpenses,
      currentWants: overview.totalWants,
      plannedExpenses: getPlannedExpenseTotal(periodTransactions),
      plannedWants: getPlannedWantTotal(periodTransactions),
      budgetExpenses: overview.budgetExpenses,
      budgetWants: overview.budgetWants,
      totalSalary: overview.totalSalary,
      totalDebtPaid: overview.totalDebtPaid,
      totalSavings: overview.totalSavings,
      budgetSavings: overview.budgetSavings,
    })
  }, [monthlyPlanningHistory, overview, transactions])

  async function handleDownloadCurrentReport() {
    if (isDownloadingPdf) return
    setIsDownloadingPdf(true)
    try {
      await downloadMonthlyPdfReport({
        overview,
        transactions,
        wishlist,
        debts: payableDebts,
        reminders: effectiveReminders,
        periodStart: getFinancialPeriodStart(monthlyPlanningHistory),
        userName: authMode === 'guest' ? 'Invitado local' : user?.name ?? 'Usuario',
        mode: 'current',
      })
      toast.success('Informe financiero actual descargado en PDF.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el informe PDF.')
    } finally {
      setIsDownloadingPdf(false)
    }
  }
  const primaryAlert = smartAlerts[0]
  const decisionTitle = overview.totalSalary <= 0
    ? 'Registra tu salario para calcular el mes'
    : forecast.projectedBalance < 0
      ? 'El cierre previsto necesita un ajuste'
      : forecast.expenses.status === 'over'
        ? 'Reduce gastos esenciales antes de cerrar el mes'
        : forecast.wants.status === 'over'
          ? 'Pausa gastos flexibles para proteger tu plan'
          : 'Tu mes mantiene margen de maniobra'
  const decisionDescription = overview.totalSalary <= 0
    ? 'Con una base de ingreso podemos reservar ahorro, deuda y calcular cuanto puedes gastar con seguridad.'
    : forecast.projectedBalance < 0
      ? `Al ritmo actual cerrarías con un déficit de ${formatMoney(Math.abs(forecast.projectedBalance))}.`
      : `Puedes usar hasta ${formatMoney(forecast.safePerDay)} por día durante los ${forecast.remainingDays} días restantes sin tocar el ahorro protegido.`

  async function handleRepeatRecurring(type: 'expenses' | 'wants' | 'all') {
    if (isRepeatingRecurring) return

    const selectedSuggestions = smartPlanning.recurringItems.filter((item) =>
      type === 'all' ? true : type === 'expenses' ? item.type === 'expense' : item.type === 'want',
    )

    if (selectedSuggestions.length === 0) {
      toast.info('Todavia no hay suficientes meses para detectar elementos recurrentes.')
      return
    }

    const currentKeys = new Set(
      transactions
        .filter((transaction) => transaction.type === 'expense' || transaction.type === 'want')
        .map((transaction) => `${transaction.type}:${transaction.description}`),
    )

    const drafts = buildRepeatPlanDrafts(selectedSuggestions).filter(
      (draft) => !currentKeys.has(`${draft.type}:${draft.description}`),
    )

    if (drafts.length === 0) {
      toast.info('Las listas activas ya incluyen esos elementos recurrentes.')
      return
    }

    setIsRepeatingRecurring(true)

    try {
      for (const draft of drafts) {
        await addTransaction(draft)
      }

      toast.success(`Se agregaron ${drafts.length} elemento(s) recurrentes a tu plan actual.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo repetir la lista recurrente.')
    } finally {
      setIsRepeatingRecurring(false)
    }
  }

  async function handleRestoreLatest(scope: 'expenses' | 'wants' | 'all') {
    if (!latestHistory || restoringScope) return

    setRestoringScope(scope)

    try {
      await restoreMonthlyPlan(latestHistory.id, scope)
      toast.success(
        scope === 'all'
          ? 'Se restauro la ultima lista del mes anterior.'
          : scope === 'expenses'
            ? 'Se restauraron los gastos del ultimo cierre.'
            : 'Se restauraron los gustos del ultimo cierre.',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo restaurar la ultima lista.')
    } finally {
      setRestoringScope(null)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 mx-auto mt-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">
            Resumen Mensual
          </h1>
          <p className="text-sm text-muted-gray mt-1">
            Vista consolidada de salario, gastos, gustos y ahorro.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            loading={isDownloadingPdf}
            disabled={isDownloadingPdf}
            onClick={() => void handleDownloadCurrentReport()}
            className="border-graphite bg-surface text-on-surface shadow-vault-sm hover:bg-surface-container-high"
          >
            <FileDown className="size-4" />
            Descargar informe PDF
          </Button>
          <div className="flex items-center gap-3 bg-surface rounded-full px-4 py-1.5 shadow-vault text-sm">
            <Calendar className="size-4 text-muted-gray" />
            <span className="font-medium text-on-surface">
              {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      </header>

      <DashboardWidgetPanel
        widgets={dashboardWidgets}
        overview={overview}
        forecast={forecast}
        financialScore={financialScore}
        transactions={transactions}
        debts={debts}
        reminders={effectiveReminders}
        wishlist={wishlist}
        savingsGoals={savingsGoals}
        decisionTitle={decisionTitle}
        decisionDescription={decisionDescription}
        onNavigate={navigate}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card className="relative overflow-hidden border-primary/15 bg-surface shadow-vault">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.16),transparent_60%)]" />
          <CardContent className="relative space-y-6 p-5 sm:p-7">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl">
                <div className="mb-4 flex items-center gap-2">
                  <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-primary">
                    <Sparkles className="size-3.5" /> Decision de hoy
                  </Badge>
                  <span className="text-xs text-muted-gray">Actualizado con tus movimientos</span>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">{decisionTitle}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-gray">{decisionDescription}</p>
              </div>
              <div className="min-w-52 rounded-2xl border border-graphite bg-abyss/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-medium-gray">Disponible seguro</p>
                <p className={`mt-2 text-3xl font-semibold tabular-nums ${forecast.projectedBalance < 0 ? 'text-error' : 'text-on-surface'}`}>
                  {formatMoney(forecast.safeRemaining)}
                </p>
                <p className="mt-1 text-xs text-muted-gray">despues de deuda, cierre y ahorro protegido</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-graphite bg-surface-container-low p-4">
                <p className="text-xs text-medium-gray">Margen diario</p>
                <p className="mt-2 text-xl font-semibold tabular-nums text-on-surface">{formatMoney(forecast.safePerDay)}</p>
                <p className="mt-1 text-xs text-muted-gray">durante {forecast.remainingDays} dias</p>
              </div>
              <div className="rounded-2xl border border-graphite bg-surface-container-low p-4">
                <p className="text-xs text-medium-gray">Ahorro protegido</p>
                <p className="mt-2 text-xl font-semibold tabular-nums text-success">{formatMoney(forecast.protectedSavings)}</p>
                <p className="mt-1 text-xs text-muted-gray">fuera del margen disponible</p>
              </div>
              <div className="rounded-2xl border border-graphite bg-surface-container-low p-4">
                <p className="text-xs text-medium-gray">Proximo foco</p>
                <p className="mt-2 line-clamp-2 text-sm font-semibold text-on-surface">{primaryAlert?.title ?? 'Sin alertas urgentes'}</p>
                <Button variant="ghost" size="sm" onClick={() => navigate(primaryAlert?.href ?? '/reports')} className="mt-1 h-7 px-0 text-primary hover:bg-transparent">
                  {primaryAlert?.actionLabel ?? 'Revisar analisis'} <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>

            <QuickExpenseEntry />
          </CardContent>
        </Card>

        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-on-surface">Cierre previsto</CardTitle>
                <CardDescription className="mt-1 text-muted-gray">Ritmo actual y partidas planificadas.</CardDescription>
              </div>
              <Badge variant="secondary" className="bg-surface-container-high text-on-surface">Dia {forecast.elapsedDays}/{forecast.daysInMonth}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { label: 'Gastos esenciales', icon: Building2, forecast: forecast.expenses, color: 'bg-primary' },
              { label: 'Gastos flexibles', icon: Coffee, forecast: forecast.wants, color: 'bg-secondary' },
            ].map((item) => {
              const Icon = item.icon
              const width = Math.min(100, Math.max(0, item.forecast.progress))
              return (
                <div key={item.label} className="rounded-2xl border border-graphite bg-abyss/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-surface-container-high text-on-surface"><Icon className="size-4" /></div>
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{item.label}</p>
                        <p className={`text-xs ${getForecastTone(item.forecast)}`}>{getForecastLabel(item.forecast)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-on-surface">{formatMoney(item.forecast.projected)}</p>
                      <p className="text-[11px] text-muted-gray">de {formatMoney(item.forecast.budget)}</p>
                    </div>
                  </div>
                  <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-surface-container-highest">
                    <div className={`h-full rounded-full transition-[width] duration-500 ${item.forecast.status === 'over' ? 'bg-error' : item.color}`} style={{ width: `${width}%` }} />
                    <div className="absolute inset-y-0 right-[10%] w-px bg-on-surface/40" aria-hidden="true" />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-muted-gray">
                    <span>Hasta hoy {formatMoney(item.forecast.current)}</span><span>{item.forecast.progress}% proyectado</span>
                  </div>
                </div>
              )
            })}

            <div className={`rounded-2xl border p-4 ${forecast.projectedBalance < 0 ? 'border-error/30 bg-error/10' : 'border-success/25 bg-success/10'}`}>
              <div className="flex items-center gap-3">
                {forecast.projectedBalance < 0 ? <AlertTriangle className="size-5 text-error" /> : <CheckCircle2 className="size-5 text-success" />}
                <div>
                  <p className="text-sm font-semibold text-on-surface">Cierre estimado: {forecast.projectedBalance < 0 ? '-' : ''}{formatMoney(Math.abs(forecast.projectedBalance))}</p>
                  <p className="mt-1 text-xs text-muted-gray">Se recalcula con cada movimiento.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="overflow-hidden border-graphite bg-surface shadow-vault">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-on-surface">Score financiero personal</CardTitle>
                <CardDescription className="text-muted-gray">
                  Un puntaje de 0 a 100 basado en ahorro, presupuesto, deuda y recordatorios.
                </CardDescription>
              </div>
              <Badge variant="secondary" className={getScoreToneClasses(financialScore.status)}>
                {financialScore.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
              <div className="relative mx-auto flex size-40 items-center justify-center rounded-full border border-primary/20 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.24),transparent_52%),var(--color-surface-container-low)] shadow-vault">
                <div
                  className="absolute inset-2 rounded-full"
                  style={{
                    background: `conic-gradient(var(--color-primary) ${financialScore.score}%, rgba(255,255,255,0.06) 0)`,
                    mask: 'radial-gradient(farthest-side, transparent calc(100% - 12px), black calc(100% - 11px))',
                    WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 12px), black calc(100% - 11px))',
                  }}
                />
                <div className="relative z-10 text-center">
                  <p className="text-[42px] font-semibold leading-none text-on-surface">{financialScore.score}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.24em] text-muted-gray">de 100</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-on-surface">{financialScore.headline}</p>
                  <p className="mt-1 text-sm text-muted-gray">
                    El score cambia cuando ahorras mejor, respetas el plan, bajas deuda o mantienes tus recordatorios bajo control.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {financialScore.factors.map((factor) => (
                    <div key={factor.key} className="rounded-2xl border border-graphite bg-surface-container-low p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-on-surface">{factor.label}</p>
                        <Badge
                          variant="secondary"
                          className={
                            factor.tone === 'good'
                              ? 'bg-emerald-500/10 text-emerald-200'
                              : factor.tone === 'warn'
                                ? 'bg-amber-500/10 text-amber-200'
                                : factor.tone === 'danger'
                                  ? 'bg-rose-500/10 text-rose-200'
                                  : 'bg-surface-container-high text-on-surface'
                          }
                        >
                          {factor.current}/{factor.max}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-gray">{factor.summary}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-graphite bg-surface-container-low p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                    <Sparkles className="size-4 text-primary" />
                    Por que sube o baja el score
                  </div>
                  <div className="mt-3 space-y-3">
                    {financialScore.changes.map((change) => (
                      <div key={change.label} className="flex items-start gap-3">
                        <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ${change.direction === 'up' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                          {change.direction === 'up' ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-on-surface">{change.label}</p>
                          <p className="text-xs text-muted-gray">{change.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-on-surface">Centro de alertas inteligentes</CardTitle>
                <CardDescription className="text-muted-gray">
                  Alertas utiles con recomendacion concreta, sin ruido innecesario.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="w-fit bg-primary/10 text-primary">
                Bandeja priorizada
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {smartAlerts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-graphite bg-surface-container-low p-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                  <CheckCircle2 className="size-5" />
                </div>
                <p className="mt-4 text-sm font-semibold text-on-surface">Todo bajo control</p>
                <p className="mt-1 text-xs text-muted-gray">
                  Hoy no detectamos alertas urgentes. Puedes seguir enfocandote en tus objetivos del mes.
                </p>
              </div>
            ) : (
              smartAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-2xl border p-4 transition-all ${getAlertToneClasses(alert.level)}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-black/10 text-on-surface">
                          {alert.level === 'critical' ? <ShieldAlert className="size-4" /> : alert.level === 'warning' ? <AlertTriangle className="size-4" /> : <Sparkles className="size-4" />}
                        </div>
                        <p className="text-sm font-semibold text-on-surface">{alert.title}</p>
                      </div>
                      <p className="mt-2 text-xs text-muted-gray">{alert.description}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(alert.href)}
                      className="border-graphite bg-abyss text-on-surface hover:bg-surface-container"
                    >
                      {alert.actionLabel}
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className="xl:col-span-7 bg-surface border-graphite shadow-vault">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-on-surface">Pulso Financiero</CardTitle>
              <CardDescription className="text-muted-gray">
                Comparativa entre salario y movimientos del mes.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
              {formatFormulaLabel(formula)}
            </Badge>
          </CardHeader>
          <CardContent>
            <ChartContainer config={allocationConfig} className="h-[280px] w-full">
              <BarChart data={allocationData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" radius={10} fill="var(--color-primary)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-5 bg-surface border-graphite shadow-vault">
          <CardHeader>
            <CardTitle className="text-on-surface">Composición del Mes</CardTitle>
            <CardDescription className="text-muted-gray">
              Distribución real entre gastos, gustos y ahorro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={compositionConfig} className="mx-auto h-[280px] max-w-[320px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
                <Pie data={compositionData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={4} />
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-on-surface">Acciones rápidas</CardTitle>
                <CardDescription className="text-muted-gray">
                  Atajos útiles para las tareas que más repites durante el mes.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="w-fit bg-primary/10 text-primary">
                Menos fricción diaria
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate('/debts')}
              className="rounded-2xl border border-graphite bg-surface-container-low px-4 py-4 text-left transition-all hover:border-primary/35 hover:bg-surface-container"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Landmark className="size-4" />
                </div>
                <ArrowRight className="size-4 text-muted-gray" />
              </div>
              <p className="mt-4 text-sm font-semibold text-on-surface">Pagar deuda</p>
              <p className="mt-1 text-xs text-muted-gray">
                {activeDebts.length > 0
                  ? `${activeDebts.length} deuda(s) activas con ${formatMoney(totalDebt)} pendientes.`
                  : 'No tienes deudas activas por pagar ahora mismo.'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate('/savings')}
              className="rounded-2xl border border-graphite bg-surface-container-low px-4 py-4 text-left transition-all hover:border-primary/35 hover:bg-surface-container"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-300">
                  <PiggyBank className="size-4" />
                </div>
                <ArrowRight className="size-4 text-muted-gray" />
              </div>
              <p className="mt-4 text-sm font-semibold text-on-surface">Registrar ahorro</p>
              <p className="mt-1 text-xs text-muted-gray">
                Ajusta bolsillos, mete dinero extra o mueve saldo para cubrir objetivos.
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="rounded-2xl border border-graphite bg-surface-container-low px-4 py-4 text-left transition-all hover:border-primary/35 hover:bg-surface-container"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-300">
                  <CheckCircle2 className="size-4" />
                </div>
                <ArrowRight className="size-4 text-muted-gray" />
              </div>
              <p className="mt-4 text-sm font-semibold text-on-surface">Cerrar mes</p>
              <p className="mt-1 text-xs text-muted-gray">
                Guarda el historial del mes y limpia listas para empezar la siguiente planificacion.
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="rounded-2xl border border-graphite bg-surface-container-low px-4 py-4 text-left transition-all hover:border-primary/35 hover:bg-surface-container"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-secondary/12 text-secondary">
                  <Sparkles className="size-4" />
                </div>
                <ArrowRight className="size-4 text-muted-gray" />
              </div>
              <p className="mt-4 text-sm font-semibold text-on-surface">Ver informe</p>
              <p className="mt-1 text-xs text-muted-gray">
                Entra directo a informes, comparativas y exportaciones del mes actual y anterior.
              </p>
            </button>
          </CardContent>
        </Card>

        <Card className="border-graphite bg-surface shadow-vault">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="text-on-surface">Reutilizacion inteligente</CardTitle>
                <CardDescription className="text-muted-gray">
                  Detecta productos repetidos entre meses y recupera listas utiles sin rehacer todo.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="w-fit bg-secondary/12 text-secondary">
                Historial mensual
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-graphite bg-surface-container-low p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-medium-gray">Ultimo cierre</p>
                <p className="mt-2 text-sm font-semibold text-on-surface">{latestHistory?.label ?? 'Sin historial'}</p>
              </div>
              <div className="rounded-2xl border border-graphite bg-surface-container-low p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-medium-gray">Recurrentes</p>
                <p className="mt-2 text-2xl font-semibold text-on-surface">{smartPlanning.recurringItems.length}</p>
              </div>
              <div className="rounded-2xl border border-graphite bg-surface-container-low p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-medium-gray">Meses detectados</p>
                <p className="mt-2 text-2xl font-semibold text-on-surface">
                  {smartPlanning.recurringItems[0]?.streak ?? 0}x
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void handleRepeatRecurring('all')}
                disabled={isRepeatingRecurring || smartPlanning.recurringItems.length === 0}
                loading={isRepeatingRecurring}
                className="bg-primary-container text-white hover:brightness-110"
              >
                <RotateCcw className="size-4" />
                Repetir solo lo recurrente
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleRestoreLatest('expenses')}
                disabled={!latestHistory || restoringScope !== null}
                loading={restoringScope === 'expenses'}
                className="border-graphite bg-abyss text-on-surface hover:bg-surface-container"
              >
                Restaurar gastos previos
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleRestoreLatest('wants')}
                disabled={!latestHistory || restoringScope !== null}
                loading={restoringScope === 'wants'}
                className="border-graphite bg-abyss text-on-surface hover:bg-surface-container"
              >
                Restaurar gustos previos
              </Button>
            </div>

            {recurringPreview.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-graphite bg-surface-container-low p-5 text-sm text-muted-gray">
                Cuando cierres varios meses, aquí verás productos que se repiten y podrás reconstruir la lista más rápido.
              </div>
            ) : (
              <div className="grid gap-3">
                {recurringPreview.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col gap-3 rounded-2xl border border-graphite bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-on-surface">{item.itemName}</p>
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          {item.type === 'expense' ? 'Gasto' : 'Gusto'}
                        </Badge>
                        <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
                          {item.streak} mes(es) seguidos
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-gray">
                        Categoría {item.category} · {item.months.map((month) => month.slice(5, 7)).join(' / ')}
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-on-surface">
                      {formatMoney(item.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface rounded-xl shadow-vault p-6">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-graphite">
            <h3 className="text-[18px] font-medium text-on-surface">Próximos Recordatorios</h3>
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary-fixed" onClick={() => navigate('/reminders')}>
              Ver todos
            </Button>
          </div>
          {pendingReminders.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-gray text-sm">
              <Bell className="size-6 mb-2" />
              <p>No hay recordatorios pendientes</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {pendingReminders.slice(0, 3).map((reminder) => (
                <div key={reminder.id} className="flex items-center gap-4 p-2.5 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer group">
                  <div className="size-12 rounded-lg bg-surface-container-lowest flex items-center justify-center shadow-vault">
                    <Bell className="size-5 text-muted-gray group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{reminder.title}</p>
                    <p className="text-xs text-muted-gray">{new Date(reminder.date).toLocaleDateString()}</p>
                  </div>
                  <ArrowRight className="size-5 text-muted-gray group-hover:text-primary transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface rounded-xl shadow-vault p-6">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-graphite">
            <h3 className="text-[18px] font-medium text-on-surface">Agenda y Deudas</h3>
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary-fixed" onClick={() => navigate('/debts')}>
              Ver deudas
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-abyss border border-graphite p-4">
              <div className="flex items-center gap-2 text-muted-gray text-sm mb-2">
                <Calendar className="size-4" />
                Próximo evento
              </div>
              <p className="text-lg font-semibold text-on-surface">{upcomingEvents[0]?.name ?? 'Sin eventos'}</p>
              <p className="text-xs text-muted-gray mt-1">
                {upcomingEvents[0] ? new Date(upcomingEvents[0].date).toLocaleDateString() : 'Agrega un evento para planificar'}
              </p>
            </div>
            <div className="rounded-xl bg-abyss border border-graphite p-4">
              <div className="flex items-center gap-2 text-muted-gray text-sm mb-2">
                <Landmark className="size-4" />
                Deuda activa
              </div>
              <p className="text-lg font-semibold text-on-surface">{formatMoney(totalDebt)}</p>
              <p className="text-xs text-muted-gray mt-1">
                {activeDebts[0] ? activeDebts[0].history : 'No hay deudas pendientes'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {overview.totalSalary === 0 && (
        <div className="bg-surface rounded-xl shadow-vault p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <Wallet className="size-8 text-muted-gray" />
            <p className="text-sm text-muted-gray">
              Configura tu salario mensual para empezar a registrar datos en la base de datos.
            </p>
            <Button onClick={() => navigate('/salary')} className="bg-primary-container text-white hover:bg-primary-container/80 shadow-vault">
              <Plus className="size-4" />
              Configurar salario
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
