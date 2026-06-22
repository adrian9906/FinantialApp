const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''

function normalizeBaseUrl(baseUrl: string) {
  if (!baseUrl) return ''
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const baseUrl = normalizeBaseUrl(rawApiBaseUrl)

  if (!baseUrl) {
    return `/api${normalizedPath}`
  }

  return `${baseUrl}/api${normalizedPath}`
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    credentials: 'include',
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
