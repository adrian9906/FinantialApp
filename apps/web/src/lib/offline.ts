import type { AuthUser, BootstrapPayload } from '@plata/shared'

import { clearSyncDocument, readCachedSnapshot, readSyncDocument, writeSyncDocument } from '@/lib/sync-store'

const AUTH_USER_KEY = 'plata-auth-user'

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

export function readCachedBootstrap(userId: string): Promise<BootstrapPayload> {
  return readCachedSnapshot(userId)
}

/**
 * Stores the snapshot without queueing operations. Use only for server-sourced
 * data; local edits must go through the finance store so they are queued.
 */
export async function persistCachedBootstrap(userId: string, payload: BootstrapPayload) {
  const document = await readSyncDocument(userId)
  await writeSyncDocument(userId, { ...document, snapshot: payload })
}

export function clearCachedBootstrap(userId: string) {
  return clearSyncDocument(userId)
}

/**
 * True while the device holds queued operations or unresolved conflicts. The
 * previous implementation compared a JSON-encoded `"1"` against `'1'` and so
 * never reported pending work, letting server data overwrite local edits.
 */
export async function hasPendingSync(userId: string) {
  const document = await readSyncDocument(userId)
  return document.operations.length > 0 || document.conflicts.length > 0
}
