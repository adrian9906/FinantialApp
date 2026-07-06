import type { Transaction } from './types'

export type SavingDescription =
  | {
    kind: 'manual'
    label?: string
  }
  | {
    kind: 'transfer'
    source: 'expense'
  }

const EXPENSE_TRANSFER_PREFIX = 'transfer::expense'

export function buildExpenseTransferSavingDescription() {
  return EXPENSE_TRANSFER_PREFIX
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

  return {
    kind: 'manual',
    label: description,
  }
}

export function getExpenseTransferTotal(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.type === 'saving')
    .reduce((sum, transaction) => {
      const parsed = parseSavingDescription(transaction.description)
      return parsed.kind === 'transfer' && parsed.source === 'expense'
        ? sum + transaction.amount
        : sum
    }, 0)
}
