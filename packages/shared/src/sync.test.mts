// Offline sync scenarios. Runs the real client logic in packages/shared/src/sync.ts
import { strict as assert } from 'node:assert'
import { createHash } from 'node:crypto'

import {
  createSyncDocument, queueSnapshot, acceptSyncResponse, resolveSyncConflict,
  canonicalJson, syncKey, syncCollections, SYNC_PROTOCOL,
} from './sync.ts'

const empty = () => Object.fromEntries(syncCollections.map((c) => [c, []]))
const digest = (v) => createHash('sha256').update(canonicalJson(v)).digest('hex')

let n = 0
const makeId = () => `op-${++n}`

// ---- Fake server implementing the same rules as exchangeSync ----
function createServer() {
  const rows = new Map()
  const revisions = new Map()
  const receipts = new Map()
  let rev = 0

  function envelope() {
    const snapshot = empty()
    const versions = {}
    for (const [key, revision] of revisions) versions[key] = `${revision}:deleted`
    for (const [key, value] of rows) {
      const [collection] = key.split('/')
      snapshot[collection].push(value)
      versions[key] = `${revisions.get(key) ?? 'initial'}:${digest(value)}`
    }
    return { protocol: SYNC_PROTOCOL, snapshot, versions, acknowledged: [] }
  }

  return {
    envelope,
    exchange(operation) {
      const current = envelope()
      if (!operation) return current

      const key = syncKey(operation.collection, operation.entityId)
      const receipt = receipts.get(operation.id)
      if (receipt) {
        assert.equal(receipt.digest, digest(operation), 'reused op id with different data')
        return { ...current, acknowledged: [operation.id] }
      }

      let baseVersion = operation.baseVersion
      if (baseVersion?.startsWith('op:')) {
        const prev = receipts.get(baseVersion.slice(3))
        baseVersion = prev?.key === key ? prev.version : baseVersion
      }

      const version = current.versions[key] ?? null
      if (baseVersion !== version) {
        return { ...current, conflict: { operationId: operation.id, key, remote: rows.get(key) ?? null, version } }
      }

      if (operation.value) rows.set(key, operation.value)
      else rows.delete(key)
      revisions.set(key, `r${++rev}`)

      const result = envelope()
      receipts.set(operation.id, { key, version: result.versions[key], digest: digest(operation) })
      return { ...result, acknowledged: [operation.id] }
    },
  }
}

// Drains a device's queue against a server, like sync-engine's runSync.
function drain(device, server) {
  let doc = device
  let guard = 200
  const blocked = new Set(doc.conflicts.map((c) => c.key))
  while (guard-- > 0) {
    const next = doc.operations.find((op) => !blocked.has(syncKey(op.collection, op.entityId)))
    const allBlocked = doc.operations.length > 0 && doc.operations.every((op) => blocked.has(syncKey(op.collection, op.entityId)))
    if (allBlocked) break
    const response = server.exchange(next)
    doc = acceptSyncResponse(doc, response, makeId)
    if (response.conflict) { blocked.add(response.conflict.key); continue }
    if (!next && doc.operations.length === 0) break
  }
  return doc
}

const tx = (id, amount, desc) => ({ id, amount, type: 'expense', description: desc, date: '2026-09-01' })

// === Test 1: the headline scenario ===
{
  const server = createServer()
  let mobile = drain(createSyncDocument(), server)
  let web = drain(createSyncDocument(), server)

  mobile = queueSnapshot(mobile, { ...mobile.snapshot, transactions: [tx('m1', 100, 'gasto movil')] }, makeId)
  web = queueSnapshot(web, { ...web.snapshot, transactions: [{ id: 'w1', amount: 500, type: 'saving', date: '2026-09-02' }] }, makeId)

  mobile = drain(mobile, server)
  web = drain(web, server)
  mobile = drain(mobile, server)

  const ids = (d) => d.snapshot.transactions.map((t) => t.id).sort()
  assert.deepEqual(ids(mobile), ['m1', 'w1'], 'mobile should hold both')
  assert.deepEqual(ids(web), ['m1', 'w1'], 'web should hold both')
  assert.equal(mobile.operations.length, 0)
  console.log('PASS 1: offline expense + web income converge on both devices')
}

// === Test 2: a stale device must not delete newer server rows ===
{
  const server2 = createServer()
  let a = drain(createSyncDocument(), server2)
  let b = drain(createSyncDocument(), server2)
  a = drain(queueSnapshot(a, { ...a.snapshot, transactions: [tx('new', 900, 'reciente')] }, makeId), server2)
  b = queueSnapshot(b, { ...b.snapshot, transactions: [tx('old', 10, 'viejo')] }, makeId)
  b = drain(b, server2)

  const finalIds = server2.envelope().snapshot.transactions.map((t) => t.id).sort()
  assert.deepEqual(finalIds, ['new', 'old'], 'stale device must not erase newer rows')
  console.log('PASS 2: stale device adds without deleting newer server data')
}

