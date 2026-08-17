import {
  BellRing,
  BrainCircuit,
  CalendarClock,
  CreditCard,
  HeartHandshake,
  Landmark,
  ListChecks,
  PiggyBank,
  ReceiptText,
  Scale,
  Sparkles,
  WalletCards,
} from 'lucide-react'
import { isReceivable, parseExpenseDescription, type DashboardWidgetId, type Debt, type Reminder, type SavingsGoal, type Transaction, type WishlistItem } from '@plata/shared'
import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatMoney } from '@/lib/currency'
import type { buildFinancialScore } from '@/lib/financialInsights'
import type { buildMonthlyForecast } from '@/lib/monthlyForecast'
import type { useMonthlyOverview } from '@/lib/useMonthlyOverview'

type WidgetPanelProps = {
  widgets: DashboardWidgetId[]
  overview: ReturnType<typeof useMonthlyOverview>
  forecast: ReturnType<typeof buildMonthlyForecast>
  financialScore: ReturnType<typeof buildFinancialScore>
  transactions: Transaction[]
  debts: Debt[]
  reminders: Reminder[]
  wishlist: WishlistItem[]
  savingsGoals: SavingsGoal[]
  decisionTitle: string
  decisionDescription: string
  onNavigate: (path: string) => void
}

const categoryLabels: Record<string, string> = {
  food: 'Alimentación',
  services: 'Servicios',
  home: 'Hogar',
  gym: 'Deporte',
  health: 'Salud',
  essentials: 'Esenciales',
}

const widgetIcons = {
  'decision-today': Sparkles,
  'safe-available': WalletCards,
  'daily-margin': CalendarClock,
  'financial-score': BrainCircuit,
  'accounts-balances': CreditCard,
  'expenses-by-category': ReceiptText,
  'savings-goals': PiggyBank,
  'upcoming-payments': BellRing,
  debts: Landmark,
  wishlist: HeartHandshake,
  'net-worth': Scale,
  'household-activity': ListChecks,
} satisfies Record<DashboardWidgetId, typeof Sparkles>

