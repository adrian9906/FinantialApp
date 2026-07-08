import { create } from 'zustand'
import type {
  AppEvent,
  BootstrapPayload,
  Debt,
  MonthlyPlanningHistory,
  MonthlyPlanningItem,
  Projection,
  Reminder,
  Salary,
  SavingsGoal,
  Transaction,
  WishlistItem,
} from '@plata/shared'
import { createEmptyBootstrapPayload, normalizeBootstrapPayload } from '@plata/shared'

import { parseExpenseDescription } from '@/lib/expense-utils'
import { requestJson } from '@/lib/api'
import { parseWantDescription } from '@/lib/want-utils'
import { useAuthStore } from '@/store/authStore'

const GUEST_FINANCE_STORAGE_KEY = 'plata-guest-finance'

type DebtInput = Omit<Debt, 'id' | 'paidAmount' | 'remainingAmount' | 'progress' | 'isSettled'> & {
  initialPayment?: number
}

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
  resetMonthlyPlans: () => Promise<void>
  restoreMonthlyPlan: (id: string, scope?: 'expenses' | 'wants' | 'all') => Promise<void>
  addDebt: (d: DebtInput) => Promise<void>
  updateDebt: (id: string, data: Partial<Omit<Debt, 'id'>>) => Promise<void>
  payDebt: (id: string, amount: number) => Promise<void>
  removeDebt: (id: string) => Promise<void>
  addEvent: (e: Omit<AppEvent, 'id'>) => Promise<void>
  updateEvent: (id: string, data: Partial<Omit<AppEvent, 'id'>>) => Promise<void>
  removeEvent: (id: string) => Promise<void>
  addProjection: (p: Omit<Projection, 'id'>) => Promise<void>
  updateProjection: (id: string, data: Partial<Omit<Projection, 'id'>>) => Promise<void>
  removeProjection: (id: string) => Promise<void>
  addSavingsGoal: (goal: Omit<SavingsGoal, 'id'>) => Promise<void>
  updateSavingsGoal: (id: string, data: Partial<Omit<SavingsGoal, 'id'>>) => Promise<void>
  removeSavingsGoal: (id: string) => Promise<void>
  addReminder: (r: Omit<Reminder, 'id'>) => Promise<void>
  updateReminder: (id: string, data: Partial<Omit<Reminder, 'id'>>) => Promise<void>
  toggleReminder: (id: string) => Promise<void>
  removeReminder: (id: string) => Promise<void>
}

function getEmptyState(): BootstrapPayload {
  return createEmptyBootstrapPayload()
}

function normalizeDebt(entry: Partial<Debt>): Debt {
  const amount = Number(entry.amount ?? 0)
  const paidAmount = Math.max(0, Number(entry.paidAmount ?? 0))
  const remainingAmount = Math.max(0, Number(entry.remainingAmount ?? (amount - paidAmount)))
  const progress = amount > 0
    ? Math.min(100, Math.round((Math.min(amount, paidAmount) / amount) * 100))
    : 0

  return {
    id: String(entry.id ?? makeId('debt')),
    amount,
    history: String(entry.history ?? ''),
    startDate: String(entry.startDate ?? ''),
    endDate: String(entry.endDate ?? ''),
    interest: entry.interest === undefined || entry.interest === null ? undefined : Number(entry.interest),
    paidAmount: Math.min(amount, paidAmount),
    remainingAmount,
    progress: Number.isFinite(Number(entry.progress)) ? Number(entry.progress) : progress,
    isSettled: entry.isSettled ?? remainingAmount === 0,
    payments: Array.isArray(entry.payments)
      ? entry.payments.map((payment) => ({
          amount: Number(payment.amount ?? 0),
          date: String(payment.date ?? new Date().toISOString().slice(0, 10)),
        }))
      : [],
  }
}

function normalizeBootstrapSnapshot(payload?: Partial<BootstrapPayload> | null): BootstrapPayload {
  const snapshot = normalizeBootstrapPayload(payload)

  return {
    ...snapshot,
    debts: snapshot.debts.map(normalizeDebt),
  }
}

function getMonthKey(value = new Date()) {
  return value.toISOString().slice(0, 7)
}

