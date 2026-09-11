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
