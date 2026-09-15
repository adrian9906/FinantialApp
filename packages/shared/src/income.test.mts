// Income can now come from several sources per month. Recurring income (a job)
// carries forward on its own; one-off income (a bonus) stays in its month.
import { strict as assert } from 'node:assert'

import {
  carrySalaryForwardToMonth,
  getIncomesForMonth,
  getSalaryForMonth,
  getTotalIncomeForMonth,
  isRecurringIncome,
  normalizeSalaryHistory,
} from './salary-utils.ts'
import type { Salary } from './types.ts'

let seq = 0
const makeId = () => `gen-${++seq}`

const job = (id: string, amount: number, month: string, sourceId: string, name: string): Salary =>
  ({ id, amount, month, sourceId, sourceName: name, kind: 'recurring' })
const bonus = (id: string, amount: number, month: string, name = 'Bonus'): Salary =>
  ({ id, amount, month, sourceId: 'bonus', sourceName: name, kind: 'one-off' })

// --- Several jobs in the same month all count ---
{
  const salaries = [
    job('a', 1000, '2026-03', 'job-1', 'Empresa X'),
    job('b', 400, '2026-03', 'job-2', 'Freelance'),
  ]
  assert.equal(getTotalIncomeForMonth(salaries, '2026-03'), 1400, 'deben sumarse los dos trabajos')
  assert.equal(getIncomesForMonth(salaries, '2026-03').length, 2)
  console.log('PASS 1: varios trabajos en el mismo mes suman al total')
}

// --- A bonus adds on top of the salary ---
{
  const salaries = [
    job('a', 1000, '2026-03', 'job-1', 'Empresa X'),
    bonus('b', 250, '2026-03', 'Bonus anual'),
  ]
  assert.equal(getTotalIncomeForMonth(salaries, '2026-03'), 1250, 'el bonus suma al ingreso del mes')
  console.log('PASS 2: el bonus suma al ingreso del mes')
}

// --- Recurring carries forward; the bonus does not ---
{
  const salaries = [
    job('a', 1000, '2026-03', 'job-1', 'Empresa X'),
    job('b', 400, '2026-03', 'job-2', 'Freelance'),
    bonus('c', 250, '2026-03', 'Bonus anual'),
  ]
  const carried = carrySalaryForwardToMonth(salaries, '2026-04', makeId)
  const april = getIncomesForMonth(carried, '2026-04')

  assert.equal(april.length, 2, `abril debe heredar los 2 trabajos, tiene ${april.length}`)
  assert.equal(getTotalIncomeForMonth(carried, '2026-04'), 1400, 'abril NO debe incluir el bonus')
  assert.ok(!april.some((s) => s.kind === 'one-off'), 'ningun bonus debe arrastrarse')
  // March keeps everything it had.
  assert.equal(getTotalIncomeForMonth(carried, '2026-03'), 1650)
  console.log('PASS 3: los trabajos se arrastran, el bonus se queda en su mes')
}

// --- Editing one month does not duplicate on carry-forward ---
{
  const salaries = [
    job('a', 1000, '2026-03', 'job-1', 'Empresa X'),
    job('b', 1200, '2026-04', 'job-1', 'Empresa X'),
  ]
  const carried = carrySalaryForwardToMonth(salaries, '2026-04', makeId)
  assert.equal(getIncomesForMonth(carried, '2026-04').length, 1, 'no debe duplicarse el mes ya cargado')
  assert.equal(getTotalIncomeForMonth(carried, '2026-04'), 1200, 'debe respetar el monto editado')
  console.log('PASS 4: un mes ya cargado no se duplica ni se pisa')
}

// --- Legacy records (no sourceId, no kind) keep working ---
{
  const legacy: Salary[] = [{ id: 'old', amount: 900, month: '2026-01' }]
  assert.equal(isRecurringIncome(legacy[0]), true, 'un registro viejo se trata como recurrente')
  assert.equal(getTotalIncomeForMonth(legacy, '2026-01'), 900)

  const carried = carrySalaryForwardToMonth(legacy, '2026-03', makeId)
  assert.equal(getTotalIncomeForMonth(carried, '2026-03'), 900, 'el salario viejo sigue arrastrandose')
  assert.equal(getSalaryForMonth(legacy, '2026-02')?.amount, 900, 'meses sin carga usan el ultimo conocido')
  console.log('PASS 5: los datos existentes siguen funcionando igual')
}

