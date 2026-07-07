import type { Transaction } from './types'

export type SavingDescription =
  | {
    kind: 'manual'
    label?: string
  }
  | {
    kind: 'transfer'
    source: 'expense' | 'want'
  }
  | {
    kind: 'withdrawal'
    target: 'expense' | 'want'
    label?: string
  }

const EXPENSE_TRANSFER_PREFIX = 'transfer::expense'
const WANT_TRANSFER_PREFIX = 'transfer::want'
const EXPENSE_WITHDRAWAL_PREFIX = 'withdrawal::expense'
const WANT_WITHDRAWAL_PREFIX = 'withdrawal::want'

export function buildExpenseTransferSavingDescription() {
  return EXPENSE_TRANSFER_PREFIX
}

export function buildWantTransferSavingDescription() {
  return WANT_TRANSFER_PREFIX
}

export function buildSavingWithdrawalDescription(target: 'expense' | 'want', label?: string) {
  const prefix = target === 'want' ? WANT_WITHDRAWAL_PREFIX : EXPENSE_WITHDRAWAL_PREFIX
  const trimmedLabel = label?.trim()
  return trimmedLabel ? `${prefix}::${trimmedLabel}` : prefix
}

export function parseSavingDescription(description?: string): SavingDescription {
  if (!description) {
    return { kind: 'manual' }
  }

  if (description === EXPENSE_TRANSFER_PREFIX) {
    return {
      kind: 'transfer',
      source: 'expense',
    }
  }

  if (description === WANT_TRANSFER_PREFIX) {
    return {
      kind: 'transfer',
      source: 'want',
    }
  }

  if (description === EXPENSE_WITHDRAWAL_PREFIX || description.startsWith(`${EXPENSE_WITHDRAWAL_PREFIX}::`)) {
    return {
      kind: 'withdrawal',
      target: 'expense',
      label: description.slice(`${EXPENSE_WITHDRAWAL_PREFIX}::`.length) || undefined,
    }
  }

  if (description === WANT_WITHDRAWAL_PREFIX || description.startsWith(`${WANT_WITHDRAWAL_PREFIX}::`)) {
    return {
      kind: 'withdrawal',
      target: 'want',
      label: description.slice(`${WANT_WITHDRAWAL_PREFIX}::`.length) || undefined,
    }
  }

  return {
    kind: 'manual',
    label: description,
  }
}

export function getTransferTotalBySource(transactions: Transaction[], source: 'expense' | 'want') {
  return transactions
    .filter((transaction) => transaction.type === 'saving')
    .reduce((sum, transaction) => {
      const parsed = parseSavingDescription(transaction.description)
      return parsed.kind === 'transfer' && parsed.source === source
        ? sum + transaction.amount
        : sum
    }, 0)
}

export function getExpenseTransferTotal(transactions: Transaction[]) {
  return getTransferTotalBySource(transactions, 'expense')
}

export function getWantTransferTotal(transactions: Transaction[]) {
  return getTransferTotalBySource(transactions, 'want')
}
