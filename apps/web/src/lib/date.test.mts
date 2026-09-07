// The planning pages describe one pay cycle (cobro). The cobro is delimited by
// the monthly close, not by the calendar: resetMonthlyPlans archives every
// expense and want into monthlyPlanningHistory and removes them from the list,
// so whatever is still in the list belongs to the active cobro.
import { strict as assert } from 'node:assert'

import { matchesTransactionDateFilter } from './date.ts'

// Reference: 15 March 2026.
const midCycle = new Date(2026, 2, 15)

// --- "Todo el cobro" keeps everything still in the list ---
assert.equal(matchesTransactionDateFilter('2026-03-15', 'cycle', midCycle), true, 'hoy')
assert.equal(matchesTransactionDateFilter('2026-03-01', 'cycle', midCycle), true, 'inicio de mes')
assert.equal(
  matchesTransactionDateFilter('2026-02-25', 'cycle', midCycle),
  true,
  'un gasto de antes del cambio de mes sigue siendo de este cobro si no hubo cierre',
)
assert.equal(
  matchesTransactionDateFilter('2026-04-02', 'cycle', midCycle),
  true,
  'un gasto posterior al cierre tampoco debe desaparecer',
)
console.log('PASS 1: "Todo el cobro" no recorta por mes calendario')

// --- Hoy / Ayer still work as day filters ---
assert.equal(matchesTransactionDateFilter('2026-03-15', 'today', midCycle), true)
assert.equal(matchesTransactionDateFilter('2026-03-14', 'today', midCycle), false)
assert.equal(matchesTransactionDateFilter('2026-03-14', 'yesterday', midCycle), true)
assert.equal(matchesTransactionDateFilter('2026-03-13', 'yesterday', midCycle), false)
console.log('PASS 2: Hoy y Ayer siguen filtrando por dia')

// --- "Ayer" across a month boundary still resolves to the real day ---
const firstDay = new Date(2026, 2, 1)
assert.equal(
  matchesTransactionDateFilter('2026-02-28', 'yesterday', firstDay),
  true,
  'el dia 1, "Ayer" es el 28 de febrero y ese gasto sigue en la lista',
)
console.log('PASS 3: "Ayer" cruza el cambio de mes correctamente')

// --- Malformed dates never leak in ---
assert.equal(matchesTransactionDateFilter('', 'cycle', midCycle), false)
assert.equal(matchesTransactionDateFilter('no-es-fecha', 'cycle', midCycle), false)
assert.equal(matchesTransactionDateFilter('2026-03-10T14:32:00.000Z', 'cycle', midCycle), true)
console.log('PASS 4: fechas invalidas se descartan, timestamps funcionan')

console.log('\nFiltro por cobro correcto.')
