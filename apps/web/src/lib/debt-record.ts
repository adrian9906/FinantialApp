import type { Debt, IncomeSource } from '@plata/shared'

export interface DebtAccountOption {
  id: string
  name: string
  currencyCode: string
}

export function getDebtAccountOptions(sources: IncomeSource[], debts: Debt[]): DebtAccountOption[] {
  const options = new Map<string, DebtAccountOption>()
  for (const source of sources) {
    if (source.name.toLocaleLowerCase('es').startsWith('ahorro ')) continue
    options.set(source.id, { id: source.id, name: source.name, currencyCode: (source.currencyCode ?? 'USD').trim().toUpperCase() })
  }
  for (const debt of debts) {
    if (debt.incomeSourceId && !options.has(debt.incomeSourceId)) {
      options.set(debt.incomeSourceId, { id: debt.incomeSourceId, name: debt.incomeSourceName ?? 'Cuenta anterior', currencyCode: 'USD' })
    }
  }
  return [...options.values()]
}

export function getDebtCurrencyCode(options: DebtAccountOption[], sourceId?: string): string {
  return options.find((option) => option.id === sourceId)?.currencyCode ?? 'USD'
}

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