export function DashboardWidgetPanel({
  widgets,
  overview,
  forecast,
  financialScore,
  transactions,
  debts,
  reminders,
  wishlist,
  savingsGoals,
  decisionTitle,
  decisionDescription,
  onNavigate,
}: WidgetPanelProps) {
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>()
    transactions.forEach((transaction) => {
      if (transaction.type !== 'expense') return
      const category = parseExpenseDescription(transaction.description).category
      totals.set(category, (totals.get(category) ?? 0) + transaction.amount)
    })
    return Array.from(totals, ([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount).slice(0, 3)
  }, [transactions])
  const pendingReminders = reminders.filter((reminder) => !reminder.completed).slice(0, 3)
  const payableDebt = debts.filter((debt) => !isReceivable(debt) && !debt.isSettled).reduce((sum, debt) => sum + debt.remainingAmount, 0)
  const receivable = debts.filter((debt) => isReceivable(debt) && !debt.isSettled).reduce((sum, debt) => sum + debt.remainingAmount, 0)
  const netWorth = overview.totalSalary - overview.totalExpenses - overview.totalWants + overview.accumulatedSavings + receivable - payableDebt

  if (widgets.length === 0) {
    return (
      <Card className="border-dashed border-graphite bg-surface p-8 text-center shadow-vault">
        <p className="text-lg font-semibold text-on-surface">Tu panel está vacío</p>
        <p className="mt-2 text-sm text-muted-gray">Activa los bloques que quieras consultar desde Ajustes.</p>
        <Button onClick={() => onNavigate('/settings')} className="mt-4 bg-primary-container text-white">Personalizar panel</Button>
      </Card>
    )
  }

  function renderWidget(widgetId: DashboardWidgetId) {
    const Icon = widgetIcons[widgetId]
    const shell = (title: string, content: React.ReactNode, href?: string, emphasis = false) => (
      <Card key={widgetId} className={`${emphasis ? 'md:col-span-2 border-primary/25' : 'border-graphite'} bg-surface p-5 shadow-vault`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-4" /></div>
          {href ? <Button variant="ghost" size="sm" onClick={() => onNavigate(href)} className="h-8 text-xs text-muted-gray">Abrir</Button> : null}
        </div>
        <p className="mt-4 text-xs uppercase tracking-[0.18em] text-medium-gray">{title}</p>
        <div className="mt-2">{content}</div>
      </Card>
    )

    if (widgetId === 'decision-today') return shell('Decisión de hoy', <><p className="text-xl font-semibold text-on-surface">{decisionTitle}</p><p className="mt-2 text-sm leading-6 text-muted-gray">{decisionDescription}</p></>, undefined, true)
    if (widgetId === 'safe-available') return shell('Disponible seguro', <><p className="text-3xl font-semibold tabular-nums text-on-surface">{formatMoney(forecast.safeRemaining)}</p><p className="mt-1 text-xs text-muted-gray">Después de compromisos y ahorro protegido.</p></>)
    if (widgetId === 'daily-margin') return shell('Margen diario', <><p className="text-3xl font-semibold tabular-nums text-on-surface">{formatMoney(forecast.safePerDay)}</p><p className="mt-1 text-xs text-muted-gray">Durante {forecast.remainingDays} días.</p></>)
    if (widgetId === 'financial-score') return shell('Score financiero', <div className="flex items-end gap-3"><p className="text-4xl font-semibold text-on-surface">{financialScore.score}</p><Badge className="mb-1 bg-primary/10 text-primary">{financialScore.status}</Badge></div>, '/reports')
    if (widgetId === 'accounts-balances') return shell('Cuentas y saldos', <div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-gray">Ingresos</span><strong>{formatMoney(overview.totalSalary)}</strong></div><div className="flex justify-between"><span className="text-muted-gray">Salidas</span><strong>{formatMoney(overview.totalExpenses + overview.totalWants)}</strong></div><div className="flex justify-between"><span className="text-muted-gray">Ahorro acumulado</span><strong className="text-success">{formatMoney(overview.accumulatedSavings)}</strong></div></div>, '/salary')
    if (widgetId === 'expenses-by-category') return shell('Gastos por categoría', categoryTotals.length ? <div className="space-y-3">{categoryTotals.map((entry) => <div key={entry.category} className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-muted-gray">{categoryLabels[entry.category] ?? entry.category}</span><strong>{formatMoney(entry.amount)}</strong></div>)}</div> : <p className="text-sm text-muted-gray">Aún no hay gastos categorizados.</p>, '/expenses')
    if (widgetId === 'savings-goals') return shell('Objetivos de ahorro', savingsGoals[0] ? <><p className="text-lg font-semibold text-on-surface">{savingsGoals[0].name}</p><p className="mt-1 text-sm text-muted-gray">{formatMoney(savingsGoals[0].currentAmount)} de {formatMoney(savingsGoals[0].targetAmount)}</p></> : <p className="text-sm text-muted-gray">Crea una meta para empezar a medir progreso.</p>, '/savings')
    if (widgetId === 'upcoming-payments') return shell('Próximos pagos', pendingReminders.length ? <div className="space-y-2">{pendingReminders.map((reminder) => <div key={reminder.id} className="flex justify-between gap-3 text-sm"><span className="truncate text-on-surface">{reminder.title}</span><span className="shrink-0 text-muted-gray">{new Date(reminder.date).toLocaleDateString()}</span></div>)}</div> : <p className="text-sm text-muted-gray">No hay pagos pendientes.</p>, '/reminders')
    if (widgetId === 'debts') return shell('Deudas', <><p className="text-3xl font-semibold text-on-surface">{formatMoney(payableDebt)}</p><p className="mt-1 text-xs text-muted-gray">Saldo pendiente por pagar.</p></>, '/debts')
    if (widgetId === 'wishlist') return shell('Wishlist', wishlist[0] ? <><p className="text-lg font-semibold text-on-surface">{wishlist[0].name}</p><p className="mt-1 text-sm text-muted-gray">Meta de {formatMoney(wishlist[0].price)}</p></> : <p className="text-sm text-muted-gray">Tu lista de deseos está vacía.</p>, '/wishlist')
    if (widgetId === 'net-worth') return shell('Patrimonio estimado', <><p className={`text-3xl font-semibold ${netWorth < 0 ? 'text-error' : 'text-on-surface'}`}>{formatMoney(netWorth)}</p><p className="mt-1 text-xs text-muted-gray">Saldo, ahorro y cobros menos obligaciones.</p></>)
    return shell('Actividad del hogar', transactions.length ? <div className="space-y-2">{transactions.slice(0, 3).map((transaction) => <div key={transaction.id} className="flex justify-between gap-3 text-sm"><span className="truncate text-muted-gray">{transaction.description?.split('::').at(-1)}</span><strong>{formatMoney(transaction.amount)}</strong></div>)}</div> : <p className="text-sm text-muted-gray">Aún no hay actividad en este perfil.</p>)
  }

  return (
    <section aria-label="Panel personalizable" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {widgets.map(renderWidget)}
    </section>
  )
}
