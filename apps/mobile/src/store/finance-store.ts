import { create } from 'zustand'
import {
  buildPurchaseProjection,
  createEmptyBootstrapPayload,
  getMonthlyOverview,
  normalizeBootstrapPayload,
  type BootstrapPayload,
  type WishlistItem,
} from '@plata/shared'

import { getApiBaseUrl, requestJson } from '../lib/api'
import { readStoredJson, writeStoredJson } from '../lib/storage'
import { useAuthStore } from './auth-store'
import { usePreferencesStore } from './preferences-store'

const GUEST_FINANCE_STORAGE_KEY = 'plata-mobile-guest-finance'
const AUTH_FINANCE_CACHE_KEY = 'plata-mobile-auth-finance'

interface FinanceStore extends BootstrapPayload {
  hasLoaded: boolean
  loadedKey: string | null
  hydrate: () => Promise<void>
  reset: () => Promise<void>
  seedGuestData: () => Promise<void>
  getWishlistProjection: (item: WishlistItem) => ReturnType<typeof buildPurchaseProjection>
}

function getActiveKey() {
  const { authMode, user } = useAuthStore.getState()

  if (authMode === 'guest') return 'guest'
  if (authMode === 'authenticated' && user) return `user:${user.id}`
  return 'anonymous'
}

function formatProjectionDate(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

async function readGuestSnapshot() {
  return readStoredJson<BootstrapPayload>(GUEST_FINANCE_STORAGE_KEY, createEmptyBootstrapPayload())
}

async function readAuthSnapshot() {
  return readStoredJson<BootstrapPayload>(AUTH_FINANCE_CACHE_KEY, createEmptyBootstrapPayload())
}

async function persistSnapshot(key: string, snapshot: BootstrapPayload) {
  await writeStoredJson(key, snapshot)
}

function createGuestDemoSnapshot(): BootstrapPayload {
  return {
    salaries: [{ id: 'salary-demo', amount: 200, month: '2026-06' }],
    transactions: [
      { id: 'want-demo', amount: 40, type: 'want', description: 'outings::checked::Cafe con amigos', date: '2026-06-12' },
      { id: 'saving-demo', amount: 60, type: 'saving', description: 'Ahorro mensual', date: '2026-06-14' },
      { id: 'expense-demo', amount: 72, type: 'expense', description: 'home::checked::Internet y servicios', date: '2026-06-08' },
    ],
    debts: [],
    wishlist: [
      {
        id: 'wish-demo',
        name: 'Auriculares Bluetooth',
        price: 80,
        priority: 'high',
        savedAmount: 60,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
      },
    ],
    events: [
      {
        id: 'event-demo',
        name: 'Cumple de Ana',
        date: '2026-06-24',
        amount: 30,
        isNotification: true,
      },
    ],
    projections: [{ id: 'projection-demo', targetSalary: 320 }],
    reminders: [
      {
        id: 'reminder-demo',
        title: 'Pagar recarga',
        description: 'Antes del viernes',
        date: '2026-06-21',
        completed: false,
      },
    ],
  }
}

export const useFinanceStore = create<FinanceStore>()((set, get) => ({
  ...createEmptyBootstrapPayload(),
  hasLoaded: false,
  loadedKey: null,
  hydrate: async () => {
    const activeKey = getActiveKey()

    if (get().hasLoaded && get().loadedKey === activeKey) {
      return
    }

    if (activeKey === 'guest') {
      const snapshot = normalizeBootstrapPayload(await readGuestSnapshot())
      set({
        ...snapshot,
        hasLoaded: true,
        loadedKey: activeKey,
      })
      return
    }

    if (activeKey === 'anonymous') {
      set({
        ...createEmptyBootstrapPayload(),
        hasLoaded: false,
        loadedKey: null,
      })
      return
    }

    const token = useAuthStore.getState().sessionToken
    const cachedSnapshot = normalizeBootstrapPayload(await readAuthSnapshot())

    if (!getApiBaseUrl() || !token) {
      set({
        ...cachedSnapshot,
        hasLoaded: true,
        loadedKey: activeKey,
      })
      return
    }

    try {
      const payload = normalizeBootstrapPayload(
        await requestJson<BootstrapPayload>('/bootstrap', {
          method: 'GET',
          token,
        }),
      )

      await persistSnapshot(AUTH_FINANCE_CACHE_KEY, payload)
      set({
        ...payload,
        hasLoaded: true,
        loadedKey: activeKey,
      })
    } catch {
      set({
        ...cachedSnapshot,
        hasLoaded: true,
        loadedKey: activeKey,
      })
    }
  },
  reset: async () => {
    set({
      ...createEmptyBootstrapPayload(),
      hasLoaded: false,
      loadedKey: null,
    })
  },
  seedGuestData: async () => {
    const snapshot = createGuestDemoSnapshot()
    await persistSnapshot(GUEST_FINANCE_STORAGE_KEY, snapshot)
    set({
      ...snapshot,
      hasLoaded: true,
      loadedKey: 'guest',
    })
  },
  getWishlistProjection: (item) => {
    const state = get()
    const formula = usePreferencesStore.getState().formula
    const overview = getMonthlyOverview(state.salaries, state.transactions, formula)
    const averageMonthlySavings = Math.max(overview.totalSavings, overview.budgetSavings)

    return buildPurchaseProjection(item.price, item.savedAmount, averageMonthlySavings, formatProjectionDate)
  },
}))
