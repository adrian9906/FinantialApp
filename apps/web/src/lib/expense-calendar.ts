import type { MonthlyPlanningHistory, MonthlyPlanningItem, Transaction } from '@plata/shared'
import { parseExpenseDescription, parseWantDescription, parseSavingDescription } from '@plata/shared'

/** Date-only purchases retain their calendar day; timestamps use local time. */
export function getExpenseDay(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return toCalendarDay(date)
}

export function toCalendarDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export interface CalendarExpense extends MonthlyPlanningItem {
  id: string
  archived: boolean
  type: Transaction['type']
}

export function getCalendarExpenses(transactions: Transaction[], history: MonthlyPlanningHistory[], sourceId: string): CalendarExpense[] {
  if (!sourceId) return []
  return [
    ...transactions.filter((entry) => entry.type === 'expense').map((entry) => ({
      ...entry, ...parseExpenseDescription(entry.description), date: getExpenseDay(entry.date), archived: false,
    })),
    ...history.flatMap((period) => period.expenses.map((entry, index) => ({
      ...entry, type: 'expense' as const, id: `history:${period.id}:${index}`, date: getExpenseDay(entry.date), archived: true,
    }))),
  ].filter((entry) => entry.incomeSourceId === sourceId && entry.date !== '')
    .sort((a, b) => a.itemName.localeCompare(b.itemName, 'es'))
}

export function getCalendarMovements(transactions: Transaction[], history: MonthlyPlanningHistory[], sourceId: string): CalendarExpense[] {
  if (!sourceId) return []
  const wants: CalendarExpense[] = transactions.filter((entry) => entry.type === 'want').map((entry) => ({
    ...entry, ...parseWantDescription(entry.description), date: getExpenseDay(entry.date), archived: false,
  }))
  const savings: CalendarExpense[] = transactions.filter((entry) => entry.type === 'saving').map((entry) => {
    const parsed = parseSavingDescription(entry.description)
    const label = parsed.kind === 'transfer'
      ? `Transferencia de ${parsed.source === 'expense' ? 'gastos' : 'gustos'} a ahorros`
      : parsed.label ?? (parsed.kind === 'withdrawal' ? 'Retiro de ahorros' : 'Ahorro')
    return { ...entry, itemName: label, category: 'saving', status: 'checked', date: getExpenseDay(entry.date), archived: false }
  })
  const historicalWants: CalendarExpense[] = history.flatMap((period) => period.wants.map((entry, index) => ({
    ...entry, type: 'want', id: `history:want:${period.id}:${index}`, date: getExpenseDay(entry.date), archived: true,
  })))
  return [...getCalendarExpenses(transactions, history, sourceId), ...wants, ...savings, ...historicalWants]
    .filter((entry) => entry.incomeSourceId === sourceId && entry.date !== '')
    .sort((a, b) => a.itemName.localeCompare(b.itemName, 'es'))
}
