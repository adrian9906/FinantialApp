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

const EXPENSE_TRANSFER_PREFIX = 'transfer::expense'
const WANT_TRANSFER_PREFIX = 'transfer::want'

export function buildExpenseTransferSavingDescription() {
  return EXPENSE_TRANSFER_PREFIX
}

export function buildWantTransferSavingDescription() {
  return WANT_TRANSFER_PREFIX
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
