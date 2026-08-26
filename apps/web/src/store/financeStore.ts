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
import {
  carrySalaryForwardToMonth,
  createEmptyBootstrapPayload,
  getMonthKey,
  normalizeBootstrapPayload,
  normalizeSalaryHistory,
} from '@plata/shared'

import { parseExpenseDescription } from '@/lib/expense-utils'
import { isNetworkRequestError, requestJson } from '@/lib/api'
import { hasPendingSync, isOnline, markPendingSync, persistCachedBootstrap, readCachedBootstrap } from '@/lib/offline'
import { parseWantDescription } from '@/lib/want-utils'
import { useAuthStore } from '@/store/authStore'
import { usePreferencesStore } from '@/store/preferencesStore'

const GUEST_FINANCE_STORAGE_KEY = 'plata-guest-finance'

type DebtInput = Omit<Debt, 'id' | 'paidAmount' | 'remainingAmount' | 'progress' | 'isSettled'> & {
  initialPayment?: number
}

interface FinanceStore extends BootstrapPayload {
  hasLoaded: boolean
  loadedKey: string | null
  hydrate: () => Promise<void>
  syncPendingChanges: () => Promise<boolean>
  reset: () => void
  addSalary: (salary: Omit<Salary, 'id'>) => Promise<void>
  updateSalary: (id: string, data: Partial<Omit<Salary, 'id'>>) => Promise<void>
  removeSalary: (id: string) => Promise<void>
  addTransaction: (t: Omit<Transaction, 'id'>) => Promise<Transaction>
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
    direction: entry.direction === 'receivable' ? 'receivable' : 'payable',
    counterparty: entry.counterparty ? String(entry.counterparty) : undefined,
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
          createdAt: payment.createdAt ? String(payment.createdAt) : undefined,
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

function buildMonthlyPlanningHistory(transactions: Transaction[]): MonthlyPlanningHistory {
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

function buildSnapshotFromState(state: BootstrapPayload, next?: Partial<BootstrapPayload>): BootstrapPayload {
  return {
    salaries: next?.salaries ?? state.salaries,
    transactions: next?.transactions ?? state.transactions,
    debts: next?.debts ?? state.debts,
    wishlist: next?.wishlist ?? state.wishlist,
    monthlyPlanningHistory: next?.monthlyPlanningHistory ?? state.monthlyPlanningHistory,
    events: next?.events ?? state.events,
    projections: next?.projections ?? state.projections,
    savingsGoals: next?.savingsGoals ?? state.savingsGoals,
    reminders: next?.reminders ?? state.reminders,
  }
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

function getAuthenticatedUserId() {
  const { authMode, user } = useAuthStore.getState()
  if (authMode !== 'authenticated' || !user) return null
  return user.id
}

function isAuthenticatedOfflineMode() {
  return Boolean(getAuthenticatedUserId()) && !isOnline()
}

function isLocalMutationMode() {
  return isGuestMode() || isAuthenticatedOfflineMode()
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function persistLocalSnapshot(snapshot: BootstrapPayload, dirty = false) {
  if (isGuestMode()) {
    persistGuestSnapshot(snapshot)
    return
  }

  const userId = getAuthenticatedUserId()
  if (!userId) return

  void persistCachedBootstrap(userId, snapshot)
  markPendingSync(userId, dirty)
}

function persistRemoteSnapshot(snapshot: BootstrapPayload) {
  if (isGuestMode()) {
    persistGuestSnapshot(snapshot)
    return
  }

  const userId = getAuthenticatedUserId()
  if (!userId) return

  void persistCachedBootstrap(userId, snapshot)
  markPendingSync(userId, false)
}

function shouldFallbackToLocalMutation(error: unknown) {
  return Boolean(getAuthenticatedUserId()) && isNetworkRequestError(error)
}

function updateLocalState(
  set: (recipe: (state: FinanceStore) => Partial<FinanceStore>) => void,
  recipe: (state: FinanceStore) => Partial<BootstrapPayload>,
) {
  set((state) => {
    const next = recipe(state)
    persistLocalSnapshot(buildSnapshotFromState(state, next), !isGuestMode())
    return next
  })
}

function updateRemoteState(
  set: (recipe: (state: FinanceStore) => Partial<FinanceStore>) => void,
  recipe: (state: FinanceStore) => Partial<BootstrapPayload>,
) {
  set((state) => {
    const next = recipe(state)
    persistRemoteSnapshot(buildSnapshotFromState(state, next))
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
      const snapshot = normalizeBootstrapSnapshot(getGuestSnapshot())
      const salaries = carrySalaryForwardToMonth(
        snapshot.salaries,
        getMonthKey(),
        () => makeId('salary'),
      )
      const nextSnapshot = { ...snapshot, salaries }
      persistGuestSnapshot(nextSnapshot)
      set({
        ...nextSnapshot,
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

    const userId = getAuthenticatedUserId()
    if (!userId) return

    const cachedSnapshot = normalizeBootstrapSnapshot(await readCachedBootstrap(userId))

    if (!isOnline()) {
      const salaries = carrySalaryForwardToMonth(
        cachedSnapshot.salaries,
        getMonthKey(),
        () => makeId('salary'),
      )
      const nextSnapshot = { ...cachedSnapshot, salaries }
      await persistCachedBootstrap(userId, nextSnapshot)
      markPendingSync(userId, salaries.length !== cachedSnapshot.salaries.length || hasPendingSync(userId))
      set({
        ...nextSnapshot,
        hasLoaded: true,
        loadedKey: activeKey,
      })
      return
    }

    try {
      const payload = await requestJson<BootstrapPayload>('/bootstrap')
      await persistCachedBootstrap(userId, payload)
      markPendingSync(userId, false)
      set({
        ...normalizeBootstrapSnapshot(payload),
        hasLoaded: true,
        loadedKey: activeKey,
      })
    } catch (error) {
      if (isNetworkRequestError(error)) {
        set({
          ...cachedSnapshot,
          hasLoaded: true,
          loadedKey: activeKey,
        })
        return
      }

      useAuthStore.getState().logout().catch(() => {})
      set({
        ...getEmptyState(),
        hasLoaded: false,
        loadedKey: null,
      })
    }
  },
  syncPendingChanges: async () => {
    const userId = getAuthenticatedUserId()
    if (!userId || !isOnline() || !hasPendingSync(userId)) {
      return false
    }

    const snapshot = buildSnapshotFromState(get())
    const synced = await requestJson<BootstrapPayload>('/bootstrap/sync', {
      method: 'PUT',
      body: JSON.stringify(snapshot),
    })

    await persistCachedBootstrap(userId, synced)
    markPendingSync(userId, false)
    set({
      ...normalizeBootstrapSnapshot(synced),
      hasLoaded: true,
      loadedKey: `user:${userId}`,
    })

    return true
  },
  reset: () => {
    set({
      ...getEmptyState(),
      hasLoaded: false,
      loadedKey: null,
    })
  },
  addSalary: async (salary) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        salaries: normalizeSalaryHistory(
          state.salaries.some((entry) => entry.month === salary.month)
            ? state.salaries.map((entry) => (
                entry.month === salary.month ? { ...entry, amount: salary.amount } : entry
              ))
            : [{ ...salary, id: makeId('salary') }, ...state.salaries],
        ),
      }))
      return
    }

    try {
      const created = await requestJson<Salary>('/salaries', {
        method: 'POST',
        body: JSON.stringify(salary),
      })
      updateRemoteState(set, (state) => ({
        salaries: normalizeSalaryHistory([
          created,
          ...state.salaries.filter((entry) => entry.month !== created.month),
        ]),
      }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        salaries: normalizeSalaryHistory(
          state.salaries.some((entry) => entry.month === salary.month)
            ? state.salaries.map((entry) => (
                entry.month === salary.month ? { ...entry, amount: salary.amount } : entry
              ))
            : [{ ...salary, id: makeId('salary') }, ...state.salaries],
        ),
      }))
    }
  },
  updateSalary: async (id, data) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        salaries: normalizeSalaryHistory(
          state.salaries.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
        ),
      }))
      return
    }

    try {
      const updated = await requestJson<Salary>(`/salaries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      updateRemoteState(set, (state) => ({
        salaries: normalizeSalaryHistory(
          state.salaries.map((entry) => (entry.id === id ? updated : entry)),
        ),
      }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        salaries: normalizeSalaryHistory(
          state.salaries.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
        ),
      }))
    }
  },
  removeSalary: async (id) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        salaries: state.salaries.filter((entry) => entry.id !== id),
      }))
      return
    }

    try {
      await requestJson<void>(`/salaries/${id}`, { method: 'DELETE' })
      updateRemoteState(set, (state) => ({ salaries: state.salaries.filter((entry) => entry.id !== id) }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        salaries: state.salaries.filter((entry) => entry.id !== id),
      }))
    }
  },
  addTransaction: async (transaction) => {
    if (transaction.type === 'want' && usePreferencesStore.getState().formula.wants === 0) {
      throw new Error('La sección Gustos está desactivada porque su porcentaje es 0%.')
    }

    if (isLocalMutationMode()) {
      const created = { ...transaction, id: makeId(transaction.type), createdAt: new Date().toISOString() }
      updateLocalState(set, (state) => ({
        transactions: [created, ...state.transactions],
      }))
      return created
    }

    try {
      const created = await requestJson<Transaction>(`/${transaction.type === 'expense' ? 'expenses' : transaction.type === 'want' ? 'wants' : 'savings'}`, {
        method: 'POST',
        body: JSON.stringify(transaction),
      })
      updateRemoteState(set, (state) => ({ transactions: [created, ...state.transactions] }))
      return created
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      const created = { ...transaction, id: makeId(transaction.type), createdAt: new Date().toISOString() }
      updateLocalState(set, (state) => ({
        transactions: [created, ...state.transactions],
      }))
      return created
    }
  },
  updateTransaction: async (id, data) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        transactions: state.transactions.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }

    const current = get().transactions.find((entry) => entry.id === id)
    const type = data.type ?? current?.type
    if (!type) return
    try {
      const updated = await requestJson<Transaction>(`/${type === 'expense' ? 'expenses' : type === 'want' ? 'wants' : 'savings'}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      updateRemoteState(set, (state) => ({
        transactions: state.transactions.map((entry) => (entry.id === id ? updated : entry)),
      }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        transactions: state.transactions.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
    }
  },
  removeTransaction: async (id) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        transactions: state.transactions.filter((entry) => entry.id !== id),
      }))
      return
    }

    const current = get().transactions.find((entry) => entry.id === id)
    if (!current) return
    try {
      await requestJson<void>(`/${current.type === 'expense' ? 'expenses' : current.type === 'want' ? 'wants' : 'savings'}/${id}`, {
        method: 'DELETE',
      })
      updateRemoteState(set, (state) => ({ transactions: state.transactions.filter((entry) => entry.id !== id) }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        transactions: state.transactions.filter((entry) => entry.id !== id),
      }))
    }
  },
  addWishlistItem: async (item) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        wishlist: [{ ...item, id: makeId('wishlist') }, ...state.wishlist],
      }))
      return
    }

    try {
      const created = await requestJson<WishlistItem>('/wishlist', {
        method: 'POST',
        body: JSON.stringify(item),
      })
      updateRemoteState(set, (state) => ({ wishlist: [created, ...state.wishlist] }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        wishlist: [{ ...item, id: makeId('wishlist') }, ...state.wishlist],
      }))
    }
  },
  updateWishlistItem: async (id, data) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        wishlist: state.wishlist.map((item) => (item.id === id ? { ...item, ...data } : item)),
      }))
      return
    }

    const current = get().wishlist.find((item) => item.id === id)
    if (!current) return

    try {
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
      updateRemoteState(set, (state) => ({
        wishlist: state.wishlist.map((item) => (item.id === id ? updated : item)),
      }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        wishlist: state.wishlist.map((item) => (item.id === id ? { ...item, ...data } : item)),
      }))
    }
  },
  removeWishlistItem: async (id) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        wishlist: state.wishlist.filter((item) => item.id !== id),
      }))
      return
    }

    try {
      await requestJson<void>(`/wishlist/${id}`, { method: 'DELETE' })
      updateRemoteState(set, (state) => ({ wishlist: state.wishlist.filter((item) => item.id !== id) }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        wishlist: state.wishlist.filter((item) => item.id !== id),
      }))
    }
  },
  resetMonthlyPlans: async () => {
    const snapshot = buildMonthlyPlanningHistory(get().transactions)

    const nextTransactions = get().transactions.filter(
      (transaction) => transaction.type !== 'expense' && transaction.type !== 'want',
    )

    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        transactions: nextTransactions,
        savingsGoals: state.savingsGoals.map((goal) => ({ ...goal, currentAmount: 0 })),
        monthlyPlanningHistory: [snapshot, ...state.monthlyPlanningHistory],
      }))
      return
    }

    try {
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

      updateRemoteState(set, (state) => ({
        transactions: nextTransactions,
        savingsGoals: state.savingsGoals.map((goal) => ({ ...goal, currentAmount: 0 })),
        monthlyPlanningHistory: [created, ...state.monthlyPlanningHistory],
      }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        transactions: nextTransactions,
        savingsGoals: state.savingsGoals.map((goal) => ({ ...goal, currentAmount: 0 })),
        monthlyPlanningHistory: [snapshot, ...state.monthlyPlanningHistory],
      }))
    }
  },
  restoreMonthlyPlan: async (id, scope = 'all') => {
    const history = get().monthlyPlanningHistory.find((entry) => entry.id === id)
    if (!history) return
    const wantsDisabled = usePreferencesStore.getState().formula.wants === 0
    if (wantsDisabled && (scope === 'wants' || (scope === 'all' && history.wants.length > 0))) {
      throw new Error('No puedes restaurar gustos porque esa sección tiene una asignación de 0%.')
    }

    const restoredTransactions = buildTransactionsFromHistory(history, scope)
    if (restoredTransactions.length === 0) return

    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        transactions: [
          ...restoredTransactions.map((transaction) => ({ ...transaction, id: makeId(transaction.type), createdAt: new Date().toISOString() })),
          ...state.transactions,
        ],
      }))
      return
    }

    try {
      const created = await requestJson<Transaction[]>(`/monthly-plans/${id}/restore`, {
        method: 'POST',
        body: JSON.stringify({ scope }),
      })

      updateRemoteState(set, (state) => ({
        transactions: [...created, ...state.transactions],
      }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        transactions: [
          ...restoredTransactions.map((transaction) => ({ ...transaction, id: makeId(transaction.type), createdAt: new Date().toISOString() })),
          ...state.transactions,
        ],
      }))
    }
  },
  addDebt: async (debt) => {
    if (isLocalMutationMode()) {
      const paidAmount = Math.min(debt.amount, Math.max(0, debt.initialPayment ?? 0))
      const remainingAmount = Math.max(0, debt.amount - paidAmount)
      updateLocalState(set, (state) => ({
        debts: [{
          id: makeId('debt'),
          direction: debt.direction === 'receivable' ? 'receivable' : 'payable',
          counterparty: debt.counterparty,
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
            ? [{ amount: paidAmount, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString() }]
            : [],
        }, ...state.debts],
      }))
      return
    }

    try {
      const created = await requestJson<Debt>('/debts', {
        method: 'POST',
        body: JSON.stringify(debt),
      })
      updateRemoteState(set, (state) => ({ debts: [normalizeDebt(created), ...state.debts] }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      const paidAmount = Math.min(debt.amount, Math.max(0, debt.initialPayment ?? 0))
      const remainingAmount = Math.max(0, debt.amount - paidAmount)
      updateLocalState(set, (state) => ({
        debts: [{
          id: makeId('debt'),
          direction: debt.direction === 'receivable' ? 'receivable' : 'payable',
          counterparty: debt.counterparty,
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
            ? [{ amount: paidAmount, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString() }]
            : [],
        }, ...state.debts],
      }))
    }
  },
  updateDebt: async (id, data) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
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

    try {
      const updated = await requestJson<Debt>(`/debts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      updateRemoteState(set, (state) => ({
        debts: state.debts.map((entry) => (entry.id === id ? normalizeDebt(updated) : entry)),
      }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
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
    }
  },
  payDebt: async (id, amount) => {
    if (amount <= 0) return

    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
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
            payments: [...(entry.payments ?? []), { amount, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString() }],
          }
        }),
      }))
      return
    }

    try {
      const updated = await requestJson<Debt>(`/debts/${id}/pay`, {
        method: 'PATCH',
        body: JSON.stringify({ amount }),
      })
      updateRemoteState(set, (state) => ({
        debts: state.debts.map((entry) => (entry.id === id ? normalizeDebt(updated) : entry)),
      }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
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
            payments: [...(entry.payments ?? []), { amount, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString() }],
          }
        }),
      }))
    }
  },
  removeDebt: async (id) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        debts: state.debts.filter((entry) => entry.id !== id),
      }))
      return
    }

    try {
      await requestJson<void>(`/debts/${id}`, { method: 'DELETE' })
      updateRemoteState(set, (state) => ({ debts: state.debts.filter((entry) => entry.id !== id) }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        debts: state.debts.filter((entry) => entry.id !== id),
      }))
    }
  },
  addEvent: async (event) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        events: [{ ...event, id: makeId('event') }, ...state.events],
      }))
      return
    }

    try {
      const created = await requestJson<AppEvent>('/events', {
        method: 'POST',
        body: JSON.stringify(event),
      })
      updateRemoteState(set, (state) => ({ events: [created, ...state.events] }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        events: [{ ...event, id: makeId('event') }, ...state.events],
      }))
    }
  },
  updateEvent: async (id, data) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        events: state.events.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }

    try {
      const updated = await requestJson<AppEvent>(`/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      updateRemoteState(set, (state) => ({
        events: state.events.map((entry) => (entry.id === id ? updated : entry)),
      }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        events: state.events.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
    }
  },
  removeEvent: async (id) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        events: state.events.filter((entry) => entry.id !== id),
      }))
      return
    }

    try {
      await requestJson<void>(`/events/${id}`, { method: 'DELETE' })
      updateRemoteState(set, (state) => ({ events: state.events.filter((entry) => entry.id !== id) }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        events: state.events.filter((entry) => entry.id !== id),
      }))
    }
  },
  addProjection: async (projection) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        projections: [{ ...projection, id: makeId('projection') }, ...state.projections],
      }))
      return
    }

    try {
      const created = await requestJson<Projection>('/projections', {
        method: 'POST',
        body: JSON.stringify(projection),
      })
      updateRemoteState(set, (state) => ({ projections: [created, ...state.projections] }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        projections: [{ ...projection, id: makeId('projection') }, ...state.projections],
      }))
    }
  },
  updateProjection: async (id, data) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        projections: state.projections.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }

    try {
      const updated = await requestJson<Projection>(`/projections/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      updateRemoteState(set, (state) => ({
        projections: state.projections.map((entry) => (entry.id === id ? updated : entry)),
      }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        projections: state.projections.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
    }
  },
  removeProjection: async (id) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        projections: state.projections.filter((entry) => entry.id !== id),
      }))
      return
    }

    try {
      await requestJson<void>(`/projections/${id}`, { method: 'DELETE' })
      updateRemoteState(set, (state) => ({ projections: state.projections.filter((entry) => entry.id !== id) }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        projections: state.projections.filter((entry) => entry.id !== id),
      }))
    }
  },
  addSavingsGoal: async (goal) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        savingsGoals: [{ ...goal, id: makeId('savings-goal') }, ...state.savingsGoals],
      }))
      return
    }

    try {
      const created = await requestJson<SavingsGoal>('/savings-goals', {
        method: 'POST',
        body: JSON.stringify(goal),
      })
      updateRemoteState(set, (state) => ({ savingsGoals: [created, ...state.savingsGoals] }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        savingsGoals: [{ ...goal, id: makeId('savings-goal') }, ...state.savingsGoals],
      }))
    }
  },
  updateSavingsGoal: async (id, data) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        savingsGoals: state.savingsGoals.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }

    const current = get().savingsGoals.find((entry) => entry.id === id)
    if (!current) return

    try {
      const updated = await requestJson<SavingsGoal>(`/savings-goals/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...current, ...data }),
      })
      updateRemoteState(set, (state) => ({
        savingsGoals: state.savingsGoals.map((entry) => (entry.id === id ? updated : entry)),
      }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        savingsGoals: state.savingsGoals.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
    }
  },
  removeSavingsGoal: async (id) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        savingsGoals: state.savingsGoals.filter((entry) => entry.id !== id),
      }))
      return
    }

    try {
      await requestJson<void>(`/savings-goals/${id}`, { method: 'DELETE' })
      updateRemoteState(set, (state) => ({ savingsGoals: state.savingsGoals.filter((entry) => entry.id !== id) }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        savingsGoals: state.savingsGoals.filter((entry) => entry.id !== id),
      }))
    }
  },
  addReminder: async (reminder) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        reminders: [{ ...reminder, id: makeId('reminder') }, ...state.reminders],
      }))
      return
    }

    try {
      const created = await requestJson<Reminder>('/reminders', {
        method: 'POST',
        body: JSON.stringify(reminder),
      })
      updateRemoteState(set, (state) => ({ reminders: [created, ...state.reminders] }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        reminders: [{ ...reminder, id: makeId('reminder') }, ...state.reminders],
      }))
    }
  },
  updateReminder: async (id, data) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        reminders: state.reminders.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }

    try {
      const updated = await requestJson<Reminder>(`/reminders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      updateRemoteState(set, (state) => ({
        reminders: state.reminders.map((entry) => (entry.id === id ? updated : entry)),
      }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        reminders: state.reminders.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
    }
  },
  toggleReminder: async (id) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        reminders: state.reminders.map((entry) => (entry.id === id ? { ...entry, completed: !entry.completed } : entry)),
      }))
      return
    }

    try {
      const updated = await requestJson<Reminder>(`/reminders/${id}/toggle`, {
        method: 'PATCH',
      })
      updateRemoteState(set, (state) => ({
        reminders: state.reminders.map((entry) => (entry.id === id ? updated : entry)),
      }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        reminders: state.reminders.map((entry) => (entry.id === id ? { ...entry, completed: !entry.completed } : entry)),
      }))
    }
  },
  removeReminder: async (id) => {
    if (isLocalMutationMode()) {
      updateLocalState(set, (state) => ({
        reminders: state.reminders.filter((entry) => entry.id !== id),
      }))
      return
    }

    try {
      await requestJson<void>(`/reminders/${id}`, { method: 'DELETE' })
      updateRemoteState(set, (state) => ({ reminders: state.reminders.filter((entry) => entry.id !== id) }))
    } catch (error) {
      if (!shouldFallbackToLocalMutation(error)) throw error

      updateLocalState(set, (state) => ({
        reminders: state.reminders.filter((entry) => entry.id !== id),
      }))
    }
  },
}))
