import { create } from 'zustand'
import type { Debt, DebtPayment } from '@plata/shared'

const RECEIVABLES_STORAGE_KEY = 'plata-receivables'

type ReceivableInput = {
  counterparty: string
  history: string
  amount: number
  interest?: number
  startDate: string
  endDate: string
}

interface ReceivablesStore {
  receivables: Debt[]
  hasLoaded: boolean
  hydrate: () => void
  addReceivable: (data: ReceivableInput) => void
  updateReceivable: (id: string, data: Partial<Omit<Debt, 'id'>>) => void
  markCollected: (id: string) => void
  removeReceivable: (id: string) => void
}

function makeId() {
  return `recv-${crypto.randomUUID()}`
}

function normalizeReceivable(entry: Partial<Debt>): Debt {
  const amount = Number(entry.amount ?? 0)
  const paidAmount = Math.max(0, Number(entry.paidAmount ?? 0))
  const remainingAmount = Math.max(0, Number(entry.remainingAmount ?? (amount - paidAmount)))
  const progress = amount > 0
    ? Math.min(100, Math.round((Math.min(amount, paidAmount) / amount) * 100))
    : 0

  return {
    id: String(entry.id ?? makeId()),
    direction: 'receivable',
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
      ? entry.payments.map((p) => ({
          amount: Number(p.amount ?? 0),
          date: String(p.date ?? ''),
          createdAt: p.createdAt ? String(p.createdAt) : undefined,
        }))
      : [],
  }
}

function readFromStorage(): Debt[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(RECEIVABLES_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Partial<Debt>[]
    return parsed.map(normalizeReceivable)
  } catch {
    return []
  }
}

function writeToStorage(receivables: Debt[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(RECEIVABLES_STORAGE_KEY, JSON.stringify(receivables))
}

export const useReceivablesStore = create<ReceivablesStore>()((set, get) => ({
  receivables: [],
  hasLoaded: false,

  hydrate: () => {
    if (get().hasLoaded) return
    set({ receivables: readFromStorage(), hasLoaded: true })
  },

  addReceivable: (data) => {
    const newDebt: Debt = normalizeReceivable({
      id: makeId(),
      direction: 'receivable',
      counterparty: data.counterparty,
      history: data.history,
      amount: data.amount,
      interest: data.interest,
      startDate: data.startDate,
      endDate: data.endDate,
      paidAmount: 0,
      remainingAmount: data.amount,
      isSettled: false,
    })
    const next = [newDebt, ...get().receivables]
    writeToStorage(next)
    set({ receivables: next })
  },

  updateReceivable: (id, data) => {
    const next = get().receivables.map((r) => {
      if (r.id !== id) return r
      const nextAmount = data.amount ?? r.amount
      const nextPaidAmount = Math.min(nextAmount, data.paidAmount ?? r.paidAmount)
      const nextRemainingAmount = Math.max(0, nextAmount - nextPaidAmount)
      return {
        ...r,
        ...data,
        amount: nextAmount,
        paidAmount: nextPaidAmount,
        remainingAmount: nextRemainingAmount,
        progress: nextAmount > 0 ? Math.min(100, Math.round((nextPaidAmount / nextAmount) * 100)) : 100,
        isSettled: nextRemainingAmount === 0,
      }
    })
    writeToStorage(next)
    set({ receivables: next })
  },

  markCollected: (id) => {
    const next = get().receivables.map((r) => {
      if (r.id !== id) return r
      const payment: DebtPayment = {
        amount: r.remainingAmount,
        date: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      }
      return {
        ...r,
        paidAmount: r.amount,
        remainingAmount: 0,
        progress: 100,
        isSettled: true,
        payments: [...(r.payments ?? []), payment],
      }
    })
    writeToStorage(next)
    set({ receivables: next })
  },

  removeReceivable: (id) => {
    const next = get().receivables.filter((r) => r.id !== id)
    writeToStorage(next)
    set({ receivables: next })
  },
}))
