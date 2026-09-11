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

// El 50% del salario sale de la cuenta y entra al ahorro USD en efectivo.
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
}, makeId)

assert.equal(salaryById('s1').balance, 200, 'se descuenta de la cuenta de origen')
const usdSavings = state.incomeSources.find((source) => source.name === 'Ahorro USD Efectivo')!
assert.ok(usdSavings, 'se crea la cuenta de ahorro USD')
assert.equal(usdSavings.isCash, true)
const usdSavingsSalary = state.salaries.find((salary) => salary.sourceId === usdSavings.id)!
assert.equal(usdSavingsSalary.balance, 200, 'el dinero llega al ahorro')
assert.equal(usdSavingsSalary.currencyCode, 'USD')
console.log('PASS 1: el 50% del salario se descuenta y llega al ahorro USD efectivo')

// La cuenta CUP de transferencia ahorra en SU propia cuenta, no en la del salario.
const cupPlan = getAccountSavingsPlan(
  { source: cupSource, salary: salaryById('s2') },
  { salary: 50, cup: 10 },
  state.incomeSources,
)!
assert.equal(cupPlan.amountUsd, 100)
assert.equal(cupPlan.savingsAccountName, 'Ahorro CUP Transferencia')
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
}, makeId)

const cupSavings = state.incomeSources.find((source) => source.name === 'Ahorro CUP Transferencia')!
assert.notEqual(cupSavings.id, usdSavings.id, 'no se mezcla con el ahorro del salario')
assert.equal(cupSavings.isCash, false, 'conserva la forma de pago de origen')
const cupSavingsSalary = state.salaries.find((salary) => salary.sourceId === cupSavings.id)!
assert.equal(cupSavingsSalary.currencyCode, 'CUP', 'conserva la moneda de origen')
assert.equal(cupSavingsSalary.balance, 100)
assert.equal(salaryById('s2').balance, 900)
assert.equal(state.salaries.find((salary) => salary.sourceId === usdSavings.id)!.balance, 200, 'el ahorro USD no se toca')
console.log('PASS 2: la cuenta CUP transferencia ahorra en su propia cuenta, sin mezclar')

// Aplicarlo otra vez acumula en la misma cuenta en vez de duplicarla.
const againPlan = getAccountSavingsPlan(
  { source: salarySource, salary: salaryById('s1') },
  { salary: 50 },
  state.incomeSources,
)!
assert.equal(againPlan.existingSavingsSourceId, usdSavings.id, 'reutiliza la cuenta existente')
state = applyIncomeMoneyMovement(state, {
  sourceSalaryId: againPlan.salaryId,
  amountUsd: againPlan.amountUsd,
  month: '2026-09',
  destination: {
    sourceId: againPlan.existingSavingsSourceId,
    currencyCode: againPlan.currencyCode,
    isCash: againPlan.isCash,
  },
}, makeId)
assert.equal(state.incomeSources.filter((source) => source.name === 'Ahorro USD Efectivo').length, 1, 'no se duplica la cuenta')
assert.equal(state.salaries.find((salary) => salary.sourceId === usdSavings.id)!.balance, 300, 'el ahorro se acumula')
console.log('PASS 3: aplicar de nuevo reutiliza la cuenta y acumula')

console.log('Flujo completo de ahorro por cuenta correcto.')
