import type { BootstrapPayload, SyncDocument, SyncResponse } from '@plata/shared'
import { SYNC_PROTOCOL, acceptSyncResponse, applyOperation, canonicalJson, getSyncValue, queueSnapshot, resolveSyncConflict, syncCollections, syncKey } from '@plata/shared'
import type { SyncOperation } from '@plata/shared'

import { ApiRequestError, isNetworkRequestError, requestJson } from '@/lib/api'
import { updateSyncDocument } from '@/lib/sync-store'

export type SyncStage = 'idle' | 'preparing' | 'uploading' | 'downloading' | 'done' | 'conflict' | 'failed'

export interface SyncProgress {
  /** Increments once per sync run, so the UI can tell a new run from a repeat. */
  runId: number
  /**
   * Whether this run should surface the progress dialog. Routine uploads while
   * online stay silent; only catching up after losing connection is worth
   * interrupting the user for.
   */
  visible: boolean
  stage: SyncStage
  total: number
  completed: number
  message: string
  pending: number
  conflicts: number
}

type ProgressListener = (progress: SyncProgress) => void

const listeners = new Set<ProgressListener>()

let runCounter = 0

let currentProgress: SyncProgress = {
  runId: 0,
  visible: false,
  stage: 'idle',
  total: 0,
  completed: 0,
  message: '',
  pending: 0,
  conflicts: 0,
}

export function getSyncProgress() {
  return currentProgress
}

