import assert from 'node:assert/strict'
import { createEmptyBootstrapPayload, type Transaction } from '@plata/shared'
import { accountHealthMessage, buildAccountHealth, isLastWeekOfMonth, nextAccountReview } from './account-health.ts'

const now = new Date(2026, 9, 25, 12)
const account = (id: string, balance: number, currencyCode = 'USD') => ({ source: { id, name: `Cuenta ${id}`, recurring: true, currencyCode }, salary: { id: `salary-${id}`, sourceId: id, month: '2026-10', amount: 400, balance, currencyCode } })
const snapshot = createEmptyBootstrapPayload()
const expenses: Transaction[] = [12, 16, 20].map(day => ({ id: `e-${day}`, type: 'expense', incomeSourceId: 'usd', amount: 10, date: `2026-10-${day}`, description: 'food::checked::0::Comida' }))
snapshot.transactions = expenses
assert.equal(isLastWeekOfMonth(new Date(2026, 9, 24)), false)
assert.equal(isLastWeekOfMonth(now), true)
assert.equal(isLastWeekOfMonth(new Date(2027, 1, 21)), false)
assert.equal(isLastWeekOfMonth(new Date(2027, 1, 22)), true)
assert.equal(isLastWeekOfMonth(new Date(2028, 1, 22)), false)
assert.equal(isLastWeekOfMonth(new Date(2028, 1, 23)), true)
assert.equal(nextAccountReview(new Date(2026, 11, 31)).getFullYear(), 2027)
assert.equal(nextAccountReview(new Date(2026, 9, 1)).getDate(), 25)
const healthy = buildAccountHealth([account('usd', 200)], snapshot, now)[0]
assert.equal(healthy.balance, 200, 'no descuenta nuevamente los gastos pagados del saldo')
assert.equal(healthy.level, 'success')
assert.equal(healthy.forecast, 30 / 14 * 6)
assert.equal(buildAccountHealth([account('usd', 10)], snapshot, now)[0].level, 'critical')
assert.equal(buildAccountHealth([account('usd', 20)], snapshot, now)[0].level, 'warning')
assert.equal(buildAccountHealth([account('no-data', 200)], snapshot, now)[0].level, 'warning', 'no recomienda gustos sin historial suficiente')
snapshot.transactions = [...expenses, { id: 'pending', type: 'expense', incomeSourceId: 'usd', amount: 12, date: '2026-10-29', description: 'services::pending::0::Internet' }]
const pending = buildAccountHealth([account('usd', 188)], snapshot, now)[0]
assert.equal(pending.balance, 188)
assert.equal(pending.forecast, Math.max(0, healthy.forecast - 12), 'la reserva de gasto no se descuenta dos veces')
snapshot.subscriptions = [{ id: 'internet', name: 'Internet', incomeSourceId: 'usd', amount: 12, billingDay: 29, status: 'active', startedAt: '2026-10-01' }]
assert.equal(buildAccountHealth([account('usd', 188)], snapshot, now)[0].commitments, 0, 'un servicio ya planificado no se duplica')
snapshot.subscriptions.push({ id: 'other', name: 'Luz', incomeSourceId: 'usd', amount: 25, billingDay: 28, status: 'active', startedAt: '2026-10-01' })
snapshot.debts = [{ id: 'debt', incomeSourceId: 'usd', amount: 300, history: 'Deuda', startDate: '2026-09-01', endDate: '2026-10-29', paidAmount: 150, remainingAmount: 150, progress: 50, isSettled: false }, { id: 'receivable', incomeSourceId: 'usd', direction: 'receivable', amount: 500, history: 'Me deben', startDate: '2026-09-01', endDate: '2026-10-29', paidAmount: 0, remainingAmount: 500, progress: 0, isSettled: false }]
const owing = buildAccountHealth([account('usd', 100)], snapshot, now)[0]
assert.equal(owing.commitments, 175, 'se reserva lo que falta de deuda, sin contar dinero que otros deben')
assert.equal(owing.level, 'critical')
const cup = buildAccountHealth([account('usd', 100), account('cup', 500, 'CUP')], snapshot, now)[1]
assert.equal(cup.commitments, 0)
assert.equal(cup.forecast, 0, 'no mezcla los gastos de USD con CUP')
assert.equal(cup.currencyCode, 'CUP')
const formatter = (amount: number, code: string) => `${amount.toFixed(2)} ${code}`
assert.ok(accountHealthMessage(healthy, formatter).body.includes('USD'))
assert.ok(accountHealthMessage(owing, formatter).title.startsWith('Ojo'))
assert.equal(buildAccountHealth([{ ...account('savings', 200), source: { ...account('savings', 200).source, name: 'Ahorro USD' } }], snapshot, now).length, 0)
console.log('PASS: semana final, años bisiestos, cuentas y monedas, doble descuento, compromisos, falta de datos y mensajes.')
