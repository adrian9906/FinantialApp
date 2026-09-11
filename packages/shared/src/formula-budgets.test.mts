import assert from 'node:assert/strict'

import { defaultFormula, getFormulaBudgets, getFormulaTotal } from './preferences.ts'

// El ahorro sale primero; gastos y gustos reparten lo que queda.
const half = getFormulaBudgets(400, { savings: 50, expenses: 50, wants: 50 })
assert.equal(half.savings, 200, 'el 50% de 400 va a ahorro')
assert.equal(half.spendable, 200, 'quedan 200 para repartir')
assert.equal(half.expenses, 100, 'el 50% de los 200 restantes')
assert.equal(half.wants, 100)
console.log('PASS 1: 400 con ahorro 50% deja 100 y 100 para gastos y gustos')

// Si una categoria queda en 0, la otra se lleva todo el resto.
const noWants = getFormulaBudgets(400, { savings: 50, expenses: 100, wants: 0 })
assert.equal(noWants.expenses, 200, 'gastos se lleva los 200 completos')
assert.equal(noWants.wants, 0)
const noExpenses = getFormulaBudgets(400, { savings: 50, expenses: 0, wants: 100 })
assert.equal(noExpenses.wants, 200, 'gustos se lleva los 200 completos')
assert.equal(noExpenses.expenses, 0)
console.log('PASS 2: si una categoria es 0% la otra recibe todo el resto')

// El caso real: meta de ahorro 250 y de gastos 150 sobre 400. Un porcentaje
// entero no puede expresarlo (62% da 248 y 63% da 252), por eso se admite un
// decimal.
const real = getFormulaBudgets(400, { savings: 62.5, expenses: 100, wants: 0 })
assert.equal(real.savings, 250, 'el 62.5% de 400 son exactamente 250')
assert.equal(real.expenses, 150, 'quedan 150 para gastos')
assert.equal(real.wants, 0)
assert.equal(getFormulaBudgets(400, { savings: 62.55, expenses: 100, wants: 0 }).savings, 250.4, '62.55 se redondea a 62.6')
console.log('PASS 3: se admite un decimal para poder repartir 250 y 150')

// Solo gastos y gustos deben sumar 100: el ahorro ya salio antes.
assert.equal(getFormulaTotal({ expenses: 100, wants: 0 }), 100)
assert.equal(getFormulaTotal({ expenses: 65, wants: 35 }), 100)
assert.equal(getFormulaTotal(defaultFormula), 100, 'la formula por defecto es valida')
console.log('PASS 4: solo gastos y gustos suman 100')

// Sin ahorro todo el ingreso queda disponible para repartir.
const zeroSavings = getFormulaBudgets(400, { savings: 0, expenses: 50, wants: 50 })
assert.equal(zeroSavings.savings, 0)
assert.equal(zeroSavings.spendable, 400)
assert.equal(zeroSavings.expenses, 200)
console.log('PASS 5: sin ahorro se reparte el ingreso completo')

// Un ahorro del 100% no deja nada para gastar, y nunca sale negativo.
const allSavings = getFormulaBudgets(400, { savings: 100, expenses: 50, wants: 50 })
assert.equal(allSavings.savings, 400)
assert.equal(allSavings.spendable, 0)
assert.equal(allSavings.expenses, 0)
console.log('PASS 6: un ahorro del 100% no deja presupuesto para gastar')

// Ingresos invalidos o vacios no rompen el calculo.
for (const income of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
  const budgets = getFormulaBudgets(income, { savings: 50, expenses: 50, wants: 50 })
  assert.equal(budgets.savings, 0)
  assert.equal(budgets.spendable, 0)
  assert.equal(budgets.expenses, 0)
}
console.log('PASS 7: ingresos invalidos devuelven presupuestos en cero')

console.log('Formula secuencial correcta.')
