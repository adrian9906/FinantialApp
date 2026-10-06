import assert from 'node:assert/strict'

import type { IncomeSource, Salary } from '@plata/shared'
import {
  findSavingsAccount,
  getAccountSavingsAmount,
  getAccountAllocationFormula,
  getAccountSavingsPlan,
  getAccountSavingsPlans,
  getAccountSavingsRate,
  getSavingsAccountBalance,
  getSavingsAccountName,
  ensureSavingsCurrencyAccounts,
  normalizeLegacySavingsAccounts,
  migrateLegacySavingsLedger,
  getAvailableSavingsByCurrency,
  repairMisassignedLegacyCupSavings,
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
assert.deepEqual(
  getAccountAllocationFormula({ salary: 50 }, 'salary', { savings: 25, expenses: 50, wants: 25, rolloverSavings: true }),
  { savings: 50, expenses: 33.3, wants: 16.7, rolloverSavings: true },
  'la preferencia antigua conserva el ahorro y reparte el resto',
)
assert.deepEqual(
  getAccountAllocationFormula({}, 'new-account', { savings: 25, expenses: 65, wants: 35, rolloverSavings: true }),
  { savings: 25, expenses: 48.8, wants: 26.2, rolloverSavings: true },
  'convierte automáticamente la antigua fórmula secuencial al reparto directo',
)
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
assert.equal(getSavingsAccountName('usd', true), 'Ahorro USD')
assert.equal(getSavingsAccountName('CUP', false), 'Ahorro CUP')

const usdPlan = getAccountSavingsPlan(salaryAccount, { salary: 50 }, [salaryAccount.source])
assert.equal(usdPlan?.amountUsd, 200)
assert.equal(usdPlan?.currencyCode, 'USD')
assert.equal(usdPlan?.isCash, true)
assert.equal(usdPlan?.savingsAccountName, 'Ahorro USD')
assert.equal(usdPlan?.existingSavingsSourceId, undefined, 'la primera vez no existe todavia')

const cupPlan = getAccountSavingsPlan(transferAccount, { transfer: 10 }, [transferAccount.source])
assert.equal(cupPlan?.savingsAccountName, 'Ahorro CUP', 'no se mezcla con el ahorro USD')
assert.equal(cupPlan?.isCash, false, 'conserva la forma de pago de origen')
console.log('PASS 4: cada moneda tiene una sola cuenta de ahorro')

// Si la cuenta de ahorro ya existe se reutiliza en vez de duplicarse.
const existingSavings: IncomeSource = {
  id: 'savings-usd', name: 'Ahorro USD Efectivo', recurring: true, isCash: true, currencyCode: 'USD',
}
assert.equal(findSavingsAccount([existingSavings], 'USD', true)?.id, 'savings-usd')
assert.equal(findSavingsAccount([existingSavings], 'USD', false)?.id, 'savings-usd', 'efectivo y transferencia comparten ahorro por moneda')
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

// El formato anterior dividía 400 en salario 200 + cuenta interna de ahorro 200.
const repaired = normalizeLegacySavingsAccounts({
  salaries: [
    { ...salaryAccount.salary, amount: 200, balance: 200 },
    { id: 'legacy-saving', amount: 200, balance: 200, month: '2026-09', sourceId: 'savings-usd', sourceName: 'Ahorro USD Efectivo', currencyCode: 'USD' },
  ],
  incomeSources: [salaryAccount.source, usdSavingsSource],
  transactions: [], debts: [], wishlist: [], monthlyPlanningHistory: [], events: [], projections: [], savingsGoals: [], reminders: [], subscriptions: [],
})
assert.equal(repaired.salaries.find((entry) => entry.id === salaryAccount.salary.id)?.amount, 400)
assert.equal(repaired.salaries.find((entry) => entry.id === salaryAccount.salary.id)?.balance, 400)
assert.equal(repaired.salaries.find((entry) => entry.id === 'legacy-saving')?.amount, 0)
assert.equal(repaired.salaries.find((entry) => entry.id === 'legacy-saving')?.balance, 200)
console.log('PASS 13: el formato antiguo se restaura como salario 400 y ahorro interno 200')

const ensured = ensureSavingsCurrencyAccounts({
  salaries: [], incomeSources: [], transactions: [], debts: [], wishlist: [], monthlyPlanningHistory: [], events: [], projections: [], savingsGoals: [], reminders: [], subscriptions: [],
}, 'user-1', '2026-09')
assert.deepEqual(
  ensured.incomeSources.map((source) => source.name).sort(),
  ['Ahorro CUP', 'Ahorro USD'],
)
assert.ok(ensured.salaries.every((salary) => salary.amount === 0 && salary.balance === 0))
console.log('PASS 14: existen exactamente las cuentas internas USD y CUP')

const completedPlan = getAccountSavingsPlan(
  account('salary', 'USD', true, 400, 400),
  { salary: { savings: 20, expenses: 60, wants: 20, rolloverSavings: false } },
  [salaryAccount.source, usdSavingsSource],
  [{ id: 'saved', amount: 0, balance: 80, month: '2026-09', sourceId: 'savings-usd', currencyCode: 'USD' }],
  '2026-09',
)
assert.equal(completedPlan, null, 'el 20% ya aplicado no debe aparecer de nuevo')
console.log('PASS 15: la asignación por cuenta solo se aplica una vez')

console.log('Metas de ahorro por cuenta correctas.')

const legacyLedger = {
  ...ensured,
  transactions: [
    { id: 'legacy-deposit', type: 'saving' as const, amount: 68, date: '2026-09-01' },
    { id: 'legacy-withdrawal', type: 'saving' as const, amount: -20, date: '2026-09-02' },
    { id: 'cup-deposit', type: 'saving' as const, amount: 100, date: '2026-09-01', incomeSourceId: 'cup' },
  ],
  incomeSources: [...ensured.incomeSources, { ...transferAccount.source, id: 'cup' }],
}
const migrated = migrateLegacySavingsLedger(legacyLedger, '2026-09')
assert.equal(migrateLegacySavingsLedger(ensured, '2026-09'), ensured,
  'un dispositivo vacío no se marca migrado antes de recibir los aportes remotos')
assert.equal(getSavingsAccountBalance(migrated.salaries, 'savings-user-1-usd', '2026-09'), 48,
  'los aportes antiguos aparecen aunque la cuenta interna estuviera vacía; se descuentan retiros')
assert.equal(getSavingsAccountBalance(migrated.salaries, 'savings-user-1-cup', '2026-09'), 100,
  'cada moneda recupera únicamente sus propios aportes')
assert.equal(migrateLegacySavingsLedger(migrated, '2026-09'), migrated, 'la reparación es idempotente')
const emptied = { ...migrated, salaries: migrated.salaries.map((salary) => ({ ...salary, balance: 0 })) }
assert.equal(migrateLegacySavingsLedger(emptied, '2026-09'), emptied,
  'un saldo gastado después de migrar no resucita al recargar')
const nextMonth = ensureSavingsCurrencyAccounts(emptied, 'user-1', '2026-10')
assert.equal(migrateLegacySavingsLedger(nextMonth, '2026-10'), nextMonth,
  'el cambio de mes conserva la marca y no vuelve a sumar el historial')
const alreadyRecorded = { ...legacyLedger, salaries: legacyLedger.salaries.map((salary) => ({ ...salary, balance: 200 })) }
const preserved = migrateLegacySavingsLedger(alreadyRecorded, '2026-09')
assert.ok(preserved.salaries.every((salary) => salary.balance === 200),
  'el ahorro registrado en las cuentas no se suma otra vez al historial')
console.log('PASS: migración de aportes históricos, retiros, monedas y recargas sin duplicar')

const savingsOnlyUsd = {
  ...migrated,
  salaries: migrated.salaries.map((salary) => ({ ...salary,
    balance: salary.sourceId === 'savings-user-1-usd' ? 200 : 0 })),
}
const fundedWish = { id: 'funded', name: 'Meta', price: 200, savedAmount: 200, priority: 'high' as const, sourceCurrency: 'USD' }
assert.deepEqual(getAvailableSavingsByCurrency(savingsOnlyUsd.salaries, savingsOnlyUsd.incomeSources, [fundedWish], 'USD', '2026-09'),
  { balance: 200, purchasedReserved: 0, free: 200 }, 'un deseo financiado sin compra no reduce el saldo USD')
assert.deepEqual(getAvailableSavingsByCurrency(savingsOnlyUsd.salaries, savingsOnlyUsd.incomeSources, [fundedWish], 'CUP', '2026-09'),
  { balance: 0, purchasedReserved: 0, free: 0 }, 'tener USD no genera ahorro CUP')
assert.equal(getAvailableSavingsByCurrency(savingsOnlyUsd.salaries, savingsOnlyUsd.incomeSources,
  [{ ...fundedWish, isPurchased: true, savedAmount: 50, purchasedAt: '2026-09-20' }], 'USD', '2026-09').free, 150,
  'las compras confirmadas sí consumen ahorro de su moneda')
assert.equal(getAvailableSavingsByCurrency(savingsOnlyUsd.salaries, savingsOnlyUsd.incomeSources,
  [{ ...fundedWish, isPurchased: true, sourceCurrency: 'CUP' }], 'USD', '2026-09').free, 200,
  'una compra CUP no consume ahorro USD')
console.log('PASS: disponible común, metas sin comprar y separación USD/CUP')

const oldPurchases = [200, 10, 10, 22, 8].map((savedAmount, index) => ({
  ...fundedWish, id: `old-${index}`, savedAmount, isPurchased: true, purchasedAt: '2026-08-09',
}))
assert.equal(getAvailableSavingsByCurrency(savingsOnlyUsd.salaries, savingsOnlyUsd.incomeSources,
  oldPurchases, 'USD', '2026-10').free, 200,
  'las compras anteriores al saldo inicial no consumen los 200 USD actuales otra vez')
const cupOrigin: IncomeSource = { id: 'transfer', name: 'Transferencia', currencyCode: 'CUP', recurring: true }
const corrupt = {
  ...ensured,
  incomeSources: [cupOrigin, ...ensured.incomeSources],
  transactions: [{ id: 'old-usd', type: 'saving' as const, amount: 318, date: '2026-08-01', incomeSourceId: cupOrigin.id }],
  salaries: [...ensured.salaries, {
    id: 'cup-current', sourceId: 'savings-user-1-cup', month: '2026-10', amount: 0, balance: 318, savingsLedgerMigrated: true,
  }],
}
const repairedCup = repairMisassignedLegacyCupSavings(corrupt)
assert.equal(getSavingsAccountBalance(repairedCup.salaries, 'savings-user-1-cup', '2026-10'), 0,
  'elimina el CUP inventado por vincular historial USD anterior al saldo inicial')
assert.equal(repairMisassignedLegacyCupSavings(repairedCup), repairedCup, 'la reparación CUP no se repite')
const realCup = { ...corrupt, transactions: [...corrupt.transactions, {
  id: 'real-cup', type: 'saving' as const, amount: 100, date: '2026-10-01', incomeSourceId: cupOrigin.id,
}] }
assert.equal(repairMisassignedLegacyCupSavings(realCup), realCup, 'conserva el CUP cuando existen aportes reales de esa moneda')
console.log('PASS: caso real de 200 USD actuales, compras históricas y CUP creado por la migración')
