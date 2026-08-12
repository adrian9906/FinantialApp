import type { Transaction, WishlistItem } from './types'
import { getWishlistReservedAmount, isWishlistPurchased } from './wishlist'

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
  | {
    kind: 'debt-acquisition'
    debtId: string
    label?: string
  }
  | {
    kind: 'debt-payment'
    debtId: string
    label?: string
  }

const EXPENSE_TRANSFER_PREFIX = 'transfer::expense'
const WANT_TRANSFER_PREFIX = 'transfer::want'
const WITHDRAWAL_PREFIX = 'withdrawal'
const DEBT_ACQUISITION_PREFIX = 'debt-acquisition'
const DEBT_PAYMENT_PREFIX = 'debt-payment'

function decodeValue(value?: string) {
  if (!value) return undefined

  try {
    return decodeURIComponent(value) || undefined
  } catch {
    return value || undefined
  }
}

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

export function buildDebtAcquisitionSavingDescription(debtId: string, label?: string) {
  return [DEBT_ACQUISITION_PREFIX, encodeURIComponent(debtId.trim()), encodeURIComponent(label?.trim() ?? '')].join('::')
}

export function buildDebtPaymentSavingDescription(debtId: string, label?: string) {
  return [DEBT_PAYMENT_PREFIX, encodeURIComponent(debtId.trim()), encodeURIComponent(label?.trim() ?? '')].join('::')
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

  if (description.startsWith(`${DEBT_ACQUISITION_PREFIX}::`)) {
    const [, encodedDebtId, encodedLabel] = description.split('::')
    return {
      kind: 'debt-acquisition',
      debtId: decodeValue(encodedDebtId) ?? '',
      label: decodeValue(encodedLabel),
    }
  }

  if (description.startsWith(`${DEBT_PAYMENT_PREFIX}::`)) {
    const [, encodedDebtId, encodedLabel] = description.split('::')
    return {
      kind: 'debt-payment',
      debtId: decodeValue(encodedDebtId) ?? '',
      label: decodeValue(encodedLabel),
    }
  }

  return {
    kind: 'manual',
    label: description,
  }
}

export interface SavingsUsageEntry {
  id: string
  kind: 'withdrawal' | 'wishlist' | 'debt-payment'
  label: string
  category: string
  date: string
  amount: number
  ownAmount: number
  borrowedAmount: number
  debtId?: string
}

export interface SavingsFundingBreakdown {
  ownBalance: number
  borrowedBalance: number
  totalBalance: number
  borrowedAcquired: number
  borrowedUsed: number
  usages: SavingsUsageEntry[]
}

type SavingsLedgerEvent = {
  id: string
  date: string
  createdAt?: string
  amount: number
  source: 'own' | 'borrowed' | 'usage'
  usage?: Omit<SavingsUsageEntry, 'ownAmount' | 'borrowedAmount'>
}

function getLedgerOrder(entry: SavingsLedgerEvent) {
  const day = entry.date ? entry.date.slice(0, 10) : '9999-12-31'
  const time = entry.createdAt?.includes('T') ? entry.createdAt.slice(11) : '12:00:00.000Z'
  return `${day}T${time}:${entry.id}`
}

export function getDebtAcquisitionAmount(transactions: Transaction[], debtId: string) {
  return transactions.reduce((sum, transaction) => {
    if (transaction.type !== 'saving' || transaction.amount <= 0) return sum
    const parsed = parseSavingDescription(transaction.description)
    return parsed.kind === 'debt-acquisition' && parsed.debtId === debtId
      ? sum + transaction.amount
      : sum
  }, 0)
}

