import type { Debt } from '@plata/shared'

export type DebtInput = Omit<Debt, 'id' | 'paidAmount' | 'remainingAmount' | 'progress' | 'isSettled'> & {
  initialPayment?: number
}

export function createDebtRecord(input: DebtInput, id: string, date: string, createdAt: string): Debt {
  const paidAmount = Math.min(input.amount, Math.max(0, input.initialPayment ?? 0))
  const remainingAmount = Math.max(0, input.amount - paidAmount)
  return {
    id,
    incomeSourceId: input.incomeSourceId,
    incomeSourceName: input.incomeSourceName,
    direction: input.direction === 'receivable' ? 'receivable' : 'payable',
    counterparty: input.counterparty,
    amount: input.amount,
    history: input.history,
    startDate: input.startDate,
    endDate: input.endDate,
    interest: input.interest,
    paidAmount,
    remainingAmount,
    progress: input.amount > 0 ? Math.min(100, Math.round((paidAmount / input.amount) * 100)) : 100,
    isSettled: remainingAmount === 0,
    payments: paidAmount > 0 ? [{ amount: paidAmount, date, createdAt }] : [],
  }
}

// An absent filter means all accounts, including legacy and archived accounts.
export function filterDebtsByAccount(debts: Debt[], sourceId?: string): Debt[] {
  return sourceId === undefined ? debts : debts.filter((debt) => (debt.incomeSourceId ?? '') === sourceId)
}
