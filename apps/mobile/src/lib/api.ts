import Constants from 'expo-constants'
import { Platform } from 'react-native'
import type { AuthResponse } from '@plata/shared'

import { removeStoredValue, writeStoredJson } from './storage'

const SESSION_TOKEN_STORAGE_KEY = 'plata-mobile-session-token'
const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? process.env.API_BASE_URL?.trim() ?? ''
const DEFAULT_DEV_API_PORT = '3001'

function normalizeBaseUrl(baseUrl: string) {
  if (!baseUrl) return ''
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

function getExpoDevBaseUrl() {
  const hostUri = Constants.expoConfig?.hostUri?.trim()

  if (hostUri) {
    const host = hostUri.split(':')[0]

    if (host) {
      return `http://${host}:${DEFAULT_DEV_API_PORT}`
    }
  }

  if (__DEV__) {
    return Platform.OS === 'android'
      ? `http://10.0.2.2:${DEFAULT_DEV_API_PORT}`
      : `http://localhost:${DEFAULT_DEV_API_PORT}`
  }

  return ''
}

export function getApiBaseUrl() {
  return normalizeBaseUrl(rawApiBaseUrl || getExpoDevBaseUrl())
}

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const baseUrl = getApiBaseUrl()

  if (!baseUrl) {
    throw new Error('Configura EXPO_PUBLIC_API_BASE_URL para usar la API autenticada en mobile.')
  }

  return `${baseUrl}/api${normalizedPath}`
}

export async function requestJson<T>(path: string, init?: RequestInit & { token?: string | null }): Promise<T> {
  const { token, ...requestInit } = init ?? {}

  const response = await fetch(getApiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(requestInit.headers ?? {}),
    },
    ...requestInit,
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
    throw new Error(payload?.error ?? text ?? `Request failed: ${response.status}`)
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export async function persistSessionToken(token: string | null | undefined) {
  if (!token) {
    await removeStoredValue(SESSION_TOKEN_STORAGE_KEY)
    return
  }

  await writeStoredJson(SESSION_TOKEN_STORAGE_KEY, token)
}

export async function syncAuthResponse(response: AuthResponse) {
  await persistSessionToken(response.sessionToken ?? null)
}

export { SESSION_TOKEN_STORAGE_KEY }
