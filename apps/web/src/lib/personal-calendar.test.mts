import assert from 'node:assert/strict'
import { calendarMonthDays, eventsOn, occursOn } from './personal-calendar.ts'
const base = { id: '1', name: 'Internet', date: '2026-01-31', amount: 0, isNotification: false }
const payment = { ...base, recurrence: 'monthly' as const }
assert.equal(occursOn(payment, '2026-02-28'), true)
assert.equal(occursOn(payment, '2026-03-31'), true, 'no desplaza permanentemente el día de pago')
assert.equal(occursOn(payment, '2025-12-31'), false, 'no crea eventos antes de su inicio')
const birthday = { ...base, date: '2024-02-29', recurrence: 'yearly' as const }
assert.equal(occursOn(birthday, '2027-02-28'), true)
assert.equal(occursOn(birthday, '2028-02-29'), true)
assert.equal(occursOn(birthday, '2027-03-29'), false)
assert.equal(occursOn(base, '2026-02-28'), false)
assert.equal(calendarMonthDays('2026-02')[0], '2026-01-26')
assert.equal(calendarMonthDays('2026-02').length, 42)
assert.deepEqual(eventsOn([{ ...base, id: 'late', time: '17:00' }, { ...base, id: 'early', time: '08:00' }], base.date).map(e => e.id), ['early', 'late'])
console.log('PASS: eventos únicos, pagos mensuales, cumpleaños anuales y límites de mes/año.')
