import { createEmptyBootstrapPayload, type BootstrapPayload } from './contracts.js'

export const SYNC_PROTOCOL = 2
export const syncCollections = ['salaries', 'transactions', 'debts', 'wishlist', 'monthlyPlanningHistory', 'events', 'projections', 'savingsGoals', 'reminders', 'subscriptions'] as const
export type SyncCollection = typeof syncCollections[number]
export type SyncValue = BootstrapPayload[SyncCollection][number]
export interface SyncOperation {
  id: string
  collection: SyncCollection
  entityId: string
  baseVersion: string | null
  value: SyncValue | null
}
export interface SyncConflict {
  operationId: string
  key: string
  remote: SyncValue | null
  version: string | null
}
export interface SyncResponse {
  protocol: typeof SYNC_PROTOCOL
  snapshot: BootstrapPayload
  versions: Record<string, string>
  acknowledged: string[]
  conflict?: SyncConflict
}
export interface SyncDocument {
  format: 2
  initialized: boolean
  snapshot: BootstrapPayload
  base: BootstrapPayload
  versions: Record<string, string>
  operations: SyncOperation[]
  conflicts: SyncConflict[]
  legacyBackup?: BootstrapPayload
  resolutions: Array<{ at: string; local: SyncValue | null; remote: SyncValue | null; choice: 'local' | 'remote' }>
  lastSyncedAt?: string
}
export const syncKey = (collection: SyncCollection, id: string) => `${collection}/${id}`
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
export function getSyncValue(snapshot: BootstrapPayload, collection: SyncCollection, id: string): SyncValue | null {
  return snapshot[collection].find((entry) => entry.id === id) ?? null
}
export function applyOperation(snapshot: BootstrapPayload, operation: SyncOperation): BootstrapPayload {
  return { ...snapshot, [operation.collection]: [...snapshot[operation.collection].filter((entry) => entry.id !== operation.entityId), ...(operation.value ? [operation.value] : [])] }
}
export function createSyncDocument(legacy?: BootstrapPayload): SyncDocument {
  return { format: 2, initialized: false, snapshot: legacy ?? createEmptyBootstrapPayload(), base: createEmptyBootstrapPayload(), versions: {}, operations: [], conflicts: [], resolutions: [], ...(legacy ? { legacyBackup: legacy } : {}) }
}
export function queueSnapshot(document: SyncDocument, next: BootstrapPayload, makeId: () => string): SyncDocument {
  if (!document.initialized) return { ...document, snapshot: next }
  const operations = [...document.operations]
  for (const collection of syncCollections) {
    const ids = new Set([...document.snapshot[collection], ...next[collection]].map((entry) => entry.id))
    for (const entityId of ids) {
      const value = getSyncValue(next, collection, entityId)
      if (canonicalJson(value) === canonicalJson(getSyncValue(document.snapshot, collection, entityId))) continue
      const previous = operations.findLast((op) => op.collection === collection && op.entityId === entityId)
      operations.push({ id: makeId(), collection, entityId, value, baseVersion: previous ? `op:${previous.id}` : document.versions[syncKey(collection, entityId)] ?? null })
    }
  }
  return { ...document, snapshot: next, operations }
}
export function acceptSyncResponse(document: SyncDocument, response: SyncResponse, makeId: () => string): SyncDocument {
  let operations = document.operations
  if (!document.initialized) {
    // No trustworthy baseline exists for old snapshots. Every difference is
    // reviewed, including possible deletions; never infer that a missing row
    // means it should be removed from the server.
    const initial = { ...document, initialized: true, snapshot: response.snapshot, versions: response.versions, operations: [] }
    // Union of both sides. A row missing from the local snapshot is treated as
    // one this device never saw, never as a deletion: an old copy must not be
    // able to erase rows another device added while it was behind.
    const merged = {
      ...response.snapshot,
      ...Object.fromEntries(syncCollections.map((collection) => [collection, [
        ...response.snapshot[collection],
        ...document.snapshot[collection].filter((entry) => !response.snapshot[collection].some((remote) => remote.id === entry.id)),
      ]])),
    }
    operations = queueSnapshot(initial, merged, makeId).operations
  }
  operations = operations.filter((op) => !response.acknowledged.includes(op.id))
  const conflicts = document.conflicts.filter((conflict) => operations.some((op) => op.id === conflict.operationId))
  if (response.conflict) {
    const index = conflicts.findIndex((entry) => entry.key === response.conflict!.key)
    if (index >= 0) conflicts.splice(index, 1)
    conflicts.push(response.conflict)
  }
  return { ...document, initialized: true, base: response.snapshot, versions: response.versions, operations, conflicts, snapshot: operations.reduce(applyOperation, response.snapshot), lastSyncedAt: operations.length ? document.lastSyncedAt : new Date().toISOString() }
}
export function resolveSyncConflict(document: SyncDocument, key: string, choice: 'local' | 'remote', makeId: () => string): SyncDocument {
  const conflict = document.conflicts.find((entry) => entry.key === key)
  const first = document.operations.find((op) => syncKey(op.collection, op.entityId) === key)
  if (!conflict || !first) return document
  const local = getSyncValue(document.snapshot, first.collection, first.entityId)
  const operations = document.operations.filter((op) => syncKey(op.collection, op.entityId) !== key)
  if (choice === 'local') operations.push({ ...first, id: makeId(), value: local, baseVersion: conflict.version })
  return { ...document, operations, conflicts: document.conflicts.filter((entry) => entry.key !== key), snapshot: operations.reduce(applyOperation, document.base), resolutions: [...document.resolutions, { at: new Date().toISOString(), local, remote: conflict.remote, choice }] }
}
