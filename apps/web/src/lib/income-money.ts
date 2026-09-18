import type { IncomeSource, Salary } from '@plata/shared'

export interface IncomeMoneyDestination {
  sourceId?: string
  newSourceName?: string
  recurring?: boolean
  balanceMode?: 'fixed' | 'zero'
  isCash?: boolean
  currencyCode: string
}

export interface IncomeMoneyMovement {
  amountUsd: number
  month: string
  destination: IncomeMoneyDestination
  sourceSalaryId?: string
  /** Savings allocation keeps the income account's displayed balance intact. */
  preserveSourceBalance?: boolean
}

export interface IncomeMoneyState {
  salaries: Salary[]
  incomeSources: IncomeSource[]
}

/**
 * Applies deposits and account-to-account transfers through one immutable path.
 * Salary amounts remain canonical USD; currencyCode controls their denomination.
 */
export function applyIncomeMoneyMovement(
  state: IncomeMoneyState,
  movement: IncomeMoneyMovement,
  createId: (prefix: string) => string,
): IncomeMoneyState {
  const amountUsd = Number(movement.amountUsd)
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error('Escribe un monto mayor que cero.')
  }

  const normalizedCurrency = movement.destination.currencyCode.trim().toUpperCase() || 'USD'
  let destinationSource = movement.destination.sourceId
    ? state.incomeSources.find((source) => source.id === movement.destination.sourceId)
    : undefined
  let incomeSources = state.incomeSources

  if (!destinationSource) {
    const name = movement.destination.newSourceName?.trim()
    if (!name) throw new Error('Selecciona un ingreso o escribe el nombre del nuevo.')
    if (state.incomeSources.some((source) => source.name.trim().toLowerCase() === name.toLowerCase())) {
      throw new Error('Ya existe un ingreso con ese nombre; selecciónalo en la lista.')
    }
    destinationSource = {
      id: createId('income-source'),
      name,
      currencyCode: normalizedCurrency,
      recurring: movement.destination.recurring !== false,
      balanceMode: movement.destination.balanceMode === 'zero' ? 'zero' : 'fixed',
      isCash: movement.destination.isCash !== false,
    }
    incomeSources = [...state.incomeSources, destinationSource]
  }

  const sourceSalary = movement.sourceSalaryId
    ? state.salaries.find((salary) => salary.id === movement.sourceSalaryId)
    : undefined

  if (movement.sourceSalaryId && !sourceSalary) throw new Error('El ingreso de origen ya no existe.')
  if (sourceSalary?.sourceId === destinationSource.id) {
    throw new Error('El ingreso de origen y el de destino deben ser diferentes.')
  }
  if (sourceSalary && Number(sourceSalary.balance ?? sourceSalary.amount) + 1e-9 < amountUsd) {
    throw new Error('El ingreso de origen no tiene saldo suficiente.')
  }

  const target = state.salaries.find(
    (salary) => salary.month === movement.month && salary.sourceId === destinationSource.id,
  )
  const isTransfer = Boolean(sourceSalary)
  const salaries = state.salaries.map((salary) => {
    if (salary.id === sourceSalary?.id && !movement.preserveSourceBalance) return {
      ...salary,
      balance: Math.max(0, Number(salary.balance ?? salary.amount) - amountUsd),
      transferAdjustment: Number(salary.transferAdjustment ?? 0) - amountUsd,
    }
    if (salary.id === target?.id) return {
      ...salary,
      // Moving existing money changes balances, not the income registered for
      // the month. A deposit without an origin is new income and does increase it.
      amount: salary.amount + (isTransfer ? 0 : amountUsd),
      balance: Number(salary.balance ?? salary.amount) + amountUsd,
      transferAdjustment: Number(salary.transferAdjustment ?? 0) + (isTransfer && !movement.preserveSourceBalance ? amountUsd : 0),
    }
    return salary
  })

  if (!target) {
    salaries.unshift({
      id: createId('salary'),
      amount: isTransfer ? 0 : amountUsd,
      balance: amountUsd,
      transferAdjustment: isTransfer && !movement.preserveSourceBalance ? amountUsd : 0,
      month: movement.month,
      currencyCode: normalizedCurrency,
      sourceId: destinationSource.id,
      sourceName: destinationSource.name,
      kind: destinationSource.recurring ? 'recurring' : 'one-off',
      balanceMode: destinationSource.balanceMode === 'zero' ? 'zero' : 'fixed',
    })
  }

  return { salaries, incomeSources }
}
