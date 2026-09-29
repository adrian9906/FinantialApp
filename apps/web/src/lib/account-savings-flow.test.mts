import assert from 'node:assert/strict'

import type { IncomeSource, Salary } from '@plata/shared'
import { getAccountSavingsPlan } from './account-savings.ts'
import { applyIncomeMoneyMovement } from './income-money.ts'

let counter = 0
const makeId = (prefix: string) => `${prefix}-${++counter}`

const salarySource: IncomeSource = { id: 'salary', name: 'Salario All Novu', recurring: true, isCash: true, currencyCode: 'USD' }
const cupSource: IncomeSource = { id: 'cup', name: 'Cuenta CUP', recurring: true, isCash: false, currencyCode: 'CUP' }

let state = {
  incomeSources: [salarySource, cupSource],
  salaries: [
    { id: 's1', amount: 400, balance: 400, month: '2026-09', sourceId: 'salary', currencyCode: 'USD' },
    { id: 's2', amount: 1000, balance: 1000, month: '2026-09', sourceId: 'cup', currencyCode: 'CUP' },
  ] as Salary[],
}

function salaryById(id: string) {
  return state.salaries.find((salary) => salary.id === id)!
}

// El 50% del salario se asigna al ahorro USD sin alterar el ingreso original.
const salaryPlan = getAccountSavingsPlan(
  { source: salarySource, salary: salaryById('s1') },
  { salary: 50, cup: 10 },
  state.incomeSources,
)!
assert.equal(salaryPlan.amountUsd, 200)
state = applyIncomeMoneyMovement(state, {
  sourceSalaryId: salaryPlan.salaryId,
  amountUsd: salaryPlan.amountUsd,
  month: '2026-09',
  destination: {
    newSourceName: salaryPlan.savingsAccountName,
    currencyCode: salaryPlan.currencyCode,
    isCash: salaryPlan.isCash,
    recurring: true,
    balanceMode: 'fixed',
  },
  preserveSourceBalance: true,
}, makeId)

assert.equal(salaryById('s1').balance, 400, 'el ingreso original permanece intacto')
const usdSavings = state.incomeSources.find((source) => source.name === 'Ahorro USD')!
assert.ok(usdSavings, 'se crea la cuenta de ahorro USD')
assert.equal(usdSavings.isCash, true)
const usdSavingsSalary = state.salaries.find((salary) => salary.sourceId === usdSavings.id)!
assert.equal(usdSavingsSalary.balance, 200, 'el dinero llega al ahorro')
assert.equal(usdSavingsSalary.currencyCode, 'USD')
console.log('PASS 1: el 50% del salario llega al ahorro USD sin reducir el ingreso original')

// La cuenta CUP de transferencia ahorra en SU propia cuenta, no en la del salario.
const cupPlan = getAccountSavingsPlan(
  { source: cupSource, salary: salaryById('s2') },
  { salary: 50, cup: 10 },
  state.incomeSources,
)!
assert.equal(cupPlan.amountUsd, 100)
assert.equal(cupPlan.savingsAccountName, 'Ahorro CUP')
state = applyIncomeMoneyMovement(state, {
  sourceSalaryId: cupPlan.salaryId,
  amountUsd: cupPlan.amountUsd,
  month: '2026-09',
  destination: {
    newSourceName: cupPlan.savingsAccountName,
    currencyCode: cupPlan.currencyCode,
    isCash: cupPlan.isCash,
    recurring: true,
    balanceMode: 'fixed',
  },
  preserveSourceBalance: true,
}, makeId)

const cupSavings = state.incomeSources.find((source) => source.name === 'Ahorro CUP')!
assert.notEqual(cupSavings.id, usdSavings.id, 'no se mezcla con el ahorro del salario')
assert.equal(cupSavings.isCash, false, 'el movimiento conserva la forma de pago indicada')
const cupSavingsSalary = state.salaries.find((salary) => salary.sourceId === cupSavings.id)!
assert.equal(cupSavingsSalary.currencyCode, 'CUP', 'conserva la moneda de origen')
assert.equal(cupSavingsSalary.balance, 100)
assert.equal(salaryById('s2').balance, 1000)
assert.equal(state.salaries.find((salary) => salary.sourceId === usdSavings.id)!.balance, 200, 'el ahorro USD no se toca')
console.log('PASS 2: la cuenta CUP transferencia ahorra en su propia cuenta, sin mezclar')

// La asignación del ciclo ya quedó completa y no se ofrece una segunda vez.
const againPlan = getAccountSavingsPlan(
  { source: salarySource, salary: salaryById('s1') },
  { salary: 50 },
  state.incomeSources,
  state.salaries,
  '2026-09',
)
assert.equal(againPlan, null, 'no permite aplicar dos veces la misma asignación')
assert.equal(state.incomeSources.filter((source) => source.name === 'Ahorro USD').length, 1, 'no se duplica la cuenta')
assert.equal(state.salaries.find((salary) => salary.sourceId === usdSavings.id)!.balance, 200, 'el ahorro queda acumulado')
console.log('PASS 3: la asignación solo se aplica una vez por ciclo')

console.log('Flujo completo de ahorro por cuenta correcto.')
