import { create } from 'zustand'

import type { AuthUser } from '@/types'

const GUEST_AUTH_STORAGE_KEY = 'plata-auth-mode'

export type AuthMode = 'anonymous' | 'guest' | 'authenticated'

interface LoginPayload {
  email: string
  password: string
  rememberMe: boolean
}

interface RegisterPayload extends LoginPayload {
  name: string
}

interface AuthStore {
  authMode: AuthMode
  user: AuthUser | null
  isChecking: boolean
  hasChecked: boolean
  checkSession: () => Promise<void>
  login: (payload: LoginPayload) => Promise<void>
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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const text = await response.text()
    const payload = text
      ? ((() => {
          try {
            return JSON.parse(text) as { error?: string }
          } catch {
            return null
          }
        })())
      : null
    const message = payload?.error ?? text
    throw new Error(message || `Request failed: ${response.status}`)
  }

  const text = await response.text()
  if (!text) {
    return undefined as T
  }

  return JSON.parse(text) as T
}

function setAuthenticatedUser(set: (partial: Partial<AuthStore>) => void, user: AuthUser) {
  persistGuestMode(false)
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

    try {
      const payload = await requestJson<{ user: AuthUser }>('/auth/me')
      setAuthenticatedUser(set, payload.user)
      return
    } catch {
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

    persistGuestMode(false)
    set({
      authMode: 'anonymous',
      user: null,
      isChecking: false,
      hasChecked: true,
    })
  },
  login: async (payload) => {
    const response = await requestJson<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    setAuthenticatedUser(set, response.user)
  },
  register: async (payload) => {
    const response = await requestJson<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

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
    const currentMode = useAuthStore.getState().authMode

    if (currentMode === 'authenticated') {
      await requestJson<{ ok: boolean }>('/auth/logout', {
        method: 'POST',
      })
    }

    persistGuestMode(false)
    set({
      authMode: 'anonymous',
      user: null,
      isChecking: false,
      hasChecked: true,
    })
  },
}))
