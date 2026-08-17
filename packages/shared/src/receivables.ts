import type { Debt, Reminder } from './types'

export function isReceivable(debt: Debt) {
  return debt.direction === 'receivable'
}

export function getReceivableTotal(debt: Debt) {
  const interestRate = Math.max(0, Number(debt.interest ?? 0))
  return debt.amount + (debt.amount * interestRate) / 100
}

export function buildReceivableReminder(debt: Debt, formatAmount: (amount: number) => string = (amount) => `$${amount.toLocaleString('es-ES')}`): Reminder {
  const name = debt.counterparty?.trim() || 'Una persona'
  const amount = getReceivableTotal(debt)

  return {
    id: `receivable-${debt.id}`,
    title: `${name} te debe pagar hoy`,
    description: `Oye, ${name} te debe pagar hoy la deuda de ${formatAmount(amount)}${debt.history ? ` por ${debt.history}` : ''}.`,
    date: debt.endDate,
    completed: debt.isSettled,
  }
}
