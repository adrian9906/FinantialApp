import type { Salary, Transaction } from '@plata/shared'

function isCharge(transaction?: Transaction) {
  return transaction?.type === 'expense' || transaction?.type === 'want'
}

function findAccount(salaries: Salary[], transaction: Transaction, cycleMonth?: string) {
  if (!transaction.incomeSourceId) return undefined
  if (cycleMonth) {
    const sourceEntries = salaries.filter((salary) => salary.sourceId === transaction.incomeSourceId)
    const cycleEntries = sourceEntries.filter((salary) => salary.month <= cycleMonth)
    return (cycleEntries.length > 0
      ? cycleEntries.sort((left, right) => right.month.localeCompare(left.month))[0]
      : sourceEntries.sort((left, right) => left.month.localeCompare(right.month))[0])
  }
  const exactMonth = salaries.find((salary) => (
    salary.sourceId === transaction.incomeSourceId
    && salary.month === transaction.date.slice(0, 7)
  ))
  if (exactMonth) return exactMonth

  return salaries
    .filter((salary) => salary.sourceId === transaction.incomeSourceId)
    .sort((left, right) => right.month.localeCompare(left.month))[0]
}

/** Refunds the previous charge, then applies the edited/new charge atomically. */
export function reconcileIncomeAccountCharge(
  salaries: Salary[],
  previous: Transaction | undefined,
  next: Transaction | undefined,
  cycleMonth?: string,
) {
  let reconciled = salaries

  if (previous && isCharge(previous) && previous.incomeSourceId) {
    const account = findAccount(reconciled, previous, cycleMonth)
    if (account) {
      reconciled = reconciled.map((salary) => salary.id === account.id
        ? { ...salary, balance: Number(salary.balance ?? salary.amount) + previous.amount }
        : salary)
    }
  }

  if (next && isCharge(next) && next.incomeSourceId) {
    const account = findAccount(reconciled, next, cycleMonth)
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
