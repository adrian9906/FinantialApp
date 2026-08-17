import type { ExpenseCategory } from './expense-utils'
import type { WantCategory } from './want-utils'

export type CategorizationTarget =
  | { transactionType: 'expense'; category: ExpenseCategory }
  | { transactionType: 'want'; category: WantCategory }

export type CategorizationRule = CategorizationTarget & {
  id: string
  pattern: string
  source: 'default' | 'user'
}

export const defaultCategorizationRules: CategorizationRule[] = [
  { id: 'default-etecsa', pattern: 'ETECSA', transactionType: 'expense', category: 'services', source: 'default' },
  { id: 'default-netflix', pattern: 'Netflix', transactionType: 'want', category: 'subscriptions', source: 'default' },
  { id: 'default-mercado', pattern: 'Mercado', transactionType: 'expense', category: 'food', source: 'default' },
]

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function findCategorizationRule(description: string, userRules: readonly CategorizationRule[] = []) {
  const normalized = normalizeText(description)
  if (!normalized) return null
  return [...userRules, ...defaultCategorizationRules].find((rule) => normalized.includes(normalizeText(rule.pattern))) ?? null
}

export function buildLearnedRulePattern(description: string) {
  return normalizeText(description)
    .split(' ')
    .filter((token) => token.length > 1 && !/^\d+(?:[.,]\d+)?$/.test(token))
    .slice(0, 3)
    .join(' ')
}

export function createLearnedCategorizationRule(
  description: string,
  target: CategorizationTarget,
): CategorizationRule | null {
  const pattern = buildLearnedRulePattern(description)
  if (!pattern) return null
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    pattern,
    ...target,
    source: 'user',
  }
}