export function subscribeToSyncProgress(listener: ProgressListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit(patch: Partial<SyncProgress>) {
  currentProgress = { ...currentProgress, ...patch }
  for (const listener of listeners) listener(currentProgress)
}

function makeId() {
  return crypto.randomUUID()
}

export function isUpgradeRequiredError(error: unknown) {
  return error instanceof Error && error.message.includes('Actualiza la app')
}

let inFlight: Promise<SyncDocument | null> | null = null
let rerunRequested = false
let rerunVisible = false

async function exchange(operation?: SyncOperation): Promise<SyncResponse> {
  if (!operation) {
    return requestJson<SyncResponse>('/sync')
  }

  return requestJson<SyncResponse>('/sync', {
    method: 'POST',
    body: JSON.stringify({ protocol: SYNC_PROTOCOL, operation }),
  })
}

/**
 * Drains the pending queue one operation at a time. Each operation carries its
 * own id, so a retry after a dropped response is acknowledged rather than
 * duplicated. Stops early on a conflict and leaves the remaining work queued.
 */
async function runSync(userId: string, visible: boolean): Promise<SyncDocument | null> {
  let document = await updateSyncDocument(userId, (current) => {
    if (!current.initialized) return current
    // Older builds could leave a locally saved snapshot without its pending
    // marker. Recreate only those missing per-record operations before a
    // download has a chance to replace the local copy.
    const projected = current.operations.reduce(applyOperation, current.base)
    return queueSnapshot({ ...current, snapshot: projected }, current.snapshot, makeId)
  })
  const total = document.operations.length

  runCounter += 1

  emit({
    runId: runCounter,
    visible,
    stage: 'preparing',
    total,
    completed: 0,
    pending: total,
    conflicts: document.conflicts.length,
    message: total > 0 ? 'Preparando tus cambios...' : 'Buscando cambios nuevos...',
  })

  // Conflicts block their own record only; everything else keeps flowing.
  const blockedKeys = new Set(document.conflicts.map((conflict) => conflict.key))
  let completed = 0
  let queued = total
  let guard = 200

  try {
    while (guard > 0) {
      guard -= 1

      // Skip operations whose record is waiting on the user's decision; the
      // rest of the queue keeps moving instead of stalling behind one conflict.
      const next = document.operations.find(
        (operation) => !blockedKeys.has(`${operation.collection}/${operation.entityId}`),
      )

      const blocked = document.operations.length - (next ? 1 : 0) > 0
        && document.operations.every((operation) => blockedKeys.has(`${operation.collection}/${operation.entityId}`))

      if (blocked) break

      emit({
        stage: next ? 'uploading' : 'downloading',
        completed,
        total: queued,
        pending: document.operations.length,
        message: next
          ? `${completed} de ${queued} cambios confirmados`
          : 'Descargando cambios del servidor...',
      })

      const response = await exchange(next)
      document = await updateSyncDocument(userId, (latest) => acceptSyncResponse(latest, response, makeId))

      if (response.conflict) {
        blockedKeys.add(response.conflict.key)
        emit({
          stage: 'conflict',
          completed,
          total: queued,
          pending: document.operations.length,
          conflicts: document.conflicts.length,
          message: 'Hay cambios en conflicto que necesitan tu decisión.',
        })
        continue
      }

      // A first exchange with an empty queue can itself produce operations
      // (a device upgrading from the old snapshot format merges here), so only
      // stop once there is genuinely nothing left to send.
      if (!next && document.operations.length === 0) break

      const remaining = document.operations.filter(
        (operation) => !blockedKeys.has(`${operation.collection}/${operation.entityId}`),
      ).length
      queued = Math.max(queued, completed + remaining)
      completed = queued - remaining
    }

    const pending = document.operations.length
    const conflicts = document.conflicts.length

    emit({
      stage: conflicts > 0 ? 'conflict' : 'done',
      completed: queued - pending,
      total: queued,
      pending,
      conflicts,
      message: conflicts > 0
        ? 'Hay cambios en conflicto que necesitan tu decisión.'
        : 'Sincronización completada',
    })

    return document
  } catch (error) {
    // The queue survives untouched: nothing is dropped on a failed upload.
    emit({
      stage: 'failed',
      completed,
      total: queued,
      pending: document.operations.length,
      conflicts: document.conflicts.length,
      message: error instanceof ApiRequestError && (error.status === 400 || error.status === 426)
        ? error.message
        : isNetworkRequestError(error)
        ? 'Se interrumpió la sincronización. Tus cambios pendientes siguen guardados.'
        : 'No se pudo sincronizar. Tus cambios pendientes siguen guardados.',
    })
    throw error
  }
}

/**
 * `reason` decides whether the user sees this run. Saving while online uploads
 * silently; reconnecting after being offline shows the progress dialog.
 */
export function syncNow(
  userId: string,
  reason: 'silent' | 'reconnect' = 'silent',
): Promise<SyncDocument | null> {
  if (inFlight) {
    rerunRequested = true
    // A visible request wins: if a reconnect lands while a silent upload is
    // running, the follow-up run still shows its progress.
    if (reason === 'reconnect') rerunVisible = true
    return inFlight
  }

  inFlight = runSync(userId, reason === 'reconnect').finally(() => {
    inFlight = null
  })

  const started = inFlight

  void started
    .catch(() => null)
    .then((result) => {
      if (!result) {
        rerunRequested = false
        rerunVisible = false
        return null
      }
      if (!rerunRequested) return result
      rerunRequested = false
      const nextReason = rerunVisible ? 'reconnect' : 'silent'
      rerunVisible = false
      return syncNow(userId, nextReason)
    }).catch(() => null)

  return started
}

export async function queueLocalChange(
  userId: string,
  next: BootstrapPayload,
  previous?: BootstrapPayload,
): Promise<SyncDocument> {
  const updated = await updateSyncDocument(userId, (document) => {
    if (!previous) return queueSnapshot(document, next, makeId)
    let merged = document.snapshot
    const diverged = new Set<string>()
    for (const collection of syncCollections) {
      const ids = new Set([...previous[collection], ...next[collection]].map((entry) => entry.id))
      for (const entityId of ids) {
        const before = getSyncValue(previous, collection, entityId)
        const after = getSyncValue(next, collection, entityId)
        if (canonicalJson(before) === canonicalJson(after)) continue
        if (canonicalJson(before) !== canonicalJson(getSyncValue(document.snapshot, collection, entityId))) {
          diverged.add(syncKey(collection, entityId))
        }
        merged = applyOperation(merged, { id: '', collection, entityId, baseVersion: null, value: after })
      }
    }
    const queued = queueSnapshot(document, merged, makeId)
    const existingIds = new Set(document.operations.map((operation) => operation.id))
    return { ...queued, operations: queued.operations.map((operation) =>
      !existingIds.has(operation.id) && diverged.has(syncKey(operation.collection, operation.entityId))
        ? { ...operation, baseVersion: null }
        : operation,
    ) }
  })

  emit({
    pending: updated.operations.length,
    conflicts: updated.conflicts.length,
  })

  return updated
}

export async function waitForCurrentSync() {
  if (inFlight) await inFlight.catch(() => null)
}

export async function resolveConflict(
  userId: string,
  key: string,
  choice: 'local' | 'remote',
): Promise<SyncDocument> {
  const updated = await updateSyncDocument(userId, (document) => resolveSyncConflict(document, key, choice, makeId))

  emit({
    pending: updated.operations.length,
    conflicts: updated.conflicts.length,
  })

  return updated
}

export function resetSyncProgress() {
  emit({ stage: 'idle', total: 0, completed: 0, message: '' })
}
