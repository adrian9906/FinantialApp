import type { AuthUser, BootstrapPayload } from '@plata/shared'
import { createEmptyBootstrapPayload, normalizeBootstrapPayload } from '@plata/shared'

const AUTH_USER_KEY = 'plata-auth-user'
const BOOTSTRAP_KEY_PREFIX = 'plata-bootstrap'
const DIRTY_KEY_PREFIX = 'plata-bootstrap-dirty'

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

export function readCachedBootstrap(userId: string) {
  const payload = readJson<BootstrapPayload>(getBootstrapKey(userId))
  return normalizeBootstrapPayload(payload ?? createEmptyBootstrapPayload())
}

export function persistCachedBootstrap(userId: string, payload: BootstrapPayload) {
  writeJson(getBootstrapKey(userId), normalizeBootstrapPayload(payload))
}

export function clearCachedBootstrap(userId: string) {
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
