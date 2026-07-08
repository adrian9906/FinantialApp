import type { PriceScoutResult, PriceScoutSearchResponse } from '@plata/shared'

const DEFAULT_PRICESCOUT_API_BASE_URL = 'https://pricescout-zr56.onrender.com/api'
const rawPriceScoutApiBaseUrl = import.meta.env.VITE_PRICESCOUT_API_BASE_URL?.trim() || DEFAULT_PRICESCOUT_API_BASE_URL
const REQUEST_TIMEOUT_MS = 60000

export const PRICESCOUT_STORE_OPTIONS = [
  { label: 'Amazon', value: 'amazon' },
  { label: 'Revolico', value: 'revolico' },
  { label: 'El Yerro', value: 'Yerro Menu' },
] as const

export type PriceScoutStoreValue = (typeof PRICESCOUT_STORE_OPTIONS)[number]['value']

function normalizeBaseUrl(baseUrl: string) {
  if (!baseUrl) return DEFAULT_PRICESCOUT_API_BASE_URL
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export function normalizePriceScoutStore(store: string): PriceScoutStoreValue {
  const normalized = store.trim().toLowerCase()

  if (normalized === 'amazon') return 'amazon'
  if (normalized === 'revolico') return 'revolico'
  if (normalized === 'el yerro' || normalized === 'yerro menu' || normalized === 'yerro') {
    return 'Yerro Menu'
  }

  return 'amazon'
}

export function serializePriceScoutStores(stores: string[]) {
  return stores.map((store) => normalizePriceScoutStore(store)).join(',')
}

export function groupPriceScoutResultsByStore(results: PriceScoutResult[]) {
  const grouped = results.reduce<Record<string, PriceScoutResult[]>>((accumulator, result) => {
    const key = result.store
    accumulator[key] = [...(accumulator[key] ?? []), result]
    return accumulator
  }, {})

  return Object.entries(grouped)
    .map(([store, storeResults]) => ({
      store,
      results: [...storeResults].sort((a, b) => a.price - b.price),
      lowestPrice: Math.min(...storeResults.map((entry) => entry.price)),
    }))
    .sort((a, b) => a.lowestPrice - b.lowestPrice)
}

export async function searchPriceScout(
  query: string,
  stores: string[],
  signal?: AbortSignal,
): Promise<PriceScoutResult[]> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return []

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(new Error('timeout')), REQUEST_TIMEOUT_MS)

  const abortListener = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', abortListener, { once: true })

  try {
    const searchParams = new URLSearchParams({
      q: trimmedQuery,
      stores: serializePriceScoutStores(stores),
    })

    const response = await fetch(`${normalizeBaseUrl(rawPriceScoutApiBaseUrl)}/search?${searchParams.toString()}`, {
      method: 'GET',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`No se pudo consultar PriceScout (${response.status}).`)
    }

    const payload = (await response.json()) as PriceScoutSearchResponse
    return Array.isArray(payload.results)
      ? [...payload.results].sort((a, b) => a.price - b.price)
      : []
  } catch (error) {
    if (controller.signal.aborted || signal?.aborted) {
      throw new Error('La búsqueda tardó demasiado. Intenta de nuevo.')
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error('No se pudo consultar PriceScout.')
  } finally {
    window.clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortListener)
  }
}