// --- A month with only a past bonus does not inflate later months ---
{
  const salaries = [bonus('b', 500, '2026-03', 'Aguinaldo')]
  assert.equal(getSalaryForMonth(salaries, '2026-04'), null, 'un bonus pasado no cuenta como ingreso de abril')
  const carried = carrySalaryForwardToMonth(salaries, '2026-05', makeId)
  assert.equal(getTotalIncomeForMonth(carried, '2026-05'), 0, 'mayo no hereda un bonus')
  console.log('PASS 6: un bonus pasado no infla los meses siguientes')
}

// --- normalizeSalaryHistory keeps one entry per source per month ---
{
  const salaries = [
    job('a', 1000, '2026-03', 'job-1', 'Empresa X'),
    job('dup', 999, '2026-03', 'job-1', 'Empresa X'),
    job('b', 400, '2026-03', 'job-2', 'Freelance'),
  ]
  const normalized = normalizeSalaryHistory(salaries)
  assert.equal(normalized.length, 2, 'se descarta el duplicado de la misma fuente')
  assert.equal(getTotalIncomeForMonth(salaries, '2026-03'), 1400)
  console.log('PASS 7: no se duplica la misma fuente en un mes')
}

// --- A recurring account may exist next month but intentionally start at zero ---
{
  const exchangeAccount: Salary = {
    ...job('exchange', 150, '2026-09', 'exchange-source', 'Cambio en moneda nacional'),
    balanceMode: 'zero',
  }
  const carried = carrySalaryForwardToMonth([exchangeAccount], '2026-10', makeId)
  const october = getIncomesForMonth(carried, '2026-10')
  assert.equal(october.length, 1, 'la cuenta mensual debe seguir existiendo')
  assert.equal(october[0].amount, 0, 'la cuenta debe comenzar el mes en cero')
  assert.equal(getSalaryForMonth([exchangeAccount], '2026-10')?.amount, 0, 'el fallback tampoco debe repetir el saldo')
  console.log('PASS 8: una cuenta mensual configurable comienza el mes en cero')
}

// --- Unspent money remains available alongside next month's fixed income ---
{
  const fixedAccount: Salary = {
    ...job('fixed-spent', 100, '2026-09', 'salary-fixed', 'Salario fijo'),
    balance: 35,
    balanceMode: 'fixed',
  }
  const carried = carrySalaryForwardToMonth([fixedAccount], '2026-10', makeId)
  const october = getIncomesForMonth(carried, '2026-10')
  assert.equal(october[0].balance, 135)
  assert.equal(october[0].amount, 100, 'el sobrante no cuenta como nuevo ingreso')
  console.log('PASS 9: una cuenta fija conserva el sobrante y suma el nuevo ingreso')
}

{
  const salary: Salary = { ...job('rollover', 400, '2026-09', 'salary', 'Salario'), balance: 200 }
  const savings: Salary = { ...job('savings', 0, '2026-09', 'savings', 'Ahorro USD'), balance: 80 }
  const variable: Salary = { ...job('variable', 100, '2026-09', 'cup', 'Cuenta CUP'), balance: 25, balanceMode: 'zero', currencyCode: 'CUP' }
  const carried = carrySalaryForwardToMonth([salary, savings, variable], '2026-10', makeId)
  const october = getIncomesForMonth(carried, '2026-10')
  assert.equal(october.find((entry) => entry.sourceId === 'salary')?.balance, 600)
  assert.equal(october.find((entry) => entry.sourceId === 'savings')?.balance, 80)
  assert.equal(october.find((entry) => entry.sourceId === 'cup')?.balance, 25)
  assert.equal(october.find((entry) => entry.sourceId === 'cup')?.amount, 0)
  assert.equal(october.find((entry) => entry.sourceId === 'cup')?.currencyCode, 'CUP')
  assert.deepEqual(carrySalaryForwardToMonth(carried, '2026-10', makeId), carried, 'repetir no duplica el ingreso ni el sobrante')
  assert.equal(salary.balance, 200, 'el historial no se modifica')
  const november = getIncomesForMonth(carrySalaryForwardToMonth([salary], '2026-11', makeId), '2026-11')
  assert.equal(november[0].balance, 1000, 'cada mes parte del saldo anterior')
  console.log('PASS 10: arrastre por cuenta y moneda, ahorro e idempotencia')
}

console.log('\nIngresos multiples correctos.')
