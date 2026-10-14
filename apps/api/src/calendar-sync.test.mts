import assert from 'node:assert/strict'
import { parseSyncOperation } from './sync-validation.js'
import { serializeEvent, writeSyncRecord } from './api.js'
import type { Prisma } from './generated/prisma/client.js'
import type { AppEvent } from '@plata/shared'

const event: AppEvent = { id: 'calendar', name: 'Internet', date: '2026-10-31', amount: 0, isNotification: false, category: 'service', recurrence: 'monthly', time: '09:30', notes: 'Contrato 123' }
const input = { id: 'op', collection: 'events', entityId: event.id, baseVersion: null, value: event }
const operation = parseSyncOperation(input)
assert.deepEqual(operation.value, event, 'la validación conserva los datos del calendario')
assert.throws(() => parseSyncOperation({ ...input, value: { ...event, time: '25:70' } }))
assert.throws(() => parseSyncOperation({ ...input, value: { ...event, recurrence: 'invalid' } }))
let stored: Parameters<typeof serializeEvent>[0] | undefined
const tx = { evento: { deleteMany: async () => {}, create: async ({ data }: { data: Parameters<typeof serializeEvent>[0] }) => { stored = data } } } as unknown as Prisma.TransactionClient
await writeSyncRecord('owner', operation, tx)
assert.ok(stored)
assert.deepEqual(serializeEvent(stored), event, 'los campos sobreviven escritura y lectura del servidor')
assert.equal(stored.fuenteIngresoId, null, 'el calendario no necesita una cuenta')
const legacy = { ...stored, category: null, recurrence: null, time: null, notes: null }
assert.equal(serializeEvent(legacy).category, undefined, 'los eventos financieros antiguos mantienen su formato')
console.log('PASS: calendario sincronizable, sin cuenta ni gasto; compatibilidad con eventos existentes.')
