import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AuthCredentials, AuthMode, AuthResponse, AuthUser, RegisterPayload } from '@plata/shared'

import { getApiBaseUrl, persistSessionToken, requestJson, syncAuthResponse } from '../lib/api'
import { kvStateStorage, readStoredJson } from '../lib/storage'

const AUTH_STORAGE_KEY = 'plata-mobile-auth'
const SESSION_TOKEN_STORAGE_KEY = 'plata-mobile-session-token'

interface AuthStore {
  authMode: AuthMode
  user: AuthUser | null
  sessionToken: string | null
  isChecking: boolean
  hasChecked: boolean
  checkSession: () => Promise<void>
  login: (payload: AuthCredentials) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  continueAsGuest: () => Promise<void>
  logout: () => Promise<void>
}

function setAuthenticatedState(
  set: (partial: Partial<AuthStore>) => void,
  response: AuthResponse,
) {
  set({
    authMode: 'authenticated',
    user: response.user,
    sessionToken: response.sessionToken ?? null,
    isChecking: false,
    hasChecked: true,
  })
}

async function readPersistedSessionToken() {
  return readStoredJson<string | null>(SESSION_TOKEN_STORAGE_KEY, null)
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      authMode: 'anonymous',
      user: null,
      sessionToken: null,
      isChecking: true,
      hasChecked: false,
      checkSession: async () => {
        const state = get()

        if (state.authMode === 'guest') {
          set({
            isChecking: false,
            hasChecked: true,
          })
          return
        }

        const sessionToken = state.sessionToken ?? (await readPersistedSessionToken())

        if (!sessionToken || !getApiBaseUrl()) {
          set({
            authMode: 'anonymous',
            user: null,
            sessionToken: null,
            isChecking: false,
            hasChecked: true,
          })
          return
        }

        try {
          const payload = await requestJson<{ user: AuthUser }>('/auth/me', {
            method: 'GET',
            token: sessionToken,
          })

          set({
            authMode: 'authenticated',
            user: payload.user,
            sessionToken,
            isChecking: false,
            hasChecked: true,
          })
        } catch {
          await persistSessionToken(null)
          set({
            authMode: 'anonymous',
            user: null,
            sessionToken: null,
            isChecking: false,
            hasChecked: true,
          })
        }
      },
      login: async (payload) => {
        const response = await requestJson<AuthResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

        await syncAuthResponse(response)
        setAuthenticatedState(set, response)
      },
      register: async (payload) => {
        const response = await requestJson<AuthResponse>('/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

        await syncAuthResponse(response)
        setAuthenticatedState(set, response)
      },
      continueAsGuest: async () => {
        await persistSessionToken(null)
        set({
          authMode: 'guest',
          user: null,
          sessionToken: null,
          isChecking: false,
          hasChecked: true,
        })
      },
      logout: async () => {
        const { authMode, sessionToken } = get()

        if (authMode === 'authenticated' && sessionToken && getApiBaseUrl()) {
          try {
            await requestJson<{ ok: boolean }>('/auth/logout', {
              method: 'POST',
              token: sessionToken,
            })
          } catch {
            // Keep logout resilient even when offline or server-side logout fails.
          }
        }

        await persistSessionToken(null)
        set({
          authMode: 'anonymous',
          user: null,
          sessionToken: null,
          isChecking: false,
          hasChecked: true,
        })
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => kvStateStorage),
      partialize: (state) => ({
        authMode: state.authMode,
        user: state.user,
        sessionToken: state.sessionToken,
      }),
    },
  ),
)
