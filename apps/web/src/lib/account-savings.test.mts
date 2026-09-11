import assert from 'node:assert/strict'

import type { IncomeSource, Salary } from '@plata/shared'
import {
  findSavingsAccount,
  getAccountSavingsAmount,
  getAccountSavingsPlan,
  getAccountSavingsPlans,
  getAccountSavingsRate,
  getSavingsAccountBalance,
  getSavingsAccountName,
} from './account-savings.ts'

function account(id: string, currencyCode: string, isCash: boolean, amount: number, balance = amount) {
  const source: IncomeSource = { id, name: `Cuenta ${id}`, recurring: true, isCash, currencyCode }
  const salary: Salary = { id: `${id}-salary`, amount, balance, month: '2026-09', sourceId: id, currencyCode }
  return { source, salary }
}

const salaryAccount = account('salary', 'USD', true, 400)
const transferAccount = account('transfer', 'CUP', false, 1000)

// El porcentaje se guarda por cuenta, no global.
assert.equal(getAccountSavingsRate({ salary: 50 }, 'salary'), 50)
assert.equal(getAccountSavingsRate({ salary: 50 }, 'transfer'), 0, 'una cuenta sin formula no ahorra')
assert.equal(getAccountSavingsRate({ salary: 150 }, 'salary'), 100, 'se limita a 100')
assert.equal(getAccountSavingsRate({ salary: -5 }, 'salary'), 0, 'no acepta negativos')
console.log('PASS 1: el porcentaje de ahorro se define por cuenta')

// El 50% del salario de 400 son 200 USD.
assert.equal(getAccountSavingsAmount(salaryAccount, 50), 200)
assert.equal(getAccountSavingsAmount(transferAccount, 10), 100)
assert.equal(getAccountSavingsAmount(salaryAccount, 0), 0)
console.log('PASS 2: el monto sale del porcentaje sobre la base de la cuenta')

// Si ya gastaste parte, no puedes sacar mas de lo que queda.
const spent = account('spent', 'USD', true, 400, 120)
assert.equal(getAccountSavingsAmount(spent, 50), 120, 'se limita al saldo disponible')
console.log('PASS 3: nunca se descuenta mas que el saldo disponible')

// Cada moneda y forma de pago tiene su propia cuenta de ahorro.
assert.equal(getSavingsAccountName('usd', true), 'Ahorro USD Efectivo')
assert.equal(getSavingsAccountName('CUP', false), 'Ahorro CUP Transferencia')

const usdPlan = getAccountSavingsPlan(salaryAccount, { salary: 50 }, [salaryAccount.source])
assert.equal(usdPlan?.amountUsd, 200)
assert.equal(usdPlan?.currencyCode, 'USD')
assert.equal(usdPlan?.isCash, true)
assert.equal(usdPlan?.savingsAccountName, 'Ahorro USD Efectivo')
assert.equal(usdPlan?.existingSavingsSourceId, undefined, 'la primera vez no existe todavia')

const cupPlan = getAccountSavingsPlan(transferAccount, { transfer: 10 }, [transferAccount.source])
assert.equal(cupPlan?.savingsAccountName, 'Ahorro CUP Transferencia', 'no se mezcla con el ahorro del salario')
assert.equal(cupPlan?.isCash, false, 'conserva la forma de pago de origen')
console.log('PASS 4: cada moneda y forma de pago tiene su cuenta de ahorro')

// Si la cuenta de ahorro ya existe se reutiliza en vez de duplicarse.
const existingSavings: IncomeSource = {
  id: 'savings-usd', name: 'Ahorro USD Efectivo', recurring: true, isCash: true, currencyCode: 'USD',
}
assert.equal(findSavingsAccount([existingSavings], 'USD', true)?.id, 'savings-usd')
assert.equal(findSavingsAccount([existingSavings], 'USD', false), undefined, 'la forma de pago debe coincidir')
assert.equal(findSavingsAccount([existingSavings], 'CUP', true), undefined, 'la moneda debe coincidir')
assert.equal(
  getAccountSavingsPlan(salaryAccount, { salary: 50 }, [salaryAccount.source, existingSavings])?.existingSavingsSourceId,
  'savings-usd',
)
console.log('PASS 5: se reutiliza la cuenta de ahorro existente')