export function getSavingsFundingBreakdown(
  transactions: Transaction[],
  wishlist: WishlistItem[] = [],
): SavingsFundingBreakdown {
  const transactionEvents = transactions.flatMap<SavingsLedgerEvent>((transaction) => {
    if (transaction.type !== 'saving' || transaction.amount === 0) return []
    const parsed = parseSavingDescription(transaction.description)

    if (transaction.amount > 0) {
      return [{
        id: transaction.id,
        date: transaction.date,
        createdAt: transaction.createdAt,
        amount: transaction.amount,
        source: parsed.kind === 'debt-acquisition' ? 'borrowed' : 'own',
      }]
    }

    const label = parsed.kind === 'debt-payment'
      ? parsed.label ?? 'Pago de deuda'
      : parsed.kind === 'withdrawal'
        ? parsed.label ?? 'Salida de ahorros'
        : parsed.kind === 'manual'
          ? parsed.label ?? 'Salida de ahorros'
          : 'Salida de ahorros'
    const category = parsed.kind === 'debt-payment'
      ? 'Pago de deuda'
      : parsed.kind === 'withdrawal'
        ? parsed.target === 'expense'
          ? 'Gasto'
          : parsed.target === 'want'
            ? 'Gusto'
            : parsed.sourceGoalName ?? 'Propósito'
        : 'Movimiento de ahorro'

    return [{
      id: transaction.id,
      date: transaction.date,
      createdAt: transaction.createdAt,
      amount: Math.abs(transaction.amount),
      source: 'usage',
      usage: {
        id: transaction.id,
        kind: parsed.kind === 'debt-payment' ? 'debt-payment' : 'withdrawal',
        label,
        category,
        date: transaction.date,
        amount: Math.abs(transaction.amount),
        debtId: parsed.kind === 'debt-payment' ? parsed.debtId : undefined,
      },
    }]
  })

  const wishlistEvents = wishlist.flatMap<SavingsLedgerEvent>((item) => {
    if (!isWishlistPurchased(item)) return []
    const amount = getWishlistReservedAmount(item)
    if (amount <= 0) return []

    return [{
      id: `wishlist:${item.id}`,
      date: item.purchasedAt ?? '',
      createdAt: item.purchasedAt,
      amount,
      source: 'usage',
      usage: {
        id: `wishlist:${item.id}`,
        kind: 'wishlist',
        label: item.name,
        category: item.sourceStore?.trim() || 'Deseo comprado',
        date: item.purchasedAt ?? '',
        amount,
      },
    }]
  })

  const fundingEvents = transactionEvents.filter((event) => event.source !== 'usage')
  const usageEvents = [...transactionEvents, ...wishlistEvents]
    .filter((event) => event.source === 'usage')
    .sort((left, right) => getLedgerOrder(left).localeCompare(getLedgerOrder(right)))
  let ownBalance = fundingEvents
    .filter((event) => event.source === 'own')
    .reduce((sum, event) => sum + event.amount, 0)
  let borrowedBalance = fundingEvents
    .filter((event) => event.source === 'borrowed')
    .reduce((sum, event) => sum + event.amount, 0)
  const borrowedAcquired = borrowedBalance
  const usages: SavingsUsageEntry[] = []

  usageEvents.forEach((event) => {
    const ownAmount = Math.min(ownBalance, event.amount)
    const remaining = Math.max(0, event.amount - ownAmount)
    const borrowedAmount = Math.min(borrowedBalance, remaining)
    ownBalance = Math.max(0, ownBalance - ownAmount)
    borrowedBalance = Math.max(0, borrowedBalance - borrowedAmount)

    if (event.usage) {
      usages.push({ ...event.usage, ownAmount, borrowedAmount })
    }
  })

  const borrowedUsed = usages.reduce((sum, usage) => sum + usage.borrowedAmount, 0)

  return {
    ownBalance,
    borrowedBalance,
    totalBalance: ownBalance + borrowedBalance,
    borrowedAcquired,
    borrowedUsed,
    usages,
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

export function getWithdrawalTotalByTarget(
  transactions: Transaction[],
  target: 'expense' | 'want' | 'purpose',
) {
  return transactions
    .filter((transaction) => transaction.type === 'saving' && transaction.amount < 0)
    .reduce((sum, transaction) => {
      const parsed = parseSavingDescription(transaction.description)
      return parsed.kind === 'withdrawal' && parsed.target === target
        ? sum + Math.abs(transaction.amount)
        : sum
    }, 0)
}

export function getExpenseWithdrawalTotal(transactions: Transaction[]) {
  return getWithdrawalTotalByTarget(transactions, 'expense')
}

export function getWantWithdrawalTotal(transactions: Transaction[]) {
  return getWithdrawalTotalByTarget(transactions, 'want')
}
