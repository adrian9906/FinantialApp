const defaultApiBaseUrl = 'https://finantialapp.onrender.com'
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || defaultApiBaseUrl
const SESSION_TOKEN_KEY = 'plata-session-token'

function normalizeBaseUrl(baseUrl: string) {
  if (!baseUrl) return ''
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const baseUrl = normalizeBaseUrl(rawApiBaseUrl)

  return `${baseUrl}/api${normalizedPath}`
}

function readSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(SESSION_TOKEN_KEY)
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readSessionToken()
  const { headers: initHeaders, ...restInit } = init ?? {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(initHeaders as Record<string, string> | undefined),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(getApiUrl(path), {
    credentials: 'include',
    headers,
    ...restInit,
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
