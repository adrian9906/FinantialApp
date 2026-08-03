import type { Transaction } from './types'

export type WantBuiltInCategory = 'outings' | 'shopping' | 'gaming' | 'subscriptions' | 'selfcare'
export type WantCategory = WantBuiltInCategory | `custom:${string}`
export type WantStatus = 'pending' | 'checked'

export interface ParsedWantDescription {
  category: WantCategory
  itemName: string
  status: WantStatus
}

const DEFAULT_WANT: ParsedWantDescription = {
  category: 'outings',
  itemName: 'Gusto',
  status: 'checked',
}

export function parseWantDescription(description?: string): ParsedWantDescription {
  if (!description) return DEFAULT_WANT

  const segments = description.split('::')

  if (segments.length >= 3) {
    const [maybeCategory, maybeStatus, ...rest] = segments
    if (isWantCategory(maybeCategory) && isWantStatus(maybeStatus)) {
      return {
        category: maybeCategory,
        status: maybeStatus,
        itemName: rest.join('::').trim() || DEFAULT_WANT.itemName,
      }
    }
  }

  if (segments.length >= 2) {
    const [maybeCategory, ...rest] = segments
    if (isWantCategory(maybeCategory)) {
      return {
        category: maybeCategory,
        status: 'checked',
        itemName: rest.join('::').trim() || DEFAULT_WANT.itemName,
      }
    }
  }

  return {
    category: DEFAULT_WANT.category,
    itemName: description,
    status: DEFAULT_WANT.status,
  }
}

export function buildWantDescription(category: WantCategory, itemName: string, status: WantStatus) {
  return `${category}::${status}::${itemName.trim()}`
}

export function createCustomWantCategory(label: string): WantCategory | null {
  const normalized = label.trim().replace(/\s+/g, ' ').slice(0, 48)
  return normalized ? `custom:${encodeURIComponent(normalized)}` : null
}

export function getWantCategoryLabel(category: WantCategory) {
  if (!category.startsWith('custom:')) return null

  try {
    return decodeURIComponent(category.slice(7)) || 'Categoría personalizada'
  } catch {
    return category.slice(7) || 'Categoría personalizada'
  }
}

export function getEffectiveWantTotal(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.type === 'want')
    .reduce((sum, transaction) => {
      const parsed = parseWantDescription(transaction.description)
      return parsed.status === 'checked' ? sum + transaction.amount : sum
    }, 0)
}

export function getPlannedWantTotal(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.type === 'want')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
}

function isWantCategory(value: string): value is WantCategory {
  return value === 'outings' || value === 'shopping' || value === 'gaming' || value === 'subscriptions' || value === 'selfcare' || value.startsWith('custom:')
}

function isWantStatus(value: string): value is WantStatus {
  return value === 'pending' || value === 'checked'
}