function buildMonthlyPlanningHistory(transactions: Transaction[]): MonthlyPlanningHistory | null {
  const expenses = transactions
    .filter((transaction) => transaction.type === 'expense')
    .map<MonthlyPlanningItem>((transaction) => {
      const parsed = parseExpenseDescription(transaction.description)

      return {
        amount: transaction.amount,
        itemName: parsed.itemName,
        category: parsed.category,
        status: parsed.status,
        date: transaction.date,
      }
    })

  const wants = transactions
    .filter((transaction) => transaction.type === 'want')
    .map<MonthlyPlanningItem>((transaction) => {
      const parsed = parseWantDescription(transaction.description)

      return {
        amount: transaction.amount,
        itemName: parsed.itemName,
        category: parsed.category,
        status: parsed.status,
        date: transaction.date,
      }
    })

  if (expenses.length === 0 && wants.length === 0) return null

  const now = new Date()

  return {
    id: makeId('monthly-plan'),
    month: getMonthKey(now),
    label: now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
    createdAt: now.toISOString(),
    expenses,
    wants,
  }
}

function buildTransactionsFromHistory(
  history: MonthlyPlanningHistory,
  scope: 'expenses' | 'wants' | 'all',
): Array<Omit<Transaction, 'id'>> {
  const today = new Date().toISOString().slice(0, 10)
  const nextTransactions: Array<Omit<Transaction, 'id'>> = []

  if (scope === 'expenses' || scope === 'all') {
    nextTransactions.push(
      ...history.expenses.map((entry) => ({
        amount: entry.amount,
        type: 'expense' as const,
        description: `${entry.category}::${entry.status}::${entry.itemName.trim()}`,
        date: today,
      })),
    )
  }

  if (scope === 'wants' || scope === 'all') {
    nextTransactions.push(
      ...history.wants.map((entry) => ({
        amount: entry.amount,
        type: 'want' as const,
        description: `${entry.category}::${entry.status}::${entry.itemName.trim()}`,
        date: today,
      })),
    )
  }

  return nextTransactions
}

