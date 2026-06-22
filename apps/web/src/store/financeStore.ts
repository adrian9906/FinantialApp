import { create } from 'zustand'
import type { AppEvent, BootstrapPayload, Debt, Projection, Reminder, Salary, Transaction, WishlistItem } from '@plata/shared'
import { createEmptyBootstrapPayload } from '@plata/shared'

import { requestJson } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

const GUEST_FINANCE_STORAGE_KEY = 'plata-guest-finance'

interface FinanceStore extends BootstrapPayload {
  hasLoaded: boolean
  loadedKey: string | null
  hydrate: () => Promise<void>
  reset: () => void
  addSalary: (salary: Omit<Salary, 'id'>) => Promise<void>
  updateSalary: (id: string, data: Partial<Omit<Salary, 'id'>>) => Promise<void>
  removeSalary: (id: string) => Promise<void>
  addTransaction: (t: Omit<Transaction, 'id'>) => Promise<void>
  updateTransaction: (id: string, data: Partial<Omit<Transaction, 'id'>>) => Promise<void>
  removeTransaction: (id: string) => Promise<void>
  addWishlistItem: (w: Omit<WishlistItem, 'id'>) => Promise<void>
  updateWishlistItem: (id: string, data: Partial<Omit<WishlistItem, 'id'>>) => Promise<void>
  removeWishlistItem: (id: string) => Promise<void>
  addDebt: (d: Omit<Debt, 'id'>) => Promise<void>
  updateDebt: (id: string, data: Partial<Omit<Debt, 'id'>>) => Promise<void>
  removeDebt: (id: string) => Promise<void>
  addEvent: (e: Omit<AppEvent, 'id'>) => Promise<void>
  updateEvent: (id: string, data: Partial<Omit<AppEvent, 'id'>>) => Promise<void>
  removeEvent: (id: string) => Promise<void>
  addProjection: (p: Omit<Projection, 'id'>) => Promise<void>
  updateProjection: (id: string, data: Partial<Omit<Projection, 'id'>>) => Promise<void>
  removeProjection: (id: string) => Promise<void>
  addReminder: (r: Omit<Reminder, 'id'>) => Promise<void>
  updateReminder: (id: string, data: Partial<Omit<Reminder, 'id'>>) => Promise<void>
  toggleReminder: (id: string) => Promise<void>
  removeReminder: (id: string) => Promise<void>
}

function getEmptyState(): BootstrapPayload {
  return createEmptyBootstrapPayload()
}

function getGuestSnapshot(): BootstrapPayload {
  if (typeof window === 'undefined') return getEmptyState()

  const raw = window.localStorage.getItem(GUEST_FINANCE_STORAGE_KEY)
  if (!raw) return getEmptyState()

  try {
    const parsed = JSON.parse(raw) as Partial<BootstrapPayload>
    return {
      salaries: parsed.salaries ?? [],
      transactions: parsed.transactions ?? [],
      debts: parsed.debts ?? [],
      wishlist: parsed.wishlist ?? [],
      events: parsed.events ?? [],
      projections: parsed.projections ?? [],
      reminders: parsed.reminders ?? [],
    }
  } catch {
    return getEmptyState()
  }
}

function persistGuestSnapshot(snapshot: BootstrapPayload) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(GUEST_FINANCE_STORAGE_KEY, JSON.stringify(snapshot))
}

function getActiveKey() {
  const { authMode, user } = useAuthStore.getState()

  if (authMode === 'guest') return 'guest'
  if (authMode === 'authenticated' && user) return `user:${user.id}`
  return 'anonymous'
}

