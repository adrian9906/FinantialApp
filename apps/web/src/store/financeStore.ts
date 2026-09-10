import { create } from 'zustand'
import type {
  AppEvent,
  IncomeSource,
  BootstrapPayload,
  Debt,
  MonthlyPlanningHistory,
  MonthlyPlanningItem,
  Projection,
  Reminder,
  Salary,
  SavingsGoal,
  Subscription,
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

import { buildExpenseDescription, parseExpenseDescription } from '@/lib/expense-utils'
import { isNetworkRequestError } from '@/lib/api'
import { isOnline } from '@/lib/offline'
import { isUpgradeRequiredError, queueLocalChange, syncNow } from '@/lib/sync-engine'
import { readSyncDocument } from '@/lib/sync-store'
import { parseWantDescription } from '@/lib/want-utils'
import { applyIncomeMoneyMovement, type IncomeMoneyDestination } from '@/lib/income-money'
import { reconcileIncomeAccountCharge } from '@/lib/income-account'
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
  syncPendingChanges: (reason?: 'silent' | 'reconnect') => Promise<boolean>
  reset: () => void
  addSalary: (salary: Omit<Salary, 'id'>) => Promise<void>
  updateSalary: (id: string, data: Partial<Omit<Salary, 'id'>>) => Promise<void>
  removeSalary: (id: string) => Promise<void>
  addIncomeSource: (source: Omit<IncomeSource, 'id'>) => Promise<void>
  updateIncomeSource: (id: string, data: Partial<Omit<IncomeSource, 'id'>>) => Promise<void>
  removeIncomeSource: (id: string) => Promise<void>
  assignIncomeMoney: (input: { amountUsd: number; month: string; destination: IncomeMoneyDestination }) => Promise<void>
  transferIncomeMoney: (input: { sourceSalaryId: string; amountUsd: number; month: string; destination: IncomeMoneyDestination }) => Promise<void>
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
  addSubscription: (subscription: Omit<Subscription, 'id'>) => Promise<void>
  updateSubscription: (id: string, data: Partial<Omit<Subscription, 'id'>>) => Promise<void>
  removeSubscription: (id: string) => Promise<void>
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

  return ensureCurrentSubscriptionExpenses({
    ...snapshot,
    debts: snapshot.debts.map(normalizeDebt),
  })
}

function getSubscriptionExpenseMarker(subscriptionId: string, month = getMonthKey()) {
  return `[subscription:${subscriptionId}:${month}]`
}

function getSubscriptionExpenseDate(subscription: Subscription, month = getMonthKey()) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const day = Math.min(Math.max(1, subscription.billingDay), lastDay)
  return `${month}-${String(day).padStart(2, '0')}`
}

function createSubscriptionExpense(subscription: Subscription, month = getMonthKey()): Transaction {
  return {
    id: `subscription-expense:${subscription.id}:${month}`,
    amount: subscription.amount,
    type: 'expense',
    description: `services::checked::0::Suscripción · ${subscription.name} ${getSubscriptionExpenseMarker(subscription.id, month)}`,
    date: getSubscriptionExpenseDate(subscription, month),
    createdAt: new Date().toISOString(),
  }
}

function ensureCurrentSubscriptionExpenses(snapshot: BootstrapPayload): BootstrapPayload {
  const month = getMonthKey()
  const missingExpenses = snapshot.subscriptions
    .filter((subscription) => subscription.status === 'active' && subscription.startedAt.slice(0, 7) <= month)
    .filter((subscription) => !snapshot.transactions.some(
      (transaction) => (transaction.description ?? '').includes(getSubscriptionExpenseMarker(subscription.id, month)),
    ))
    .map((subscription) => createSubscriptionExpense(subscription, month))

  if (missingExpenses.length === 0) return snapshot

  return { ...snapshot, transactions: [...missingExpenses, ...snapshot.transactions] }
}