function getGuestSnapshot(): BootstrapPayload {
  if (typeof window === 'undefined') return getEmptyState()

  const raw = window.localStorage.getItem(GUEST_FINANCE_STORAGE_KEY)
  if (!raw) return getEmptyState()

  try {
    const parsed = JSON.parse(raw) as Partial<BootstrapPayload>
    return normalizeBootstrapSnapshot(parsed)
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
      monthlyPlanningHistory: next.monthlyPlanningHistory ?? state.monthlyPlanningHistory,
      events: next.events ?? state.events,
      projections: next.projections ?? state.projections,
      savingsGoals: next.savingsGoals ?? state.savingsGoals,
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
        ...normalizeBootstrapSnapshot(getGuestSnapshot()),
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

    try {
      const payload = await requestJson<BootstrapPayload>('/bootstrap')
      set({
        ...normalizeBootstrapSnapshot(payload),
        hasLoaded: true,
        loadedKey: activeKey,
      })
    } catch {
      useAuthStore.getState().logout().catch(() => {})
      set({
        ...getEmptyState(),
        hasLoaded: false,
        loadedKey: null,
      })
    }
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

    const current = get().wishlist.find((item) => item.id === id)
    if (!current) return

    const updated = await requestJson<WishlistItem>(`/wishlist/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: data.name ?? current.name,
        price: data.price ?? current.price,
        priority: data.priority ?? current.priority,
        savedAmount: data.savedAmount ?? current.savedAmount,
        externalContribution: data.externalContribution ?? current.externalContribution ?? 0,
        isPurchased: data.isPurchased ?? current.isPurchased ?? false,
        image: data.image ?? current.image,
        sourceStore: data.sourceStore ?? current.sourceStore,
        sourceUrl: data.sourceUrl ?? current.sourceUrl,
        sourceCurrency: data.sourceCurrency ?? current.sourceCurrency,
      }),
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
  resetMonthlyPlans: async () => {
    const snapshot = buildMonthlyPlanningHistory(get().transactions)
    if (!snapshot) return

    const nextTransactions = get().transactions.filter(
      (transaction) => transaction.type !== 'expense' && transaction.type !== 'want',
    )

    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        transactions: nextTransactions,
        monthlyPlanningHistory: [snapshot, ...state.monthlyPlanningHistory],
      }))
      return
    }

    const created = await requestJson<MonthlyPlanningHistory>('/monthly-plans/reset', {
      method: 'POST',
      body: JSON.stringify({
        month: snapshot.month,
        label: snapshot.label,
        expenseIds: get().transactions.filter((transaction) => transaction.type === 'expense').map((transaction) => transaction.id),
        wantIds: get().transactions.filter((transaction) => transaction.type === 'want').map((transaction) => transaction.id),
        expenses: snapshot.expenses,
        wants: snapshot.wants,
      }),
    })

    set((state) => ({
      transactions: nextTransactions,
      monthlyPlanningHistory: [created, ...state.monthlyPlanningHistory],
    }))
  },
  restoreMonthlyPlan: async (id, scope = 'all') => {
    const history = get().monthlyPlanningHistory.find((entry) => entry.id === id)
    if (!history) return

    const restoredTransactions = buildTransactionsFromHistory(history, scope)
    if (restoredTransactions.length === 0) return

    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        transactions: [
          ...restoredTransactions.map((transaction) => ({ ...transaction, id: makeId(transaction.type) })),
          ...state.transactions,
        ],
      }))
      return
    }

    const created = await requestJson<Transaction[]>(`/monthly-plans/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ scope }),
    })

    set((state) => ({
      transactions: [...created, ...state.transactions],
    }))
  },
  addDebt: async (debt) => {
    if (isGuestMode()) {
      const paidAmount = Math.min(debt.amount, Math.max(0, debt.initialPayment ?? 0))
      const remainingAmount = Math.max(0, debt.amount - paidAmount)
      updateGuestState(set, (state) => ({
        debts: [{
          id: makeId('debt'),
          amount: debt.amount,
          history: debt.history,
          startDate: debt.startDate,
          endDate: debt.endDate,
          interest: debt.interest,
          paidAmount,
          remainingAmount,
          progress: debt.amount > 0 ? Math.min(100, Math.round((paidAmount / debt.amount) * 100)) : 100,
          isSettled: remainingAmount === 0,
          payments: paidAmount > 0
            ? [{ amount: paidAmount, date: new Date().toISOString().slice(0, 10) }]
            : [],
        }, ...state.debts],
      }))
      return
    }

    const created = await requestJson<Debt>('/debts', {
      method: 'POST',
      body: JSON.stringify(debt),
    })
    set((state) => ({ debts: [normalizeDebt(created), ...state.debts] }))
  },
  updateDebt: async (id, data) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        debts: state.debts.map((entry) => {
          if (entry.id !== id) return entry
          const nextAmount = data.amount ?? entry.amount
          const nextPaidAmount = Math.min(nextAmount, data.paidAmount ?? entry.paidAmount)
          const nextRemainingAmount = Math.max(0, nextAmount - nextPaidAmount)
          return {
            ...entry,
            ...data,
            amount: nextAmount,
            paidAmount: nextPaidAmount,
            remainingAmount: nextRemainingAmount,
            progress: nextAmount > 0 ? Math.min(100, Math.round((nextPaidAmount / nextAmount) * 100)) : 100,
            isSettled: nextRemainingAmount === 0,
            payments: entry.payments ?? [],
          }
        }),
      }))
      return
    }

    const updated = await requestJson<Debt>(`/debts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      debts: state.debts.map((entry) => (entry.id === id ? normalizeDebt(updated) : entry)),
    }))
  },
  payDebt: async (id, amount) => {
    if (amount <= 0) return

    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        debts: state.debts.map((entry) => {
          if (entry.id !== id) return entry
          const nextPaidAmount = Math.min(entry.amount, entry.paidAmount + amount)
          const nextRemainingAmount = Math.max(0, entry.amount - nextPaidAmount)
          return {
            ...entry,
            paidAmount: nextPaidAmount,
            remainingAmount: nextRemainingAmount,
            progress: entry.amount > 0 ? Math.min(100, Math.round((nextPaidAmount / entry.amount) * 100)) : 100,
            isSettled: nextRemainingAmount === 0,
            payments: [...(entry.payments ?? []), { amount, date: new Date().toISOString().slice(0, 10) }],
          }
        }),
      }))
      return
    }

    const updated = await requestJson<Debt>(`/debts/${id}/pay`, {
      method: 'PATCH',
      body: JSON.stringify({ amount }),
    })
    set((state) => ({
      debts: state.debts.map((entry) => (entry.id === id ? normalizeDebt(updated) : entry)),
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
  addSavingsGoal: async (goal) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        savingsGoals: [{ ...goal, id: makeId('savings-goal') }, ...state.savingsGoals],
      }))
      return
    }

    const created = await requestJson<SavingsGoal>('/savings-goals', {
      method: 'POST',
      body: JSON.stringify(goal),
    })
    set((state) => ({ savingsGoals: [created, ...state.savingsGoals] }))
  },
  updateSavingsGoal: async (id, data) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        savingsGoals: state.savingsGoals.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }

    const updated = await requestJson<SavingsGoal>(`/savings-goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    set((state) => ({
      savingsGoals: state.savingsGoals.map((entry) => (entry.id === id ? updated : entry)),
    }))
  },
  removeSavingsGoal: async (id) => {
    if (isGuestMode()) {
      updateGuestState(set, (state) => ({
        savingsGoals: state.savingsGoals.filter((entry) => entry.id !== id),
      }))
      return
    }

    await requestJson<void>(`/savings-goals/${id}`, { method: 'DELETE' })
    set((state) => ({ savingsGoals: state.savingsGoals.filter((entry) => entry.id !== id) }))
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
