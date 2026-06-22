import type { Transaction } from './types.js'

export type ExpenseCategory = 'food' | 'home' | 'gym' | 'health' | 'essentials'
export type ExpenseStatus = 'pending' | 'checked'

export interface ParsedExpenseDescription {
  category: ExpenseCategory
  itemName: string
  status: ExpenseStatus
}

const DEFAULT_EXPENSE: ParsedExpenseDescription = {
  category: 'essentials',
  itemName: 'Gasto esencial',
  status: 'checked',
}

export function parseExpenseDescription(description?: string): ParsedExpenseDescription {
  if (!description) return DEFAULT_EXPENSE

  const segments = description.split('::')

  if (segments.length >= 3) {
    const [maybeCategory, maybeStatus, ...rest] = segments
    if (isExpenseCategory(maybeCategory) && isExpenseStatus(maybeStatus)) {
      return {
        category: maybeCategory,
        status: maybeStatus,
        itemName: rest.join('::').trim() || DEFAULT_EXPENSE.itemName,
      }
    }
  }

  if (segments.length >= 2) {
    const [maybeCategory, ...rest] = segments
    if (isExpenseCategory(maybeCategory)) {
      return {
        category: maybeCategory,
        status: 'checked',
        itemName: rest.join('::').trim() || DEFAULT_EXPENSE.itemName,
      }
    }
  }

  return {
    category: DEFAULT_EXPENSE.category,
    itemName: description,
    status: DEFAULT_EXPENSE.status,
  }
}

export function buildExpenseDescription(category: ExpenseCategory, itemName: string, status: ExpenseStatus) {
  return `${category}::${status}::${itemName.trim()}`
}

export function getEffectiveExpenseTotal(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => {
      const parsed = parseExpenseDescription(transaction.description)
      return parsed.status === 'checked' ? sum + transaction.amount : sum
    }, 0)
}

export function getPlannedExpenseTotal(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
}

function isExpenseCategory(value: string): value is ExpenseCategory {
  return value === 'food' || value === 'home' || value === 'gym' || value === 'health' || value === 'essentials'
}

function isExpenseStatus(value: string): value is ExpenseStatus {
  return value === 'pending' || value === 'checked'
}
