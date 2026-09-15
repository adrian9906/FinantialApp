import { parseExpenseDescription, type Transaction, type MonthlyPlanningHistory } from '@plata/shared'
import { getExpenseDay } from './expense-calendar.ts'

export function getWidgetTodayExpenses(transactions: Transaction[], history: MonthlyPlanningHistory[], accountId: string, dateKey: string) {
  if (!accountId) return 0
  const amounts: number[] = []
  for (const cycle of history) {
    for (const expense of cycle.expenses) {
      if (expense.incomeSourceId === accountId && getExpenseDay(expense.date) === dateKey && expense.status === 'checked') {
        amounts.push(Number.isFinite(expense.amount) ? Math.max(0, expense.amount) : 0)
      }
    }
  }
  for (const transaction of transactions) {
    if (transaction.incomeSourceId !== accountId || transaction.type !== 'expense' || getExpenseDay(transaction.date) !== dateKey) continue
    if (parseExpenseDescription(transaction.description).status === 'checked') {
      amounts.push(Number.isFinite(transaction.amount) ? Math.max(0, transaction.amount) : 0)
    }
  }
  return amounts.reduce((sum, amount) => sum + amount, 0)
}
