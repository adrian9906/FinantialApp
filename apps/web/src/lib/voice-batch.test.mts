import { strict as assert } from 'node:assert'
import { createEmptyBootstrapPayload, type Transaction } from '@plata/shared'
import { prepareVoiceBatch, persistPreparedVoiceBatch } from './voice-batch.ts'

const snapshot = createEmptyBootstrapPayload()
snapshot.incomeSources = [{ id: 'a', name: 'Salario', recurring: true, currencyCode: 'USD' }]
snapshot.salaries = [{ id: 'salary', amount: 100, balance: 100, sourceId: 'a', month: '2026-09' }]
const formula = () => ({ expenses: 50, wants: 30, savings: 20 })
const expense: Transaction = { id: 'voice-first', amount: 20, type: 'expense', incomeSourceId: 'a', description: 'food::pending::0::Pan', date: '2026-09-15' }
const want: Transaction = { id: 'voice-second', amount: 10, type: 'want', incomeSourceId: 'a', description: 'outings::pending::Cine', date: '2026-09-15' }
const prepared = prepareVoiceBatch(snapshot, [expense, want], formula)
assert.equal(prepared.created.length, 2)
assert.equal(prepared.salaries[0].balance, 70)
assert.equal(snapshot.salaries[0].balance, 100)
assert.equal(snapshot.transactions.length, 0)
assert.throws(() => prepareVoiceBatch(snapshot, [expense, { ...expense, id: 'voice-third', amount: 40 }], formula), /presupuesto/)
assert.throws(() => prepareVoiceBatch(snapshot, [{ ...want, amount: 31 }], formula), /presupuesto/)
assert.throws(() => prepareVoiceBatch(snapshot, [{ ...expense, amount: Number.NaN }], formula), /importe/)
assert.throws(() => prepareVoiceBatch(snapshot, [{ ...expense, incomeSourceId: 'missing' }], formula), /cuenta/)
assert.throws(() => prepareVoiceBatch(snapshot, [{ ...expense, date: '2026-02-30' }], formula), /cuenta|fecha/)
assert.throws(() => prepareVoiceBatch(snapshot, [want], () => ({ expenses: 80, wants: 0, savings: 20 })), /desactivada/)
assert.equal(prepareVoiceBatch({ ...snapshot, ...prepared }, [expense, want], formula).created.length, 0)
assert.equal(prepareVoiceBatch(snapshot, [expense, expense], formula).created.length, 1)
assert.throws(() => prepareVoiceBatch({ ...snapshot, salaries: [{ ...snapshot.salaries[0], balance: 5 }] }, [expense], formula), /saldo/)
let committed = false
await assert.rejects(persistPreparedVoiceBatch(prepared, async () => { throw new Error('disk failed') }, () => { committed = true }, () => true), /disk failed/)
assert.equal(committed, false)
await assert.rejects(persistPreparedVoiceBatch(prepared, async () => {}, () => { committed = true }, () => false), /sesión/)
assert.equal(committed, false)
assert.equal((await persistPreparedVoiceBatch(prepared, async () => {}, () => { committed = true }, () => true)).length, 2)
assert.equal(committed, true)
console.log('Voice batch: cumulative budget, balance, atomic preparation, persistence failures, session changes and retries passed')
