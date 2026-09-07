import type { BootstrapPayload } from '@plata/shared'
import { createEmptyBootstrapPayload, createSyncDocument, normalizeBootstrapPayload, type SyncDocument } from '@plata/shared'

const OFFLINE_DB_NAME = 'plata-offline'
const OFFLINE_DB_VERSION = 2
const BOOTSTRAP_STORE = 'bootstrap-snapshots'
const SYNC_STORE = 'sync-documents'
const LEGACY_BOOTSTRAP_PREFIX = 'plata-bootstrap'
const LEGACY_DIRTY_PREFIX = 'plata-bootstrap-dirty'

function getIndexedDb() {
  if (typeof window === 'undefined') return null
  return window.indexedDB ?? null
}

function openDb(): Promise<IDBDatabase | null> {
  const indexedDb = getIndexedDb()
  if (!indexedDb) return Promise.resolve(null)

  return new Promise((resolve) => {
    const request = indexedDb.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BOOTSTRAP_STORE)) db.createObjectStore(BOOTSTRAP_STORE)
      if (!db.objectStoreNames.contains(SYNC_STORE)) db.createObjectStore(SYNC_STORE)
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

function readRecord<T>(storeName: string, key: string): Promise<T | null> {
  return openDb().then((db) => {
    if (!db || !db.objectStoreNames.contains(storeName)) {
      db?.close()
      return null
    }

    return new Promise<T | null>((resolve) => {
      let value: T | null = null
      const transaction = db.transaction(storeName, 'readonly')
      const request = transaction.objectStore(storeName).get(key)

      request.onsuccess = () => {
        value = (request.result as T | undefined) ?? null
      }
      transaction.oncomplete = () => {
        db.close()
        resolve(value)
      }
      transaction.onerror = () => {
        db.close()
        resolve(null)
      }
      transaction.onabort = () => {
        db.close()
        resolve(null)
      }
    })
  })
}

// Resolves only once the transaction commits, so callers can report "saved"
// truthfully instead of optimistically.
function writeRecord(storeName: string, key: string, value: unknown): Promise<boolean> {
  return openDb().then((db) => {
    if (!db || !db.objectStoreNames.contains(storeName)) {
      db?.close()
      return false
    }

    return new Promise<boolean>((resolve) => {
      const transaction = db.transaction(storeName, 'readwrite')
      transaction.objectStore(storeName).put(value, key)

      transaction.oncomplete = () => {
        db.close()
        resolve(true)
      }
      transaction.onerror = () => {
        db.close()
        resolve(false)
      }
      transaction.onabort = () => {
        db.close()
        resolve(false)
      }
    })
  })
}

function deleteRecord(storeName: string, key: string): Promise<boolean> {
  return openDb().then((db) => {
    if (!db || !db.objectStoreNames.contains(storeName)) {
      db?.close()
      return false
    }

    return new Promise<boolean>((resolve) => {
      const transaction = db.transaction(storeName, 'readwrite')
      transaction.objectStore(storeName).delete(key)

      transaction.oncomplete = () => {
        db.close()
        resolve(true)
      }
      transaction.onerror = () => {
        db.close()
        resolve(false)
      }
      transaction.onabort = () => {
        db.close()
        resolve(false)
      }
    })
  })
}

function readLocalStorageJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function normalizeDocument(document: SyncDocument): SyncDocument {
  return {
    ...document,
    snapshot: normalizeBootstrapPayload(document.snapshot),
    base: normalizeBootstrapPayload(document.base),
    operations: Array.isArray(document.operations) ? document.operations : [],
    conflicts: Array.isArray(document.conflicts) ? document.conflicts : [],
    resolutions: Array.isArray(document.resolutions) ? document.resolutions : [],
    versions: document.versions ?? {},
  }
}

// A device upgrading from the snapshot-replace protocol has local rows but no
// per-record versions. The legacy payload is kept verbatim as `legacyBackup` so
// the first exchange re-queues it as operations instead of trusting it wholesale.
async function migrateLegacyDocument(userId: string): Promise<SyncDocument> {
  const cached = await readRecord<BootstrapPayload>(BOOTSTRAP_STORE, userId)
  const legacyLocal = readLocalStorageJson<BootstrapPayload>(`${LEGACY_BOOTSTRAP_PREFIX}:${userId}`)
  const payload = cached ?? legacyLocal

  if (!payload) return createSyncDocument()

  const normalized = normalizeBootstrapPayload(payload)
  const isEmpty = Object.values(normalized).every((entries) => entries.length === 0)

  return createSyncDocument(isEmpty ? undefined : normalized)
}

export async function readSyncDocument(userId: string): Promise<SyncDocument> {
  const stored = await readRecord<SyncDocument>(SYNC_STORE, userId)
  if (stored && stored.format === 2) return normalizeDocument(stored)

  const migrated = await migrateLegacyDocument(userId)
  await writeSyncDocument(userId, migrated)
  return migrated
}

export function writeSyncDocument(userId: string, document: SyncDocument): Promise<boolean> {
  return writeRecord(SYNC_STORE, userId, document)
}

export async function clearSyncDocument(userId: string) {
  await deleteRecord(SYNC_STORE, userId)
  await deleteRecord(BOOTSTRAP_STORE, userId)
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(`${LEGACY_BOOTSTRAP_PREFIX}:${userId}`)
  window.localStorage.removeItem(`${LEGACY_DIRTY_PREFIX}:${userId}`)
}

export function readCachedSnapshot(userId: string): Promise<BootstrapPayload> {
  return readSyncDocument(userId)
    .then((document) => document.snapshot)
    .catch(() => createEmptyBootstrapPayload())
}