function isGuestMode() {
  return useAuthStore.getState().authMode === 'guest'
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function updateGuestState(
  set: (recipe: (state: FinanceStore) => Partial<FinanceStore>) => void,
  recipe: (state: FinanceStore) => Partial<BootstrapPayload>,
) {
  set((state) => {
    const next = recipe(state)
    persistGuestSnapshot({
      salaries: next.salaries ?? state.salaries,
      transactions: next.transactions ?? state.transactions,
      debts: next.debts ?? state.debts,
      wishlist: next.wishlist ?? state.wishlist,
      events: next.events ?? state.events,
      projections: next.projections ?? state.projections,
      reminders: next.reminders ?? state.reminders,
    })
    return next
  })
}

export const useFinanceStore = create<FinanceStore>()((set, get) => ({
  ...getEmptyState(),
  hasLoaded: false,
  loadedKey: null,
  hydrate: async () => {
    const activeKey = getActiveKey()
    if (get().hasLoaded && get().loadedKey === activeKey) return

    if (activeKey === 'guest') {
      set({
        ...getGuestSnapshot(),
        hasLoaded: true,
        loadedKey: activeKey,
      })
      return
    }

    if (activeKey === 'anonymous') {
      set({
        ...getEmptyState(),
        hasLoaded: false,
        loadedKey: null,
      })
      return
    }

    const payload = await requestJson<BootstrapPayload>('/bootstrap')
    set({
      ...payload,
      hasLoaded: true,
      loadedKey: activeKey,
    })
  },
  reset: () => {
    set({
      ...getEmptyState(),
      hasLoaded: false,
      loadedKey: null,
    })
  },
  addSalary: async (salary) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        salaries: [{ ...salary, id: makeId('salary') }, ...state.salaries],
      }))
      return
    }

    const created = await requestJson<Salary>('/salaries', {
      method: 'POST',
      body: JSON.stringify(salary),
    })
    set((state) => ({ salaries: [created, ...state.salaries] }))
  },
  updateSalary: async (id, data) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        salaries: state.salaries.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }

    const updated = await requestJson<Salary>(`/salaries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      salaries: state.salaries.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  removeSalary: async (id) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        salaries: state.salaries.filter((entry) => entry.id !== id),
      }))
      return
    }

    await requestJson<void>(`/salaries/${id}`, { method: 'DELETE' })
    set((state) => ({ salaries: state.salaries.filter((entry) => entry.id !== id) }))
  },
  addTransaction: async (transaction) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        transactions: [{ ...transaction, id: makeId(transaction.type) }, ...state.transactions],
      }))
      return
    }

    const created = await requestJson<Transaction>(`/${transaction.type === 'expense' ? 'expenses' : transaction.type === 'want' ? 'wants' : 'savings'}`, {
      method: 'POST',
      body: JSON.stringify(transaction),
    })
    set((state) => ({ transactions: [created, ...state.transactions] }))
  },
  updateTransaction: async (id, data) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        transactions: state.transactions.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }

    const current = get().transactions.find((entry) => entry.id === id)
    const type = data.type ?? current?.type
    if (!type) return
    const updated = await requestJson<Transaction>(`/${type === 'expense' ? 'expenses' : type === 'want' ? 'wants' : 'savings'}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      transactions: state.transactions.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  removeTransaction: async (id) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        transactions: state.transactions.filter((entry) => entry.id !== id),
      }))
      return
    }

    const current = get().transactions.find((entry) => entry.id === id)
    if (!current) return
    await requestJson<void>(`/${current.type === 'expense' ? 'expenses' : current.type === 'want' ? 'wants' : 'savings'}/${id}`, {
      method: 'DELETE',
    })
    set((state) => ({ transactions: state.transactions.filter((entry) => entry.id !== id) }))
  },
  addWishlistItem: async (item) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        wishlist: [{ ...item, id: makeId('wishlist') }, ...state.wishlist],
      }))
      return
    }

    const created = await requestJson<WishlistItem>('/wishlist', {
      method: 'POST',
      body: JSON.stringify(item),
    })
    set((state) => ({ wishlist: [created, ...state.wishlist] }))
  },
  updateWishlistItem: async (id, data) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        wishlist: state.wishlist.map((item) => (item.id === id ? { ...item, ...data } : item)),
      }))
      return
    }

    const updated = await requestJson<WishlistItem>(`/wishlist/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      wishlist: state.wishlist.map((item) => (item.id === id ? updated : item)),
    }))
  },
  removeWishlistItem: async (id) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        wishlist: state.wishlist.filter((item) => item.id !== id),
      }))
      return
    }

    await requestJson<void>(`/wishlist/${id}`, { method: 'DELETE' })
    set((state) => ({ wishlist: state.wishlist.filter((item) => item.id !== id) }))
  },
  addDebt: async (debt) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        debts: [{ ...debt, id: makeId('debt') }, ...state.debts],
      }))
      return
    }

    const created = await requestJson<Debt>('/debts', {
      method: 'POST',
      body: JSON.stringify(debt),
    })
    set((state) => ({ debts: [created, ...state.debts] }))
  },
  updateDebt: async (id, data) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        debts: state.debts.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }

    const updated = await requestJson<Debt>(`/debts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      debts: state.debts.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  removeDebt: async (id) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        debts: state.debts.filter((entry) => entry.id !== id),
      }))
      return
    }

    await requestJson<void>(`/debts/${id}`, { method: 'DELETE' })
    set((state) => ({ debts: state.debts.filter((entry) => entry.id !== id) }))
  },
  addEvent: async (event) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        events: [{ ...event, id: makeId('event') }, ...state.events],
      }))
      return
    }

    const created = await requestJson<AppEvent>('/events', {
      method: 'POST',
      body: JSON.stringify(event),
    })
    set((state) => ({ events: [created, ...state.events] }))
  },
  updateEvent: async (id, data) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        events: state.events.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }

    const updated = await requestJson<AppEvent>(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      events: state.events.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  removeEvent: async (id) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        events: state.events.filter((entry) => entry.id !== id),
      }))
      return
    }

    await requestJson<void>(`/events/${id}`, { method: 'DELETE' })
    set((state) => ({ events: state.events.filter((entry) => entry.id !== id) }))
  },
  addProjection: async (projection) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        projections: [{ ...projection, id: makeId('projection') }, ...state.projections],
      }))
      return
    }

    const created = await requestJson<Projection>('/projections', {
      method: 'POST',
      body: JSON.stringify(projection),
    })
    set((state) => ({ projections: [created, ...state.projections] }))
  },
  updateProjection: async (id, data) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        projections: state.projections.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }

    const updated = await requestJson<Projection>(`/projections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      projections: state.projections.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  removeProjection: async (id) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        projections: state.projections.filter((entry) => entry.id !== id),
      }))
      return
    }

    await requestJson<void>(`/projections/${id}`, { method: 'DELETE' })
    set((state) => ({ projections: state.projections.filter((entry) => entry.id !== id) }))
  },
  addReminder: async (reminder) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        reminders: [{ ...reminder, id: makeId('reminder') }, ...state.reminders],
      }))
      return
    }

    const created = await requestJson<Reminder>('/reminders', {
      method: 'POST',
      body: JSON.stringify(reminder),
    })
    set((state) => ({ reminders: [created, ...state.reminders] }))
  },
  updateReminder: async (id, data) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        reminders: state.reminders.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }

    const updated = await requestJson<Reminder>(`/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      reminders: state.reminders.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  toggleReminder: async (id) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        reminders: state.reminders.map((entry) => (entry.id === id ? { ...entry, completed: !entry.completed } : entry)),
      }))
      return
    }

    const updated = await requestJson<Reminder>(`/reminders/${id}/toggle`, {
      method: 'PATCH',
    })
    set((state) => ({
      reminders: state.reminders.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  removeReminder: async (id) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        reminders: state.reminders.filter((entry) => entry.id !== id),
      }))
      return
    }

    await requestJson<void>(`/reminders/${id}`, { method: 'DELETE' })
    set((state) => ({ reminders: state.reminders.filter((entry) => entry.id !== id) }))
  },
}))
