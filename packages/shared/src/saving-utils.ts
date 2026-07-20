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
    target: 'expense' | 'want' | 'purpose'
    label?: string
    sourceGoalId?: string
    sourceGoalName?: string
  }

const EXPENSE_TRANSFER_PREFIX = 'transfer::expense'
const WANT_TRANSFER_PREFIX = 'transfer::want'
const WITHDRAWAL_PREFIX = 'withdrawal'

export function buildExpenseTransferSavingDescription() {
  return EXPENSE_TRANSFER_PREFIX
}

export function buildWantTransferSavingDescription() {
  return WANT_TRANSFER_PREFIX
}

export function buildSavingWithdrawalDescription(
  target: 'expense' | 'want' | 'purpose',
  label?: string,
  options?: {
    sourceGoalId?: string
    sourceGoalName?: string
  },
) {
  const trimmedLabel = label?.trim() ?? ''
  const sourceGoalId = options?.sourceGoalId?.trim() ?? ''
  const sourceGoalName = options?.sourceGoalName?.trim() ?? ''

  return [
    WITHDRAWAL_PREFIX,
    target,
    encodeURIComponent(trimmedLabel),
    encodeURIComponent(sourceGoalId),
    encodeURIComponent(sourceGoalName),
  ].join('::')
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

  if (description.startsWith(`${WITHDRAWAL_PREFIX}::`)) {
    const [, rawTarget, ...rawRest] = description.split('::')
    const target = rawTarget === 'want' || rawTarget === 'purpose' ? rawTarget : 'expense'

    if (rawRest.length >= 3) {
      const [encodedLabel, encodedSourceGoalId, encodedSourceGoalName] = rawRest

      return {
        kind: 'withdrawal',
        target,
        label: decodeURIComponent(encodedLabel || '') || undefined,
        sourceGoalId: decodeURIComponent(encodedSourceGoalId || '') || undefined,
        sourceGoalName: decodeURIComponent(encodedSourceGoalName || '') || undefined,
      }
    }

    return {
      kind: 'withdrawal',
      target,
      label: rawRest.join('::') || undefined,
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