// === Test 3: retry after a lost response does not duplicate ===
{
  const server = createServer()
  let d = drain(createSyncDocument(), server)
  d = queueSnapshot(d, { ...d.snapshot, transactions: [tx('r1', 42, 'reintento')] }, makeId)

  const op = d.operations[0]
  server.exchange(op)
  const again = server.exchange(op)
  assert.deepEqual(again.acknowledged, [op.id])
  assert.equal(again.snapshot.transactions.length, 1, 'retry must not duplicate')
  d = acceptSyncResponse(d, again, makeId)
  assert.equal(d.operations.length, 0)
  console.log('PASS 3: retry with same operation id is idempotent')
}

// === Test 4: incompatible edits on the same record produce a conflict ===
{
  const server = createServer()
  let a = drain(createSyncDocument(), server)
  a = drain(queueSnapshot(a, { ...a.snapshot, transactions: [tx('shared', 100, 'base')] }, makeId), server)
  let b = drain(createSyncDocument(), server)

  a = drain(queueSnapshot(a, { ...a.snapshot, transactions: [tx('shared', 111, 'desde A')] }, makeId), server)
  b = queueSnapshot(b, { ...b.snapshot, transactions: [tx('shared', 222, 'desde B')] }, makeId)
  b = drain(b, server)

  assert.equal(b.conflicts.length, 1, 'B should see a conflict')
  assert.equal(b.conflicts[0].remote.amount, 111, 'remote version preserved for review')
  assert.equal(b.snapshot.transactions.find((t) => t.id === 'shared').amount, 222, 'local version preserved too')
  console.log('PASS 4: incompatible edits keep both versions and ask')

  let resolved = resolveSyncConflict(b, 'transactions/shared', 'local', makeId)
  resolved = drain(resolved, server)
  assert.equal(resolved.conflicts.length, 0)
  assert.equal(server.envelope().snapshot.transactions.find((t) => t.id === 'shared').amount, 222)
  console.log('PASS 5: choosing "this device" uploads the local version')

  const other = resolveSyncConflict(b, 'transactions/shared', 'remote', makeId)
  assert.equal(other.conflicts.length, 0)
  assert.equal(other.snapshot.transactions.find((t) => t.id === 'shared').amount, 111)
  console.log('PASS 6: choosing "server" restores the remote version')
}

// === Test 5: deletions propagate ===
{
  const server = createServer()
  let a = drain(createSyncDocument(), server)
  a = drain(queueSnapshot(a, { ...a.snapshot, transactions: [tx('del', 5, 'a borrar')] }, makeId), server)
  let b = drain(createSyncDocument(), server)
  assert.equal(b.snapshot.transactions.length, 1)

  a = drain(queueSnapshot(a, { ...a.snapshot, transactions: [] }, makeId), server)
  b = drain(b, server)
  assert.equal(b.snapshot.transactions.length, 0, 'deletion must reach the other device')
  console.log('PASS 7: deletions are recorded and propagate')
}

// === Test 6: legacy upgrade keeps local rows the server never saw ===
{
  const server = createServer()
  let other = drain(createSyncDocument(), server)
  other = drain(queueSnapshot(other, { ...other.snapshot, transactions: [tx('server-side', 77, 'ya en servidor')] }, makeId), server)

  const legacy = { ...empty(), transactions: [tx('only-local', 33, 'solo en el telefono')] }
  let upgraded = createSyncDocument(legacy)
  assert.ok(upgraded.legacyBackup, 'legacy payload is backed up before anything else')
  upgraded = drain(upgraded, server)

  const ids = upgraded.snapshot.transactions.map((t) => t.id).sort()
  assert.deepEqual(ids, ['only-local', 'server-side'], 'legacy rows merge instead of overwriting')
  assert.deepEqual(server.envelope().snapshot.transactions.map((t) => t.id).sort(), ['only-local', 'server-side'])
  console.log('PASS 8: legacy device upgrade merges, keeping a backup')
}

// === Test 7: a failed upload keeps the queue intact ===
{
  const server = createServer()
  let d = drain(createSyncDocument(), server)
  d = queueSnapshot(d, { ...d.snapshot, transactions: [tx('pend', 8, 'pendiente')] }, makeId)
  const before = d.operations.length

  try {
    drain(d, { exchange() { throw new Error('network down') } })
  } catch { /* expected */ }

  assert.equal(d.operations.length, before, 'queue survives a failed upload')
  assert.equal(d.snapshot.transactions.length, 1, 'local data still on screen')
  console.log('PASS 9: failed sync preserves pending changes')
}

// === Test 10: an unresolved conflict must not stall unrelated changes ===
{
  const server = createServer()
  let a = drain(createSyncDocument(), server)
  a = drain(queueSnapshot(a, { ...a.snapshot, transactions: [tx('contested', 100, 'base')] }, makeId), server)
  let b = drain(createSyncDocument(), server)

  a = drain(queueSnapshot(a, { ...a.snapshot, transactions: [tx('contested', 111, 'desde A')] }, makeId), server)
  b = queueSnapshot(b, { ...b.snapshot, transactions: [tx('contested', 222, 'desde B'), tx('unrelated', 9, 'sin conflicto')] }, makeId)
  b = drain(b, server)

  assert.equal(b.conflicts.length, 1, 'only the contested row conflicts')
  const serverIds = server.envelope().snapshot.transactions.map((t) => t.id).sort()
  assert.ok(serverIds.includes('unrelated'), 'unrelated change must sync despite the open conflict')
  console.log('PASS 10: an open conflict does not block unrelated changes')
}

console.log('\nAll sync scenarios passed.')
