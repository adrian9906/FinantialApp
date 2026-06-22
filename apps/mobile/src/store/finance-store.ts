import { create } from 'zustand'
import {
  type AppEvent,
  buildPurchaseProjection,
  createEmptyBootstrapPayload,
  type Debt,
  getMonthlyOverview,
  normalizeBootstrapPayload,
  type Projection,
  type Reminder,
  type BootstrapPayload,
  type Salary,
  type Transaction,
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
  addSalary: (payload: Omit<Salary, 'id'>) => Promise<void>
  updateSalary: (id: string, payload: Omit<Salary, 'id'>) => Promise<void>
  removeSalary: (id: string) => Promise<void>
  addTransaction: (payload: Omit<Transaction, 'id'>) => Promise<void>
  updateTransaction: (id: string, payload: Partial<Omit<Transaction, 'id'>>) => Promise<void>
  removeTransaction: (id: string) => Promise<void>
  addWishlistItem: (payload: Omit<WishlistItem, 'id'>) => Promise<void>
  updateWishlistItem: (id: string, payload: Partial<Omit<WishlistItem, 'id'>>) => Promise<void>
  removeWishlistItem: (id: string) => Promise<void>
  addDebt: (payload: Omit<Debt, 'id'>) => Promise<void>
  updateDebt: (id: string, payload: Partial<Omit<Debt, 'id'>>) => Promise<void>
  removeDebt: (id: string) => Promise<void>
  addEvent: (payload: Omit<AppEvent, 'id'>) => Promise<void>
  updateEvent: (id: string, payload: Partial<Omit<AppEvent, 'id'>>) => Promise<void>
  removeEvent: (id: string) => Promise<void>
  addProjection: (payload: Omit<Projection, 'id'>) => Promise<void>
  updateProjection: (id: string, payload: Partial<Omit<Projection, 'id'>>) => Promise<void>
  removeProjection: (id: string) => Promise<void>
  addReminder: (payload: Omit<Reminder, 'id'>) => Promise<void>
  updateReminder: (id: string, payload: Partial<Omit<Reminder, 'id'>>) => Promise<void>
  toggleReminder: (id: string) => Promise<void>
  removeReminder: (id: string) => Promise<void>
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

function sortSalariesByMonth(items: Salary[]) {
  return [...items].sort((a, b) => b.month.localeCompare(a.month))
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getTokenOrThrow(message: string) {
  const token = useAuthStore.getState().sessionToken

  if (!token) {
    throw new Error(message)
  }

  return token
}

async function persistFinanceSnapshotForActiveKey(activeKey: string, snapshot: BootstrapPayload) {
  if (activeKey === 'guest') {
    await persistSnapshot(GUEST_FINANCE_STORAGE_KEY, snapshot)
    return
  }

  if (activeKey.startsWith('user:')) {
    await persistSnapshot(AUTH_FINANCE_CACHE_KEY, snapshot)
  }
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
  addSalary: async (payload) => {
    const activeKey = getActiveKey()
    const state = get()
    const token = useAuthStore.getState().sessionToken

    if (activeKey === 'guest') {
      const created: Salary = {
        id: createLocalId('salary'),
        amount: payload.amount,
        month: payload.month,
      }
      const snapshot = {
        ...state,
        salaries: sortSalariesByMonth([...state.salaries, created]),
      }

      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    if (!token) {
      throw new Error('Necesitas iniciar sesion para guardar salarios en la nube.')
    }

    const created = await requestJson<Salary>('/salaries', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })

    const snapshot = {
      ...state,
      salaries: sortSalariesByMonth([...state.salaries, created]),
    }

    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  updateSalary: async (id, payload) => {
    const activeKey = getActiveKey()
    const state = get()
    const token = useAuthStore.getState().sessionToken

    if (activeKey === 'guest') {
      const snapshot = {
        ...state,
        salaries: sortSalariesByMonth(
          state.salaries.map((salary) =>
            salary.id === id
              ? {
                  ...salary,
                  amount: payload.amount,
                  month: payload.month,
                }
              : salary,
          ),
        ),
      }

      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    if (!token) {
      throw new Error('Necesitas iniciar sesion para actualizar salarios en la nube.')
    }

    const updated = await requestJson<Salary>(`/salaries/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    })

    const snapshot = {
      ...state,
      salaries: sortSalariesByMonth(
        state.salaries.map((salary) => (salary.id === id ? updated : salary)),
      ),
    }

    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  removeSalary: async (id) => {
    const activeKey = getActiveKey()
    const state = get()
    const token = useAuthStore.getState().sessionToken

    if (activeKey === 'guest') {
      const snapshot = {
        ...state,
        salaries: state.salaries.filter((salary) => salary.id !== id),
      }

      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    if (!token) {
      throw new Error('Necesitas iniciar sesion para eliminar salarios en la nube.')
    }

    await requestJson<void>(`/salaries/${id}`, {
      method: 'DELETE',
      token,
    })

    const snapshot = {
      ...state,
      salaries: state.salaries.filter((salary) => salary.id !== id),
    }

    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  addTransaction: async (payload) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const created: Transaction = {
        ...payload,
        id: createLocalId(payload.type),
      }
      const snapshot = {
        ...state,
        transactions: [created, ...state.transactions],
      }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para guardar movimientos en la nube.')
    const endpoint = payload.type === 'expense' ? '/expenses' : payload.type === 'want' ? '/wants' : '/savings'
    const created = await requestJson<Transaction>(endpoint, {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })
    const snapshot = {
      ...state,
      transactions: [created, ...state.transactions],
    }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  updateTransaction: async (id, payload) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const snapshot = {
        ...state,
        transactions: state.transactions.map((entry) => (entry.id === id ? { ...entry, ...payload } : entry)),
      }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const current = state.transactions.find((entry) => entry.id === id)
    const type = payload.type ?? current?.type
    if (!type) return

    const token = getTokenOrThrow('Necesitas iniciar sesion para actualizar movimientos en la nube.')
    const endpoint = type === 'expense' ? '/expenses' : type === 'want' ? '/wants' : '/savings'
    const updated = await requestJson<Transaction>(`${endpoint}/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    })
    const snapshot = {
      ...state,
      transactions: state.transactions.map((entry) => (entry.id === id ? updated : entry)),
    }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  removeTransaction: async (id) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const snapshot = {
        ...state,
        transactions: state.transactions.filter((entry) => entry.id !== id),
      }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const current = state.transactions.find((entry) => entry.id === id)
    if (!current) return

    const token = getTokenOrThrow('Necesitas iniciar sesion para eliminar movimientos en la nube.')
    const endpoint = current.type === 'expense' ? '/expenses' : current.type === 'want' ? '/wants' : '/savings'
    await requestJson<void>(`${endpoint}/${id}`, { method: 'DELETE', token })
    const snapshot = {
      ...state,
      transactions: state.transactions.filter((entry) => entry.id !== id),
    }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  addWishlistItem: async (payload) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const created: WishlistItem = { ...payload, id: createLocalId('wishlist') }
      const snapshot = {
        ...state,
        wishlist: [created, ...state.wishlist],
      }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para guardar deseos en la nube.')
    const created = await requestJson<WishlistItem>('/wishlist', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })
    const snapshot = { ...state, wishlist: [created, ...state.wishlist] }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  updateWishlistItem: async (id, payload) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const snapshot = {
        ...state,
        wishlist: state.wishlist.map((item) => (item.id === id ? { ...item, ...payload } : item)),
      }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para actualizar deseos en la nube.')
    const updated = await requestJson<WishlistItem>(`/wishlist/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    })
    const snapshot = {
      ...state,
      wishlist: state.wishlist.map((item) => (item.id === id ? updated : item)),
    }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  removeWishlistItem: async (id) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const snapshot = {
        ...state,
        wishlist: state.wishlist.filter((item) => item.id !== id),
      }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para eliminar deseos en la nube.')
    await requestJson<void>(`/wishlist/${id}`, { method: 'DELETE', token })
    const snapshot = {
      ...state,
      wishlist: state.wishlist.filter((item) => item.id !== id),
    }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  addDebt: async (payload) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const created: Debt = { ...payload, id: createLocalId('debt') }
      const snapshot = { ...state, debts: [created, ...state.debts] }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para guardar deudas en la nube.')
    const created = await requestJson<Debt>('/debts', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })
    const snapshot = { ...state, debts: [created, ...state.debts] }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  updateDebt: async (id, payload) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const snapshot = {
        ...state,
        debts: state.debts.map((entry) => (entry.id === id ? { ...entry, ...payload } : entry)),
      }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para actualizar deudas en la nube.')
    const updated = await requestJson<Debt>(`/debts/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    })
    const snapshot = { ...state, debts: state.debts.map((entry) => (entry.id === id ? updated : entry)) }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  removeDebt: async (id) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const snapshot = { ...state, debts: state.debts.filter((entry) => entry.id !== id) }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para eliminar deudas en la nube.')
    await requestJson<void>(`/debts/${id}`, { method: 'DELETE', token })
    const snapshot = { ...state, debts: state.debts.filter((entry) => entry.id !== id) }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  addEvent: async (payload) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const created: AppEvent = { ...payload, id: createLocalId('event') }
      const snapshot = { ...state, events: [created, ...state.events] }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para guardar eventos en la nube.')
    const created = await requestJson<AppEvent>('/events', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })
    const snapshot = { ...state, events: [created, ...state.events] }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  updateEvent: async (id, payload) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const snapshot = { ...state, events: state.events.map((entry) => (entry.id === id ? { ...entry, ...payload } : entry)) }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para actualizar eventos en la nube.')
    const updated = await requestJson<AppEvent>(`/events/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    })
    const snapshot = { ...state, events: state.events.map((entry) => (entry.id === id ? updated : entry)) }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  removeEvent: async (id) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const snapshot = { ...state, events: state.events.filter((entry) => entry.id !== id) }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para eliminar eventos en la nube.')
    await requestJson<void>(`/events/${id}`, { method: 'DELETE', token })
    const snapshot = { ...state, events: state.events.filter((entry) => entry.id !== id) }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  addProjection: async (payload) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const created: Projection = { ...payload, id: createLocalId('projection') }
      const snapshot = { ...state, projections: [created, ...state.projections] }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para guardar proyecciones en la nube.')
    const created = await requestJson<Projection>('/projections', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })
    const snapshot = { ...state, projections: [created, ...state.projections] }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  updateProjection: async (id, payload) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const snapshot = { ...state, projections: state.projections.map((entry) => (entry.id === id ? { ...entry, ...payload } : entry)) }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para actualizar proyecciones en la nube.')
    const updated = await requestJson<Projection>(`/projections/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    })
    const snapshot = { ...state, projections: state.projections.map((entry) => (entry.id === id ? updated : entry)) }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  removeProjection: async (id) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const snapshot = { ...state, projections: state.projections.filter((entry) => entry.id !== id) }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para eliminar proyecciones en la nube.')
    await requestJson<void>(`/projections/${id}`, { method: 'DELETE', token })
    const snapshot = { ...state, projections: state.projections.filter((entry) => entry.id !== id) }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  addReminder: async (payload) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const created: Reminder = { ...payload, id: createLocalId('reminder') }
      const snapshot = { ...state, reminders: [created, ...state.reminders] }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para guardar recordatorios en la nube.')
    const created = await requestJson<Reminder>('/reminders', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })
    const snapshot = { ...state, reminders: [created, ...state.reminders] }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  updateReminder: async (id, payload) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const snapshot = { ...state, reminders: state.reminders.map((entry) => (entry.id === id ? { ...entry, ...payload } : entry)) }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para actualizar recordatorios en la nube.')
    const updated = await requestJson<Reminder>(`/reminders/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    })
    const snapshot = { ...state, reminders: state.reminders.map((entry) => (entry.id === id ? updated : entry)) }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  toggleReminder: async (id) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const snapshot = {
        ...state,
        reminders: state.reminders.map((entry) => (entry.id === id ? { ...entry, completed: !entry.completed } : entry)),
      }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para actualizar recordatorios en la nube.')
    const updated = await requestJson<Reminder>(`/reminders/${id}/toggle`, {
      method: 'PATCH',
      token,
    })
    const snapshot = { ...state, reminders: state.reminders.map((entry) => (entry.id === id ? updated : entry)) }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  removeReminder: async (id) => {
    const activeKey = getActiveKey()
    const state = get()

    if (activeKey === 'guest') {
      const snapshot = { ...state, reminders: state.reminders.filter((entry) => entry.id !== id) }
      await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
      set(snapshot)
      return
    }

    const token = getTokenOrThrow('Necesitas iniciar sesion para eliminar recordatorios en la nube.')
    await requestJson<void>(`/reminders/${id}`, { method: 'DELETE', token })
    const snapshot = { ...state, reminders: state.reminders.filter((entry) => entry.id !== id) }
    await persistFinanceSnapshotForActiveKey(activeKey, snapshot)
    set(snapshot)
  },
  getWishlistProjection: (item) => {
    const state = get()
    const formula = usePreferencesStore.getState().formula
    const overview = getMonthlyOverview(state.salaries, state.transactions, formula)
    const averageMonthlySavings = Math.max(overview.totalSavings, overview.budgetSavings)

    return buildPurchaseProjection(item.price, item.savedAmount, averageMonthlySavings, formatProjectionDate)
  },
}))
