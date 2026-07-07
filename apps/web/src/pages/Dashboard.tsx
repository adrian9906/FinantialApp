import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useFinanceStore } from '@/store/financeStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Bell, Calendar, Building2, CheckCircle2, Coffee, Landmark, PiggyBank, Plus, RotateCcw, Sparkles, Wallet } from 'lucide-react'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'
import { buildRecurringPlanningSuggestions, buildRepeatPlanDrafts } from '@/lib/productivity'
import { formatFormulaLabel, usePreferencesStore } from '@/store/preferencesStore'
import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from 'recharts'

export default function Dashboard() {
  const navigate = useNavigate()
  const overview = useMonthlyOverview()
  const transactions = useFinanceStore((state) => state.transactions)
  const reminders = useFinanceStore((state) => state.reminders)
  const events = useFinanceStore((state) => state.events)
  const debts = useFinanceStore((state) => state.debts)
  const monthlyPlanningHistory = useFinanceStore((state) => state.monthlyPlanningHistory)
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const restoreMonthlyPlan = useFinanceStore((state) => state.restoreMonthlyPlan)
  const formula = usePreferencesStore((state) => state.formula)
  const [isRepeatingRecurring, setIsRepeatingRecurring] = useState(false)
  const [restoringScope, setRestoringScope] = useState<'expenses' | 'wants' | 'all' | null>(null)

  const pendingReminders = reminders.filter((r) => !r.completed)
  const upcomingEvents = events
    .filter((event) => new Date(event.date).getTime() >= new Date().setHours(0, 0, 0, 0))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const activeDebts = debts.filter((debt) => !debt.isSettled)
  const totalDebt = activeDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0)
  const salaryHealth = overview.totalSalary - overview.totalExpenses - overview.totalWants - overview.totalSavings

  const savingsPercentage = overview.budgetSavings > 0
    ? Math.min(100, Math.round((overview.totalSavings / overview.budgetSavings) * 100))
    : 0
  const wantsPercentage = overview.budgetWants > 0
    ? Math.min(100, Math.round((overview.totalWants / overview.budgetWants) * 100))
    : 0
  const expensesPercentage = overview.budgetExpenses > 0
    ? Math.min(100, Math.round((overview.totalExpenses / overview.budgetExpenses) * 100))
    : 0
  const allocationData = [
    { bucket: 'Salario', value: overview.totalSalary },
    { bucket: 'Gastos', value: overview.totalExpenses },
    { bucket: 'Gustos', value: overview.totalWants },
    { bucket: 'Ahorros', value: overview.totalSavings },
  ]
  const compositionData = [
    { name: 'gastos', value: overview.totalExpenses, fill: 'var(--color-gastos)' },
    { name: 'gustos', value: overview.totalWants, fill: 'var(--color-gustos)' },
    { name: 'ahorros', value: overview.totalSavings, fill: 'var(--color-ahorros)' },
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
  const recurringPreview = smartPlanning.recurringItems.slice(0, 6)
  const latestHistory = smartPlanning.latestHistory

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
        <div className="flex items-center gap-3 bg-surface rounded-full px-4 py-1.5 shadow-vault text-sm">
          <Calendar className="size-4 text-muted-gray" />
          <span className="font-medium text-on-surface">
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
        </div>
      </header>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-4 bg-surface p-6 rounded-xl shadow-vault flex flex-col justify-between relative overflow-hidden group border border-primary/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.18),transparent_42%)]" />
          <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center shadow-vault">
              <Wallet className="size-5 text-primary" />
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              <Sparkles className="size-3.5" />
              Base del mes
            </Badge>
          </div>
          <div className="relative z-10 space-y-4">
            <div>
              <p className="text-xs text-muted-gray uppercase tracking-[0.24em] mb-2">Salario Registrado</p>
              <h2 className="text-[36px] md:text-[42px] font-semibold text-on-surface leading-none">
                ${overview.totalSalary.toLocaleString()}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-abyss/80 border border-primary/10 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-gray mb-1">Liquidez</p>
                <p className={`text-lg font-semibold ${salaryHealth >= 0 ? 'text-primary' : 'text-warning'}`}>
                  ${salaryHealth.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-abyss/80 border border-primary/10 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-gray mb-1">Distribuido</p>
                <p className="text-lg font-semibold text-on-surface">
                  {overview.totalSalary > 0 ? Math.min(100, Math.round(((overview.totalExpenses + overview.totalWants + overview.totalSavings) / overview.totalSalary) * 100)) : 0}%
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-abyss/70 border border-graphite px-4 py-3">
              <div className="flex items-center justify-between text-xs text-muted-gray mb-2">
                <span>Distribución del ingreso</span>
                <span>{new Date().toLocaleString('default', { month: 'short' })}</span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
                <div className="bg-primary transition-all duration-700" style={{ width: `${expensesPercentage}%` }} />
                <div className="bg-secondary transition-all duration-700" style={{ width: `${wantsPercentage}%` }} />
                <div className="bg-tertiary-container transition-all duration-700" style={{ width: `${savingsPercentage}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface p-6 rounded-xl shadow-vault flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary opacity-5 rounded-bl-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="size-10 rounded-lg bg-surface-container-high flex items-center justify-center shadow-vault">
                <Building2 className="size-5 text-primary" />
              </div>
              <span className="bg-tertiary-container/20 text-tertiary rounded-full px-3 py-0.5 text-xs">
                Objetivo: ${overview.budgetExpenses.toLocaleString()}
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-xs text-muted-gray uppercase tracking-wider mb-1">Gastos Esenciales</p>
              <h3 className="text-[28px] font-semibold text-on-surface mb-2">
                ${overview.totalExpenses.toLocaleString()}
              </h3>
              <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${expensesPercentage}%` }} />
              </div>
              <p className="text-xs text-muted-gray mt-2 text-right">{expensesPercentage}% consumido</p>
            </div>
          </div>

          <div className="bg-surface p-6 rounded-xl shadow-vault flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary opacity-5 rounded-bl-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="size-10 rounded-lg bg-surface-container-high flex items-center justify-center shadow-vault">
                <Coffee className="size-5 text-secondary" />
              </div>
              <span className="bg-secondary-container/20 text-secondary rounded-full px-3 py-0.5 text-xs">
                Objetivo: ${overview.budgetWants.toLocaleString()}
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-xs text-muted-gray uppercase tracking-wider mb-1">Gustos</p>
              <h3 className="text-[28px] font-semibold text-on-surface mb-2">
                ${overview.totalWants.toLocaleString()}
              </h3>
              <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-secondary rounded-full transition-all duration-1000" style={{ width: `${wantsPercentage}%` }} />
              </div>
              <p className="text-xs text-muted-gray mt-2 text-right">{wantsPercentage}% consumido</p>
            </div>
          </div>

          <div className="bg-surface p-6 rounded-xl shadow-vault flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary-container opacity-5 rounded-bl-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="size-10 rounded-lg bg-surface-container-high flex items-center justify-center shadow-vault">
                <PiggyBank className="size-5 text-tertiary-container" />
              </div>
              <span className="bg-tertiary-container/20 text-tertiary rounded-full px-3 py-0.5 text-xs">
                Objetivo: ${overview.budgetSavings.toLocaleString()}
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-xs text-muted-gray uppercase tracking-wider mb-1">Ahorros</p>
              <h3 className="text-[28px] font-semibold text-on-surface mb-2">
                ${overview.totalSavings.toLocaleString()}
              </h3>
              <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-tertiary-container rounded-full transition-all duration-1000" style={{ width: `${savingsPercentage}%` }} />
              </div>
              <p className="text-xs text-muted-gray mt-2 text-right">{savingsPercentage}% reservado</p>
            </div>
          </div>
        </div>
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
                <CardTitle className="text-on-surface">Acciones rapidas</CardTitle>
                <CardDescription className="text-muted-gray">
                  Atajos utiles para las tareas que mas repites durante el mes.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="w-fit bg-primary/10 text-primary">
                Menos friccion diaria
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
                  ? `${activeDebts.length} deuda(s) activas con ${`$${totalDebt.toLocaleString()}`} pendientes.`
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
                Cuando cierres varios meses, aqui veras productos que se repiten y podras reconstruir la lista mas rapido.
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
                        Categoria {item.category} · {item.months.map((month) => month.slice(5, 7)).join(' / ')}
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-on-surface">
                      ${item.amount.toLocaleString()}
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
              <p className="text-lg font-semibold text-on-surface">${totalDebt.toLocaleString()}</p>
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
            <Button onClick={() => navigate('/salary')} className="bg-primary-container text-white hover:brightness-110 shadow-vault">
              <Plus className="size-4" />
              Configurar salario
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