function buildMonthlyPlanningHistory(transactions: Transaction[]): MonthlyPlanningHistory {
  const expenses = transactions.flatMap<MonthlyPlanningItem>((transaction) => {
    if (transaction.type !== 'expense') return []
    const parsed = parseExpenseDescription(transaction.description)

    return [{
      amount: transaction.amount,
      itemName: parsed.itemName,
      category: parsed.category,
      status: parsed.status,
      date: transaction.date,
      unnecessary: parsed.unnecessary,
    }]
  })

  const wants = transactions.flatMap<MonthlyPlanningItem>((transaction) => {
    if (transaction.type !== 'want') return []
    const parsed = parseWantDescription(transaction.description)

    return [{
      amount: transaction.amount,
      itemName: parsed.itemName,
      category: parsed.category,
      status: parsed.status,
      date: transaction.date,
    }]
  })

  const now = new Date()

  return {
    id: makeId('monthly-plan'),
    month: getMonthKey(now),
    label: now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
    createdAt: now.toISOString(),
    expenses,
    wants,
    savingTransactionIds: transactions
      .filter((transaction) => transaction.type === 'saving')
      .map((transaction) => transaction.id),
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
        description: buildExpenseDescription(
          entry.category as ReturnType<typeof parseExpenseDescription>['category'],
          entry.itemName,
          entry.status,
          entry.unnecessary,
        ),
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
    incomeSources: next?.incomeSources ?? state.incomeSources,
    transactions: next?.transactions ?? state.transactions,
    debts: next?.debts ?? state.debts,
    wishlist: next?.wishlist ?? state.wishlist,
    monthlyPlanningHistory: next?.monthlyPlanningHistory ?? state.monthlyPlanningHistory,
    events: next?.events ?? state.events,
    projections: next?.projections ?? state.projections,
    savingsGoals: next?.savingsGoals ?? state.savingsGoals,
    reminders: next?.reminders ?? state.reminders,
    subscriptions: next?.subscriptions ?? state.subscriptions,
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

function isLocalMutationMode() {
  // Always update the on-device snapshot first.  navigator.onLine is not
  // reliable in Capacitor: it can remain true without usable internet.
  // The pending snapshot is uploaded in the background when the API is reachable.
  return isGuestMode() || Boolean(getAuthenticatedUserId())
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function persistLocalSnapshot(snapshot: BootstrapPayload) {
  if (isGuestMode()) {
    persistGuestSnapshot(snapshot)
    return Promise.resolve()
  }

  const userId = getAuthenticatedUserId()
  if (!userId) return Promise.resolve()

  // Queue the change on-device before anything touches the network. The
  // operation log is the pending marker, so a crash here loses nothing.
  return queueLocalChange(userId, snapshot).then(() => undefined)
}

function updateLocalState(
  set: (recipe: (state: FinanceStore) => Partial<FinanceStore>) => void,
  recipe: (state: FinanceStore) => Partial<BootstrapPayload>,
) {
  let snapshot: BootstrapPayload | null = null

  set((state) => {
    const next = recipe(state)
    snapshot = buildSnapshotFromState(state, next)
    return next
  })

  const pendingWrite = snapshot ? persistLocalSnapshot(snapshot) : Promise.resolve()

  void pendingWrite.then(() => {
    if (isGuestMode() || !isOnline()) return
    void useFinanceStore.getState().syncPendingChanges().catch(() => {})
  })

  return pendingWrite
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

    // Always start from the device copy so the app opens with real data even
    // with no network, and so nothing on screen is ever an empty placeholder
    // that could later be written back over the cache.
    const document = await readSyncDocument(userId)
    const cachedSnapshot = normalizeBootstrapSnapshot(document.snapshot)

    set({ ...cachedSnapshot, hasLoaded: true, loadedKey: activeKey })

    const salaries = carrySalaryForwardToMonth(
      cachedSnapshot.salaries,
      getMonthKey(),
      () => makeId('salary'),
    )

    if (salaries.length !== cachedSnapshot.salaries.length) {
      const carried = { ...cachedSnapshot, salaries }
      await persistLocalSnapshot(carried)
      set({ ...carried, hasLoaded: true, loadedKey: activeKey })
    }

    if (!isOnline()) return

    try {
      const synced = await syncNow(userId)
      if (!synced) return

      const normalized = normalizeBootstrapSnapshot(synced.snapshot)
      set({
        ...normalized,
        hasLoaded: true,
        loadedKey: activeKey,
      })
    } catch (error) {
      // Network trouble keeps the device copy on screen with its queue intact.
      if (isNetworkRequestError(error)) return
      if (isUpgradeRequiredError(error)) return

      useAuthStore.getState().logout().catch(() => {})
      set({
        ...getEmptyState(),
        hasLoaded: false,
        loadedKey: null,
      })
    }
  },
  syncPendingChanges: async (reason = 'silent') => {
    const userId = getAuthenticatedUserId()
    if (!userId || !isOnline()) return false

    try {
      const synced = await syncNow(userId, reason)
      if (!synced) return false

      const normalized = normalizeBootstrapSnapshot(synced.snapshot)
      set({
        ...normalized,
        hasLoaded: true,
        loadedKey: `user:${userId}`,
      })

      return synced.operations.length === 0 && synced.conflicts.length === 0
    } catch {
      // Pending operations stay queued for the next attempt.
      return false
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
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => {
        // Replace only the same source in the same month; a different job or a
        // one-off bonus is added alongside instead of overwriting it.
        const sourceKey = salary.sourceId ?? 'legacy'
        const isSameEntry = (entry: Salary) => entry.month === salary.month
          && (entry.sourceId ?? 'legacy') === sourceKey
          && entry.kind !== 'one-off'

        const alreadyRegistered = salary.kind !== 'one-off' && state.salaries.some(isSameEntry)

        return {
          salaries: normalizeSalaryHistory(
            alreadyRegistered
              ? state.salaries.map((entry) => (isSameEntry(entry) ? { ...entry, ...salary } : entry))
              : [{ ...salary, id: makeId('salary') }, ...state.salaries],
          ),
        }
      })
      return
    }
  },
  updateSalary: async (id, data) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        salaries: normalizeSalaryHistory(
          state.salaries.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
        ),
      }))
      return
    }
  },
  removeSalary: async (id) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        salaries: state.salaries.filter((entry) => entry.id !== id),
      }))
      return
    }
  },
  addIncomeSource: async (source) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        incomeSources: [...state.incomeSources, { ...source, id: makeId('income-source') }],
      }))
      return
    }
  },
  updateIncomeSource: async (id, data) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        incomeSources: state.incomeSources.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
        // Keep the stored label in sync so past months show the current name.
        salaries: state.salaries.map((entry) => entry.sourceId === id
          ? {
              ...entry,
              ...(data.name ? { sourceName: data.name } : {}),
              ...(data.recurring !== undefined ? { kind: data.recurring ? 'recurring' as const : 'one-off' as const } : {}),
              ...(data.balanceMode ? { balanceMode: data.balanceMode } : {}),
            }
          : entry),
      }))
      return
    }
  },
  removeIncomeSource: async (id) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        // Past income keeps its recorded name, so history stays readable.
        incomeSources: state.incomeSources.filter((entry) => entry.id !== id),
        salaries: state.salaries.filter((entry) => entry.sourceId !== id),
      }))
      return
    }
  },
  assignIncomeMoney: async (input) => {
    await updateLocalState(set, (state) => applyIncomeMoneyMovement(state, input, makeId))
  },
  transferIncomeMoney: async (input) => {
    await updateLocalState(set, (state) => applyIncomeMoneyMovement(state, input, makeId))
  },
  addTransaction: async (transaction) => {
    if (transaction.type === 'want' && usePreferencesStore.getState().formula.wants === 0) {
      throw new Error('La sección Gustos está desactivada porque su porcentaje es 0%.')
    }

    const created = { ...transaction, id: makeId(transaction.type), createdAt: new Date().toISOString() }
    await updateLocalState(set, (state) => ({
      transactions: [created, ...state.transactions],
      salaries: reconcileIncomeAccountCharge(state.salaries, undefined, created),
    }))
    return created
  },
  updateTransaction: async (id, data) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => {
        const previous = state.transactions.find((entry) => entry.id === id)
        if (!previous) return {}
        const next = { ...previous, ...data }
        return {
          transactions: state.transactions.map((entry) => (entry.id === id ? next : entry)),
          salaries: reconcileIncomeAccountCharge(state.salaries, previous, next),
        }
      })
      return
    }
  },
  removeTransaction: async (id) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => {
        const previous = state.transactions.find((entry) => entry.id === id)
        return {
          transactions: state.transactions.filter((entry) => entry.id !== id),
          salaries: reconcileIncomeAccountCharge(state.salaries, previous, undefined),
        }
      })
      return
    }
  },
  addWishlistItem: async (item) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        wishlist: [{ ...item, id: makeId('wishlist') }, ...state.wishlist],
      }))
      return
    }
  },
  updateWishlistItem: async (id, data) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        wishlist: state.wishlist.map((item) => (item.id === id ? { ...item, ...data } : item)),
      }))
      return
    }
  },
  removeWishlistItem: async (id) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        wishlist: state.wishlist.filter((item) => item.id !== id),
      }))
      return
    }
  },
  resetMonthlyPlans: async () => {
    const snapshot = buildMonthlyPlanningHistory(get().transactions)

    const nextTransactions = get().transactions.filter(
      (transaction) => transaction.type !== 'expense' && transaction.type !== 'want',
    )

    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        transactions: nextTransactions,
        savingsGoals: state.savingsGoals.map((goal) => ({ ...goal, currentAmount: 0 })),
        monthlyPlanningHistory: [snapshot, ...state.monthlyPlanningHistory],
      }))
      return
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
      await updateLocalState(set, (state) => ({
        transactions: [
          ...restoredTransactions.map((transaction) => ({ ...transaction, id: makeId(transaction.type), createdAt: new Date().toISOString() })),
          ...state.transactions,
        ],
      }))
      return
    }
  },
  addDebt: async (debt) => {
    if (isLocalMutationMode()) {
      const paidAmount = Math.min(debt.amount, Math.max(0, debt.initialPayment ?? 0))
      const remainingAmount = Math.max(0, debt.amount - paidAmount)
      await updateLocalState(set, (state) => ({
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
  },
  updateDebt: async (id, data) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
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
  },
  payDebt: async (id, amount) => {
    if (amount <= 0) return

    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
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
  },
  removeDebt: async (id) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        debts: state.debts.filter((entry) => entry.id !== id),
      }))
      return
    }
  },
  addEvent: async (event) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        events: [{ ...event, id: makeId('event') }, ...state.events],
      }))
      return
    }
  },
  updateEvent: async (id, data) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        events: state.events.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }
  },
  removeEvent: async (id) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        events: state.events.filter((entry) => entry.id !== id),
      }))
      return
    }
  },
  addProjection: async (projection) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        projections: [{ ...projection, id: makeId('projection') }, ...state.projections],
      }))
      return
    }
  },
  updateProjection: async (id, data) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        projections: state.projections.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }
  },
  removeProjection: async (id) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        projections: state.projections.filter((entry) => entry.id !== id),
      }))
      return
    }
  },
  addSavingsGoal: async (goal) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        savingsGoals: [{ ...goal, id: makeId('savings-goal') }, ...state.savingsGoals],
      }))
      return
    }
  },
  updateSavingsGoal: async (id, data) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        savingsGoals: state.savingsGoals.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }
  },
  removeSavingsGoal: async (id) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        savingsGoals: state.savingsGoals.filter((entry) => entry.id !== id),
      }))
      return
    }
  },
  addReminder: async (reminder) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        reminders: [{ ...reminder, id: makeId('reminder') }, ...state.reminders],
      }))
      return
    }
  },
  updateReminder: async (id, data) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        reminders: state.reminders.map((entry) => (entry.id === id ? { ...entry, ...data } : entry)),
      }))
      return
    }
  },
  toggleReminder: async (id) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        reminders: state.reminders.map((entry) => (entry.id === id ? { ...entry, completed: !entry.completed } : entry)),
      }))
      return
    }
  },
  removeReminder: async (id) => {
    if (isLocalMutationMode()) {
      await updateLocalState(set, (state) => ({
        reminders: state.reminders.filter((entry) => entry.id !== id),
      }))
      return
    }
  },
  addSubscription: async (subscription) => {
    const createLocal = () => updateLocalState(set, (state) => {
      const created = { ...subscription, id: makeId('subscription') }
      return {
        subscriptions: [created, ...state.subscriptions],
        transactions: [createSubscriptionExpense(created), ...state.transactions],
      }
    })
    await createLocal()
  },
  updateSubscription: async (id, data) => {
    const updateLocal = () => updateLocalState(set, (state) => {
      const subscription = state.subscriptions.find((entry) => entry.id === id)
      if (!subscription) return {}
      const updated = { ...subscription, ...data }
      const marker = getSubscriptionExpenseMarker(id)
      return {
        subscriptions: state.subscriptions.map((entry) => entry.id === id ? updated : entry),
        transactions: state.transactions.map((transaction) => (transaction.description ?? '').includes(marker)
          ? { ...transaction, amount: updated.amount, date: getSubscriptionExpenseDate(updated), description: createSubscriptionExpense(updated).description }
          : transaction),
      }
    })
    await updateLocal()
  },
  removeSubscription: async (id) => {
    const removeLocal = () => updateLocalState(set, (state) => ({ subscriptions: state.subscriptions.filter((entry) => entry.id !== id) }))
    await removeLocal()
  },
}))
