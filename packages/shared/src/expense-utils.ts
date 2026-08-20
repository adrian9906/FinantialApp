import type { Transaction } from './types'

export type ExpenseBuiltInCategory = 'food' | 'home' | 'services' | 'gym' | 'health' | 'essentials'
export type ExpenseCategory = ExpenseBuiltInCategory | `custom:${string}`
export type ExpenseStatus = 'pending' | 'checked'

export interface ParsedExpenseDescription {
  category: ExpenseCategory
  itemName: string
  status: ExpenseStatus
  unnecessary: boolean
}

const DEFAULT_EXPENSE: ParsedExpenseDescription = {
  category: 'essentials',
  itemName: 'Gasto esencial',
  status: 'checked',
  unnecessary: false,
}

export function parseExpenseDescription(description?: string): ParsedExpenseDescription {
  if (!description) return DEFAULT_EXPENSE

  const segments = description.split('::')

  if (segments.length >= 3) {
    const [maybeCategory, maybeStatus, ...rest] = segments
    if (isExpenseCategory(maybeCategory) && isExpenseStatus(maybeStatus)) {
      if (rest.length >= 2 && isUnnecessaryFlag(rest[0])) {
        const [unnecessaryFlag, ...nameParts] = rest
        return {
          category: maybeCategory,
          status: maybeStatus,
          unnecessary: unnecessaryFlag === '1',
          itemName: nameParts.join('::').trim() || DEFAULT_EXPENSE.itemName,
        }
      }

      return {
        category: maybeCategory,
        status: maybeStatus,
        unnecessary: false,
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
        unnecessary: false,
        itemName: rest.join('::').trim() || DEFAULT_EXPENSE.itemName,
      }
    }
  }

  return {
    category: DEFAULT_EXPENSE.category,
    itemName: description,
    status: DEFAULT_EXPENSE.status,
    unnecessary: false,
  }
}

export function buildExpenseDescription(
  category: ExpenseCategory,
  itemName: string,
  status: ExpenseStatus,
  unnecessary = false,
) {
  return `${category}::${status}::${unnecessary ? '1' : '0'}::${itemName.trim()}`
}

export function createCustomExpenseCategory(label: string): ExpenseCategory | null {
  const normalized = label.trim().replace(/\s+/g, ' ').slice(0, 48)
  return normalized ? `custom:${encodeURIComponent(normalized)}` : null
}

export function getExpenseCategoryLabel(category: ExpenseCategory) {
  if (!category.startsWith('custom:')) return null

  try {
    return decodeURIComponent(category.slice(7)) || 'Categoría personalizada'
  } catch {
    return category.slice(7) || 'Categoría personalizada'
  }
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
  return value === 'food' || value === 'home' || value === 'services' || value === 'gym' || value === 'health' || value === 'essentials' || value.startsWith('custom:')
}

function isExpenseStatus(value: string): value is ExpenseStatus {
  return value === 'pending' || value === 'checked'
}

function isUnnecessaryFlag(value: string) {
  return value === '0' || value === '1'
}
