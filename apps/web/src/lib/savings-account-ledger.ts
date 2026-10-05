import { getMonthKey, type IncomeSource, type Salary, type Transaction } from '@plata/shared'

import { findSavingsAccount } from '@/lib/account-savings'

function getTransactionCurrency(
  transaction: Transaction,
  incomeSources: IncomeSource[],
  fallbackSourceId?: string,
) {
  const sourceId = transaction.incomeSourceId ?? fallbackSourceId
  const source = sourceId ? incomeSources.find((entry) => entry.id === sourceId) : undefined
  return (source?.currencyCode ?? 'USD').trim().toUpperCase() || 'USD'
}

function getSavingsSalary(
  salaries: Salary[],
  incomeSources: IncomeSource[],
  transaction: Transaction,
  fallbackSourceId?: string,
) {
  const currencyCode = getTransactionCurrency(transaction, incomeSources, fallbackSourceId)
  const savingsSource = findSavingsAccount(incomeSources, currencyCode, true)
  if (!savingsSource) throw new Error(`No existe la cuenta Ahorro ${currencyCode}.`)

  const month = getMonthKey()
  const account = salaries
    .filter((salary) => salary.sourceId === savingsSource.id && salary.month <= month)
    .sort((left, right) => right.month.localeCompare(left.month))[0]
  if (!account) throw new Error(`No se encontró el saldo de Ahorro ${currencyCode}.`)
  return account
}

/** Refunds the old savings movement and applies the new one to the cumulative account. */
export function reconcileSavingsAccountTransaction(
  salaries: Salary[],
  incomeSources: IncomeSource[],
  previous: Transaction | undefined,
  next: Transaction | undefined,
  fallbackSourceId?: string,
) {
  const deltas = new Map<string, number>()

  if (previous?.type === 'saving' && previous.amount !== 0) {
    const account = getSavingsSalary(salaries, incomeSources, previous, fallbackSourceId)
    deltas.set(account.id, (deltas.get(account.id) ?? 0) - previous.amount)
  }
  if (next?.type === 'saving' && next.amount !== 0) {
    const account = getSavingsSalary(salaries, incomeSources, next, fallbackSourceId)
    deltas.set(account.id, (deltas.get(account.id) ?? 0) + next.amount)
  }
  if (deltas.size === 0) return salaries

  for (const salary of salaries) {
    const delta = deltas.get(salary.id)
    if (delta === undefined) continue
    const nextBalance = Number(salary.balance ?? salary.amount) + delta
    if (nextBalance < -1e-9) {
      throw new Error('No tienes suficiente ahorro disponible para realizar este movimiento.')
    }
  }

  return salaries.map((salary) => {
    const delta = deltas.get(salary.id)
    return delta === undefined
      ? salary
      : { ...salary, savingsLedgerMigrated: true, balance: Math.max(0, Number(salary.balance ?? salary.amount) + delta) }
  })
}
