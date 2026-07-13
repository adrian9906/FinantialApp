import { create } from 'zustand'
import type { AuthCredentials, AuthMode, AuthUser, RegisterPayload } from '@plata/shared'

import { isNetworkRequestError, requestJson } from '@/lib/api'
import { clearCachedAuthUser, clearCachedBootstrap, isOnline, persistCachedAuthUser, readCachedAuthUser } from '@/lib/offline'

const GUEST_AUTH_STORAGE_KEY = 'plata-auth-mode'
const SESSION_TOKEN_KEY = 'plata-session-token'

interface AuthStore {
  authMode: AuthMode
  user: AuthUser | null
  isChecking: boolean
  hasChecked: boolean
  checkSession: () => Promise<void>
  login: (payload: AuthCredentials) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  continueAsGuest: () => void
  logout: () => Promise<void>
}

function readGuestMode() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(GUEST_AUTH_STORAGE_KEY) === 'guest'
}

function persistGuestMode(enabled: boolean) {
  if (typeof window === 'undefined') return

  if (enabled) {
    window.localStorage.setItem(GUEST_AUTH_STORAGE_KEY, 'guest')
    return
  }

  window.localStorage.removeItem(GUEST_AUTH_STORAGE_KEY)
}

function setStoredToken(token: string) {
  window.localStorage.setItem(SESSION_TOKEN_KEY, token)
}

function removeStoredToken() {
  window.localStorage.removeItem(SESSION_TOKEN_KEY)
}

function hasStoredToken() {
  if (typeof window === 'undefined') return false
  return Boolean(window.localStorage.getItem(SESSION_TOKEN_KEY))
}

function setAuthenticatedUser(set: (partial: Partial<AuthStore>) => void, user: AuthUser) {
  persistGuestMode(false)
  persistCachedAuthUser(user)
  set({
    authMode: 'authenticated',
    user,
    isChecking: false,
    hasChecked: true,
  })
}

export const useAuthStore = create<AuthStore>()((set) => ({
  authMode: readGuestMode() ? 'guest' : 'anonymous',
  user: null,
  isChecking: true,
  hasChecked: false,
  checkSession: async () => {
    set({ isChecking: true })

    const cachedUser = readCachedAuthUser()

    if (!isOnline() && cachedUser && hasStoredToken()) {
      setAuthenticatedUser(set, cachedUser)
      return
    }

    try {
      const payload = await requestJson<{ user: AuthUser }>('/auth/me')
      setAuthenticatedUser(set, payload.user)
      return
    } catch (error) {
      if (cachedUser && hasStoredToken() && isNetworkRequestError(error)) {
        setAuthenticatedUser(set, cachedUser)
        return
      }

      if (readGuestMode()) {
        set({
          authMode: 'guest',
          user: null,
          isChecking: false,
          hasChecked: true,
        })
        return
      }
    }

    removeStoredToken()
    persistGuestMode(false)
    clearCachedAuthUser()
    set({
      authMode: 'anonymous',
      user: null,
      isChecking: false,
      hasChecked: true,
    })
  },
  login: async (payload) => {
    const response = await requestJson<{ user: AuthUser; sessionToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    setStoredToken(response.sessionToken)
    setAuthenticatedUser(set, response.user)
  },
  register: async (payload) => {
    const response = await requestJson<{ user: AuthUser; sessionToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    setStoredToken(response.sessionToken)
    setAuthenticatedUser(set, response.user)
  },
  continueAsGuest: () => {
    persistGuestMode(true)
    set({
      authMode: 'guest',
      user: null,
      isChecking: false,
      hasChecked: true,
    })
  },
  logout: async () => {
    const { authMode: currentMode, user } = useAuthStore.getState()

    if (currentMode === 'authenticated') {
      try {
        await requestJson<{ ok: boolean }>('/auth/logout', {
          method: 'POST',
        })
      } catch (error) {
        if (!isNetworkRequestError(error)) {
          throw error
        }
      }
    }

    removeStoredToken()
    persistGuestMode(false)
    clearCachedAuthUser()
    if (user) {
      clearCachedBootstrap(user.id)
    }
    set({
      authMode: 'anonymous',
      user: null,
      isChecking: false,
      hasChecked: true,
    })
  },
}))
