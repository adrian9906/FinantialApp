import type { AuthUser, BootstrapPayload } from '@plata/shared'
import { createEmptyBootstrapPayload, normalizeBootstrapPayload } from '@plata/shared'

const AUTH_USER_KEY = 'plata-auth-user'
const BOOTSTRAP_KEY_PREFIX = 'plata-bootstrap'
const DIRTY_KEY_PREFIX = 'plata-bootstrap-dirty'
const OFFLINE_DB_NAME = 'plata-offline'
const OFFLINE_DB_VERSION = 1
const BOOTSTRAP_STORE = 'bootstrap-snapshots'

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(key)
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function removeKey(key: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(key)
}

function getBootstrapKey(userId: string) {
  return `${BOOTSTRAP_KEY_PREFIX}:${userId}`
}

function getDirtyKey(userId: string) {
  return `${DIRTY_KEY_PREFIX}:${userId}`
}

function getIndexedDb() {
  if (typeof window === 'undefined') return null
  return window.indexedDB ?? null
}

function openOfflineDb(): Promise<IDBDatabase | null> {
  const indexedDb = getIndexedDb()
  if (!indexedDb) return Promise.resolve(null)

  return new Promise((resolve) => {
    const request = indexedDb.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BOOTSTRAP_STORE)) {
        db.createObjectStore(BOOTSTRAP_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

function readFromStore<T>(operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openOfflineDb().then((db) => {
    if (!db) return null

    return new Promise<T | null>((resolve) => {
      const transaction = db.transaction(BOOTSTRAP_STORE, 'readonly')
      const store = transaction.objectStore(BOOTSTRAP_STORE)
      const request = operation(store)

      request.onsuccess = () => {
        const result = request.result ?? null
        transaction.oncomplete = () => {
          db.close()
          resolve(result)
        }
      }
      request.onerror = () => {
        db.close()
        resolve(null)
      }
      transaction.onabort = () => {
        db.close()
        resolve(null)
      }
      transaction.onerror = () => {
        db.close()
        resolve(null)
      }
    })
  })
}

function writeToStore(operation: (store: IDBObjectStore) => void): Promise<boolean> {
  return openOfflineDb().then((db) => {
    if (!db) return false

    return new Promise<boolean>((resolve) => {
      const transaction = db.transaction(BOOTSTRAP_STORE, 'readwrite')
      const store = transaction.objectStore(BOOTSTRAP_STORE)

      operation(store)

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

function readLegacyCachedBootstrap(userId: string) {
  return readJson<BootstrapPayload>(getBootstrapKey(userId))
}

export function isOnline() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export function readCachedAuthUser() {
  return readJson<AuthUser>(AUTH_USER_KEY)
}

export function persistCachedAuthUser(user: AuthUser) {
  writeJson(AUTH_USER_KEY, user)
}

export function clearCachedAuthUser() {
  removeKey(AUTH_USER_KEY)
}

export async function readCachedBootstrap(userId: string) {
  const stored = await readFromStore<BootstrapPayload>((store) => store.get(userId))
  if (stored) {
    return normalizeBootstrapPayload(stored)
  }

  const legacyPayload = readLegacyCachedBootstrap(userId)
  if (legacyPayload) {
    const normalized = normalizeBootstrapPayload(legacyPayload)
    void persistCachedBootstrap(userId, normalized)
    return normalized
  }

  return createEmptyBootstrapPayload()
}

export async function persistCachedBootstrap(userId: string, payload: BootstrapPayload) {
  const normalized = normalizeBootstrapPayload(payload)
  const stored = await writeToStore((store) => {
    store.put(normalized, userId)
  })

  if (!stored) {
    writeJson(getBootstrapKey(userId), normalized)
    return
  }

  removeKey(getBootstrapKey(userId))
}

export async function clearCachedBootstrap(userId: string) {
  await writeToStore((store) => {
    store.delete(userId)
  })
  removeKey(getBootstrapKey(userId))
  removeKey(getDirtyKey(userId))
}

export function hasPendingSync(userId: string) {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(getDirtyKey(userId)) === '1'
}

export function markPendingSync(userId: string, dirty: boolean) {
  if (dirty) {
    writeJson(getDirtyKey(userId), '1')
    return
  }

  removeKey(getDirtyKey(userId))
}
