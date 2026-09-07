import type { BootstrapPayload, SyncDocument, SyncResponse } from '@plata/shared'
import { SYNC_PROTOCOL, acceptSyncResponse, queueSnapshot, resolveSyncConflict } from '@plata/shared'
import type { SyncOperation } from '@plata/shared'

import { isNetworkRequestError, requestJson } from '@/lib/api'
import { readSyncDocument, writeSyncDocument } from '@/lib/sync-store'

export type SyncStage = 'idle' | 'preparing' | 'uploading' | 'downloading' | 'done' | 'conflict' | 'failed'

export interface SyncProgress {
  /** Increments once per sync run, so the UI can tell a new run from a repeat. */
  runId: number
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
async function runSync(userId: string): Promise<SyncDocument | null> {
  let document = await readSyncDocument(userId)
  const total = document.operations.length

  runCounter += 1

  emit({
    runId: runCounter,
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
      document = acceptSyncResponse(document, response, makeId)
      await writeSyncDocument(userId, document)

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
      message: isNetworkRequestError(error)
        ? 'Se interrumpió la sincronización. Tus cambios pendientes siguen guardados.'
        : 'No se pudo sincronizar. Tus cambios pendientes siguen guardados.',
    })
    throw error
  }
}

export function syncNow(userId: string): Promise<SyncDocument | null> {
  if (inFlight) {
    rerunRequested = true
    return inFlight
  }

  inFlight = runSync(userId).finally(() => {
    inFlight = null
  })

  const started = inFlight

  void started
    .catch(() => null)
    .then((result) => {
      if (!rerunRequested) return result
      rerunRequested = false
      return syncNow(userId)
    })

  return started
}

export async function queueLocalChange(
  userId: string,
  next: BootstrapPayload,
): Promise<SyncDocument> {
  const document = await readSyncDocument(userId)
  const updated = queueSnapshot(document, next, makeId)
  await writeSyncDocument(userId, updated)

  emit({
    pending: updated.operations.length,
    conflicts: updated.conflicts.length,
  })

  return updated
}

export async function resolveConflict(
  userId: string,
  key: string,
  choice: 'local' | 'remote',
): Promise<SyncDocument> {
  const document = await readSyncDocument(userId)
  const updated = resolveSyncConflict(document, key, choice, makeId)
  await writeSyncDocument(userId, updated)

  emit({
    pending: updated.operations.length,
    conflicts: updated.conflicts.length,
  })

  return updated
}

export function resetSyncProgress() {
  emit({ stage: 'idle', total: 0, completed: 0, message: '' })
}
