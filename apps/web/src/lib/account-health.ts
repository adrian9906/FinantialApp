import { getFinancialPeriodStart, getSalaryIncomeBase, isInFinancialPeriod, parseExpenseDescription, parseWantDescription, type BootstrapPayload, type IncomeSource, type Salary } from '@plata/shared'

export type AccountHealthLevel = 'critical' | 'warning' | 'success'
export interface AccountHealth {
  accountId: string
  accountName: string
  currencyCode: string
  level: AccountHealthLevel
  balance: number
  commitments: number
  forecast: number
  margin: number
  hasHistory: boolean
  asOf: string
  month: string
}
export function dateKey(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
export function isLastWeekOfMonth(now: Date) {
  return now.getDate() >= new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - 6
}
export function nextAccountReview(now: Date) {
  const review = new Date(now.getFullYear(), now.getMonth() + 1, 0, 9)
  review.setDate(review.getDate() - 6)
  if (review <= now) {
    review.setMonth(review.getMonth() + 1, 1)
    review.setDate(new Date(review.getFullYear(), review.getMonth() + 1, 0).getDate() - 6)
  }
  return review
}
const money = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0

/** Balances already include pending plans: do not charge those plans a second time. */
export function buildAccountHealth(
  accounts: Array<{ source: IncomeSource; salary: Salary }>,
  snapshot: Pick<BootstrapPayload, 'transactions' | 'debts' | 'subscriptions' | 'monthlyPlanningHistory'>,
  now = new Date(),
): AccountHealth[] {
  const today = dateKey(now)
  const month = today.slice(0, 7)
  const end = `${month}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`
  const remainingDays = Number(end.slice(-2)) - now.getDate()
  const periodStart = getFinancialPeriodStart(snapshot.monthlyPlanningHistory, now)
  const sampleStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13)
  const sampleKey = dateKey(sampleStart) > periodStart.slice(0, 10) ? dateKey(sampleStart) : periodStart.slice(0, 10)
  const sampleDays = Math.max(1, Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.parse(`${sampleKey}T00:00:00Z`)) / 86400000) + 1)
  const latestReset = snapshot.monthlyPlanningHistory.find(entry => entry.createdAt === periodStart)
  return accounts.filter(({ source, salary }) => !source.archived && !source.name.trim().toLowerCase().startsWith('ahorro ')
    && (salary.amount > 0 || Number(salary.balance ?? 0) !== 0 || snapshot.transactions.some(entry => entry.incomeSourceId === source.id) || snapshot.debts.some(entry => entry.incomeSourceId === source.id && !entry.isSettled) || snapshot.subscriptions.some(entry => entry.incomeSourceId === source.id && entry.status === 'active'))).map(({ source, salary }) => {
    const entries = snapshot.transactions.filter(entry => entry.incomeSourceId === source.id && isInFinancialPeriod(entry, periodStart, Boolean(latestReset)) && entry.date.slice(0, 10) <= end)
    const pending = (entry: typeof entries[number]) => entry.type === 'expense'
      ? parseExpenseDescription(entry.description).status === 'pending'
      : entry.type === 'want' && parseWantDescription(entry.description).status === 'pending'
    const paid = entries.filter(entry => (entry.type === 'expense' || entry.type === 'want') && !pending(entry) && entry.date.slice(0, 10) >= sampleKey && entry.date.slice(0, 10) <= today)
    const recordedDays = new Set(paid.map(entry => entry.date.slice(0, 10))).size
    const daily = paid.reduce((sum, entry) => sum + money(entry.amount), 0) / sampleDays
    const prepaidPlans = entries.filter(pending).reduce((sum, entry) => sum + money(entry.amount), 0)
    const expectedSpending = Math.max(0, daily * remainingDays - prepaidPlans)
    const subscriptionDue = snapshot.subscriptions.filter(entry => entry.incomeSourceId === source.id && entry.status === 'active' && entry.startedAt.slice(0, 10) <= end)
      .reduce((sum, subscription) => {
        const due = `${month}-${String(Math.min(subscription.billingDay, Number(end.slice(-2)))).padStart(2, '0')}`
        const alreadyRecorded = entries.some(entry => entry.type === 'expense' && parseExpenseDescription(entry.description).itemName.trim().toLocaleLowerCase() === subscription.name.trim().toLocaleLowerCase() && Math.abs(entry.amount - subscription.amount) < 0.01)
        return due >= today && !alreadyRecorded ? sum + money(subscription.amount) : sum
      }, 0)
    const debtDue = snapshot.debts.filter(debt => debt.incomeSourceId === source.id && debt.direction !== 'receivable' && !debt.isSettled && debt.endDate.slice(0, 10) <= end).reduce((sum, debt) => sum + money(debt.remainingAmount), 0)
    const balance = Number.isFinite(salary.balance ?? salary.amount) ? Number(salary.balance ?? salary.amount) : 0
    const commitments = subscriptionDue + debtDue
    const forecast = expectedSpending
    const margin = balance - commitments - forecast
    const hasHistory = recordedDays >= 3
    const level: AccountHealthLevel = margin <= 0 ? 'critical'
      : !hasHistory || margin < Math.max(money(getSalaryIncomeBase(salary)) * 0.1, (commitments + forecast) * 0.25) ? 'warning' : 'success'
    return { accountId: source.id, accountName: source.name, currencyCode: source.currencyCode ?? salary.currencyCode ?? 'USD', level, balance, commitments, forecast, margin, hasHistory, asOf: today, month }
  })
}

export function accountHealthMessage(health: AccountHealth, format: (amount: number, currency: string) => string) {
  if (health.level === 'critical') return { title: `Ojo, vas justo en ${health.accountName}`, body: `Tienes ${format(health.balance, health.currencyCode)} de saldo disponible. ${health.margin < 0 ? `Los pagos pendientes y el gasto estimado dejan un faltante de ${format(Math.abs(health.margin), health.currencyCode)}.` : 'Los pagos pendientes y el gasto estimado no dejan margen adicional.'} Conviene recortar gastos.` }
  if (health.level === 'success') return { title: `Vas bien en ${health.accountName}`, body: `Tras cubrir los pagos pendientes y el gasto estimado, te quedan ${format(health.margin, health.currencyCode)} de margen. Puedes valorar un gusto pequeño o pasar una parte a ahorro.` }
  return { title: `Revisa tu margen en ${health.accountName}`, body: health.hasHistory ? `Quedan ${format(health.margin, health.currencyCode)} de margen estimado. Mantén los gastos bajo control.` : `Tienes ${format(health.balance, health.currencyCode)} disponibles, pero faltan días de gasto registrados para recomendar gustos o ahorro con confianza.` }
}
