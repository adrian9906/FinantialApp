import type { Salary, Transaction } from '@plata/shared'

function isCharge(transaction?: Transaction) {
  return transaction?.type === 'expense' || transaction?.type === 'want'
}

function findAccount(salaries: Salary[], transaction: Transaction) {
  if (!transaction.incomeSourceId) return undefined
  return salaries.find((salary) => (
    salary.sourceId === transaction.incomeSourceId
    && salary.month === transaction.date.slice(0, 7)
  ))
}

/** Refunds the previous charge, then applies the edited/new charge atomically. */
export function reconcileIncomeAccountCharge(
  salaries: Salary[],
  previous: Transaction | undefined,
  next: Transaction | undefined,
) {
  let reconciled = salaries

  if (previous && isCharge(previous) && previous.incomeSourceId) {
    const account = findAccount(reconciled, previous)
    if (account) {
      reconciled = reconciled.map((salary) => salary.id === account.id
        ? { ...salary, balance: Number(salary.balance ?? salary.amount) + previous.amount }
        : salary)
    }
  }

  if (next && isCharge(next) && next.incomeSourceId) {
    const account = findAccount(reconciled, next)
    if (!account) throw new Error('No existe ese ingreso para el mes seleccionado.')
    const balance = Number(account.balance ?? account.amount)
    if (balance + 1e-9 < next.amount) {
      throw new Error('Ese ingreso no tiene saldo suficiente para este movimiento.')
    }
    reconciled = reconciled.map((salary) => salary.id === account.id
      ? { ...salary, balance: Math.max(0, balance - next.amount) }
      : salary)
  }

  return reconciled
}
