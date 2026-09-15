import assert from 'node:assert/strict'
import { createEmptyBootstrapPayload, createSyncDocument, SYNC_PROTOCOL } from '@plata/shared'
import { ApiRequestError } from './api.ts'
import { getSyncProgress, queueLocalChange, syncNow } from './sync-engine.ts'
import { readSyncDocument, writeSyncDocument } from './sync-store.ts'

// Minimal in-memory IndexedDB surface: exercises the real queue/engine while
// keeping the test independent of the user's browser and financial records.
const records = new Map<string, unknown>()
const database = {
  objectStoreNames: { contains: () => true }, close() {},
  transaction(store: string) {
    const transaction: any = { objectStore: () => ({
      get(key: string) {
        const request: any = {}
        queueMicrotask(() => { request.result = structuredClone(records.get(`${store}/${key}`)); request.onsuccess?.(); transaction.oncomplete?.() })
        return request
      },
      put(value: unknown, key: string) {
        records.set(`${store}/${key}`, structuredClone(value))
        queueMicrotask(() => transaction.oncomplete?.())
      },
    }) }
    return transaction
  },
}
const originalWindow = globalThis.window
const originalFetch = globalThis.fetch
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
const unhandled: unknown[] = []
const onUnhandled = (error: unknown) => unhandled.push(error)
process.on('unhandledRejection', onUnhandled)
globalThis.window = {
  indexedDB: { open: () => { const request: any = {}; queueMicrotask(() => { request.result = database; request.onsuccess?.() }); return request } },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, setTimeout, clearTimeout,
} as unknown as Window & typeof globalThis
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })

try {
  const empty = createEmptyBootstrapPayload()
  await writeSyncDocument('test-user', { ...createSyncDocument(), initialized: true })
  const expense = { id: 'expense-1', type: 'expense' as const, amount: 5, date: '2026-09-15', description: 'food::pending::0::Pan', incomeSourceId: 'source-1', incomeSourceName: 'Cuenta', isCash: false }
  const snapshot = { ...empty, transactions: [expense] }
  await queueLocalChange('test-user', snapshot)
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return new Response(JSON.stringify({ error: 'Cambio inválido. Revisa: amount. Los datos locales se conservan.' }), { status: 400 })
  }
  const first = syncNow('test-user')
  assert.equal(syncNow('test-user'), first)
  await assert.rejects(first, (error: unknown) => error instanceof ApiRequestError && error.status === 400)
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(calls, 1, 'un 400 no debe provocar otro reintento inmediato')
  const pending = await readSyncDocument('test-user')
  assert.equal(pending.operations.length, 1)
  assert.deepEqual(pending.snapshot.transactions, [expense], 'un 400 conserva el gasto y su cuenta')
  assert.ok(getSyncProgress().message.includes('amount'))

  globalThis.fetch = async (_url, init) => new Response(JSON.stringify({
    protocol: SYNC_PROTOCOL, snapshot, versions: { 'transactions/expense-1': 'version-1' },
    acknowledged: init?.method === 'POST' ? [JSON.parse(String(init.body)).operation.id] : [],
  }))
  await syncNow('test-user')
  assert.equal((await readSyncDocument('test-user')).operations.length, 0)

  calls = 0
  globalThis.fetch = async () => {
    calls++
    return calls === 1
      ? new Response(JSON.stringify({ protocol: SYNC_PROTOCOL, snapshot, versions: {}, acknowledged: [] }))
      : new Response(JSON.stringify({ error: 'Error en reintento' }), { status: 400 })
  }
  const successful = syncNow('test-user')
  syncNow('test-user')
  await successful
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(calls, 2)
  assert.equal(getSyncProgress().stage, 'failed')
  assert.deepEqual(unhandled, [], 'el fallo del reintento de fondo debe quedar gestionado')
  const { useAuthStore } = await import('../store/authStore.ts')
  const { useFinanceStore } = await import('../store/financeStore.ts')
  let logouts = 0
  useAuthStore.setState({ authMode: 'authenticated', user: { id: 'test-user', name: 'Test', email: 'test@example.com' }, logout: async () => { logouts++ } })
  await queueLocalChange('test-user', snapshot)
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Cambio inválido' }), { status: 400 })
  await useFinanceStore.getState().hydrate()
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(logouts, 0, 'un fallo de sincronización al abrir Plata no debe cerrar sesión')
  assert.equal(useFinanceStore.getState().hasLoaded, true)
  assert.equal(useFinanceStore.getState().loadedKey, 'user:test-user')
  assert.deepEqual(useFinanceStore.getState().transactions, [expense])
  assert.ok((await readSyncDocument('test-user')).operations.length > 0)
  console.log('Sync engine: conserva gastos ante 400, no reintenta de inmediato, recupera cola y gestiona rechazos de fondo')
} finally {
  globalThis.window = originalWindow
  globalThis.fetch = originalFetch
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  else Reflect.deleteProperty(globalThis, 'navigator')
  process.removeListener('unhandledRejection', onUnhandled)
}