// Una cuenta de ahorro no se ahorra a si misma.
const savingsView = { source: existingSavings, salary: { id: 's', amount: 100, balance: 100, month: '2026-09', sourceId: 'savings-usd', currencyCode: 'USD' } as Salary }
assert.equal(getAccountSavingsPlan(savingsView, { 'savings-usd': 50 }, [existingSavings]), null)
console.log('PASS 6: una cuenta de ahorro no se ahorra a si misma')

// Sin porcentaje o sin saldo no hay nada que aplicar.
assert.equal(getAccountSavingsPlan(salaryAccount, {}, []), null)
assert.equal(getAccountSavingsPlan(account('empty', 'USD', true, 400, 0), { empty: 50 }, []), null)
const plans = getAccountSavingsPlans([salaryAccount, transferAccount], { salary: 50 }, [])
assert.deepEqual(plans.map((plan) => plan.sourceId), ['salary'], 'solo las cuentas con formula')
console.log('PASS 7: sin porcentaje o sin saldo no hay nada que aplicar')

// El saldo ya ahorrado se lee de la cuenta de ahorro del mes.
const salaries: Salary[] = [{ id: 'x', amount: 200, balance: 150, month: '2026-09', sourceId: 'savings-usd' }]
assert.equal(getSavingsAccountBalance(salaries, 'savings-usd', '2026-09'), 150)
assert.equal(getSavingsAccountBalance(salaries, 'savings-usd', '2026-08'), 0)
console.log('PASS 8: se lee el saldo ya ahorrado del mes')

console.log('Formulas de ahorro por cuenta correctas.')

// --- Metas de ahorro por cuenta -------------------------------------------

const { getAccountSavingsGoals } = await import('./account-savings.ts')

const goalSalary = account('salary', 'USD', true, 400)
const goalTransfer = account('transfer', 'CUP', false, 1000)
const usdSavingsSource: IncomeSource = {
  id: 'savings-usd', name: 'Ahorro USD Efectivo', recurring: true, isCash: true, currencyCode: 'USD',
}
const goalSalaries: Salary[] = [
  { id: 'a', amount: 68, balance: 68, month: '2026-09', sourceId: 'savings-usd', currencyCode: 'USD' },
]

// Una cuenta en 0% no tiene meta y no debe aparecer.
const goals = getAccountSavingsGoals(
  [goalSalary, goalTransfer],
  { salary: 50, transfer: 0 },
  [goalSalary.source, goalTransfer.source, usdSavingsSource],
  goalSalaries,
  '2026-09',
)
assert.deepEqual(goals.map((goal) => goal.sourceId), ['salary'], 'la cuenta en 0% no se muestra')
console.log('PASS 9: una cuenta en 0% no aparece en las metas')

// Cada meta se mide contra SU cuenta de ahorro, sin sumar monedas distintas.
assert.equal(goals[0].goalUsd, 200, 'el 50% de 400')
assert.equal(goals[0].savedUsd, 68, 'solo lo que hay en su cuenta de ahorro')
assert.equal(goals[0].remainingUsd, 132)
assert.equal(goals[0].progress, 34)
assert.equal(goals[0].isComplete, false)
assert.equal(goals[0].currencyCode, 'USD')
console.log('PASS 10: cada meta se mide contra su propia cuenta de ahorro')

// Dos cuentas con formula generan dos metas separadas, cada una en su moneda.
const both = getAccountSavingsGoals(
  [goalSalary, goalTransfer],
  { salary: 50, transfer: 10 },
  [goalSalary.source, goalTransfer.source, usdSavingsSource],
  goalSalaries,
  '2026-09',
)
assert.equal(both.length, 2)
assert.equal(both[1].currencyCode, 'CUP')
assert.equal(both[1].savedUsd, 0, 'la cuenta CUP no hereda el saldo del ahorro USD')
assert.equal(both[1].goalUsd, 100)
console.log('PASS 11: las metas no mezclan monedas ni cuentas')

// La meta se marca cumplida cuando su propia cuenta la alcanza.
const complete = getAccountSavingsGoals(
  [goalSalary],
  { salary: 50 },
  [goalSalary.source, usdSavingsSource],
  [{ id: 'b', amount: 200, balance: 200, month: '2026-09', sourceId: 'savings-usd', currencyCode: 'USD' }],
  '2026-09',
)
assert.equal(complete[0].isComplete, true)
assert.equal(complete[0].progress, 100)
assert.equal(complete[0].remainingUsd, 0)
console.log('PASS 12: la meta se cumple con el saldo de su propia cuenta')

console.log('Metas de ahorro por cuenta correctas.')
