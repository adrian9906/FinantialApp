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

  await syncNow('test-user', 'startup')
  assert.equal(getSyncProgress().visible, true, 'el arranque conectado muestra el indicador compacto')
  await syncNow('test-user')
  assert.equal(getSyncProgress().visible, false, 'la sincronización rutinaria permanece silenciosa')

  // A remote download and a local edit can overlap. Both rows must survive.
  const beforeOverlap = (await readSyncDocument('test-user')).snapshot
  const localSalary = { id: 'local-salary', amount: 10, balance: 10, month: '2026-09', currencyCode: 'USD' }
  const remoteSalary = { id: 'remote-salary', amount: 20, balance: 20, month: '2026-09', currencyCode: 'USD' }
  let releaseDownload!: () => void
  let downloadStarted!: () => void
  const downloadGate = new Promise<void>((resolve) => { releaseDownload = resolve })
  const downloading = new Promise<void>((resolve) => { downloadStarted = resolve })
  let remoteSnapshot = { ...beforeOverlap, salaries: [remoteSalary] }
  globalThis.fetch = async (_url, init) => {
    if (!init?.method) {
      downloadStarted()
      await downloadGate
      return new Response(JSON.stringify({ protocol: SYNC_PROTOCOL, snapshot: remoteSnapshot, versions: { 'salaries/remote-salary': 'remote-v1' }, acknowledged: [] }))
    }
    const operation = JSON.parse(String(init.body)).operation
    const latest = await readSyncDocument('test-user')
    remoteSnapshot = latest.snapshot
    return new Response(JSON.stringify({ protocol: SYNC_PROTOCOL, snapshot: latest.snapshot, versions: { 'salaries/remote-salary': 'remote-v1', 'salaries/local-salary': 'local-v1' }, acknowledged: [operation.id] }))
  }
  const overlapSync = syncNow('test-user')
  await downloading
  await queueLocalChange('test-user', { ...beforeOverlap, salaries: [localSalary] }, beforeOverlap)
  releaseDownload()
  await overlapSync
  assert.deepEqual((await readSyncDocument('test-user')).snapshot.salaries.map((entry) => entry.id).sort(), ['local-salary', 'remote-salary'])
  const changedRemote = { ...remoteSalary, balance: 30 }
  await writeSyncDocument('conflict-user', { ...createSyncDocument(), initialized: true, snapshot: { ...empty, salaries: [changedRemote] }, base: { ...empty, salaries: [changedRemote] }, versions: { 'salaries/remote-salary': 'remote-v2' } })
  const beforeRemoteEdit = { ...empty, salaries: [remoteSalary] }
  const competingEdit = await queueLocalChange('conflict-user', { ...empty, salaries: [{ ...remoteSalary, balance: 25 }] }, beforeRemoteEdit)
  assert.equal(competingEdit.operations[0].baseVersion, null, 'una edición remota del mismo ingreso debe producir conflicto revisable')

  const cupExpense = { ...expense, id: 'cup-expense', incomeSourceId: 'cup-source', incomeSourceName: 'Transferencia' }
  const orphanedSnapshot = { ...empty, transactions: [cupExpense] }
  await writeSyncDocument('recovery-user', { ...createSyncDocument(), initialized: true, snapshot: orphanedSnapshot, base: empty })
  let recoveredUploads = 0
  globalThis.fetch = async (_url, init) => {
    const operation = init?.method === 'POST' ? JSON.parse(String(init.body)).operation : null
    if (operation) recoveredUploads++
    return new Response(JSON.stringify({ protocol: SYNC_PROTOCOL, snapshot: orphanedSnapshot, versions: { 'transactions/cup-expense': 'cup-v1' }, acknowledged: operation ? [operation.id] : [] }))
  }
  await syncNow('recovery-user')
  assert.equal(recoveredUploads, 1, 'un gasto CUP sin marcador pendiente se vuelve a encolar')
  assert.deepEqual((await readSyncDocument('recovery-user')).snapshot.transactions, [cupExpense])

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
