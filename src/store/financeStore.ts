import { create } from 'zustand'
import type { AppEvent, Debt, Projection, Reminder, Salary, Transaction, WishlistItem } from '@/types'

interface BootstrapPayload {
  salaries: Salary[]
  transactions: Transaction[]
  debts: Debt[]
  wishlist: WishlistItem[]
  events: AppEvent[]
  projections: Projection[]
  reminders: Reminder[]
}

interface FinanceStore extends BootstrapPayload {
  hasLoaded: boolean
  hydrate: () => Promise<void>
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
    throw new Error(text || `Request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const useFinanceStore = create<FinanceStore>()((set, get) => ({
  salaries: [],
  transactions: [],
  debts: [],
  wishlist: [],
  events: [],
  projections: [],
  reminders: [],
  hasLoaded: false,
  hydrate: async () => {
    if (get().hasLoaded) return
    const payload = await requestJson<BootstrapPayload>('/bootstrap')
    set({ ...payload, hasLoaded: true })
  },
  addSalary: async (salary) => {
    const created = await requestJson<Salary>('/salaries', {
      method: 'POST',
      body: JSON.stringify(salary),
    })
    set((state) => ({ salaries: [created, ...state.salaries] }))
  },
  updateSalary: async (id, data) => {
    const updated = await requestJson<Salary>(`/salaries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      salaries: state.salaries.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  removeSalary: async (id) => {
    await requestJson<void>(`/salaries/${id}`, { method: 'DELETE' })
    set((state) => ({ salaries: state.salaries.filter((entry) => entry.id !== id) }))
  },
  addTransaction: async (transaction) => {
    const created = await requestJson<Transaction>(`/${transaction.type === 'expense' ? 'expenses' : transaction.type === 'want' ? 'wants' : 'savings'}`, {
      method: 'POST',
      body: JSON.stringify(transaction),
    })
    set((state) => ({ transactions: [created, ...state.transactions] }))
  },
  updateTransaction: async (id, data) => {
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
    const current = get().transactions.find((entry) => entry.id === id)
    if (!current) return
    await requestJson<void>(`/${current.type === 'expense' ? 'expenses' : current.type === 'want' ? 'wants' : 'savings'}/${id}`, {
      method: 'DELETE',
    })
    set((state) => ({ transactions: state.transactions.filter((entry) => entry.id !== id) }))
  },
  addWishlistItem: async (item) => {
    const created = await requestJson<WishlistItem>('/wishlist', {
      method: 'POST',
      body: JSON.stringify(item),
    })
    set((state) => ({ wishlist: [created, ...state.wishlist] }))
  },
  updateWishlistItem: async (id, data) => {
    const updated = await requestJson<WishlistItem>(`/wishlist/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      wishlist: state.wishlist.map((item) => (item.id === id ? updated : item)),
    }))
  },
  removeWishlistItem: async (id) => {
    await requestJson<void>(`/wishlist/${id}`, { method: 'DELETE' })
    set((state) => ({ wishlist: state.wishlist.filter((item) => item.id !== id) }))
  },
  addDebt: async (debt) => {
    const created = await requestJson<Debt>('/debts', {
      method: 'POST',
      body: JSON.stringify(debt),
    })
    set((state) => ({ debts: [created, ...state.debts] }))
  },
  updateDebt: async (id, data) => {
    const updated = await requestJson<Debt>(`/debts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      debts: state.debts.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  removeDebt: async (id) => {
    await requestJson<void>(`/debts/${id}`, { method: 'DELETE' })
    set((state) => ({ debts: state.debts.filter((entry) => entry.id !== id) }))
  },
  addEvent: async (event) => {
    const created = await requestJson<AppEvent>('/events', {
      method: 'POST',
      body: JSON.stringify(event),
    })
    set((state) => ({ events: [created, ...state.events] }))
  },
  updateEvent: async (id, data) => {
    const updated = await requestJson<AppEvent>(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      events: state.events.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  removeEvent: async (id) => {
    await requestJson<void>(`/events/${id}`, { method: 'DELETE' })
    set((state) => ({ events: state.events.filter((entry) => entry.id !== id) }))
  },
  addProjection: async (projection) => {
    const created = await requestJson<Projection>('/projections', {
      method: 'POST',
      body: JSON.stringify(projection),
    })
    set((state) => ({ projections: [created, ...state.projections] }))
  },
  updateProjection: async (id, data) => {
    const updated = await requestJson<Projection>(`/projections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      projections: state.projections.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  removeProjection: async (id) => {
    await requestJson<void>(`/projections/${id}`, { method: 'DELETE' })
    set((state) => ({ projections: state.projections.filter((entry) => entry.id !== id) }))
  },
  addReminder: async (reminder) => {
    const created = await requestJson<Reminder>('/reminders', {
      method: 'POST',
      body: JSON.stringify(reminder),
    })
    set((state) => ({ reminders: [created, ...state.reminders] }))
  },
  updateReminder: async (id, data) => {
    const updated = await requestJson<Reminder>(`/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      reminders: state.reminders.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  toggleReminder: async (id) => {
    const updated = await requestJson<Reminder>(`/reminders/${id}/toggle`, {
      method: 'PATCH',
    })
    set((state) => ({
      reminders: state.reminders.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  removeReminder: async (id) => {
    await requestJson<void>(`/reminders/${id}`, { method: 'DELETE' })
    set((state) => ({ reminders: state.reminders.filter((entry) => entry.id !== id) }))
  },
}))
