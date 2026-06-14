import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Salary, Transaction, Debt as DebtType, SavingsGoal, WishlistItem, AppEvent, Reminder } from '@/types'

interface FinanceStore {
  salaries: Salary[]
  transactions: Transaction[]
  debts: DebtType[]
  goals: SavingsGoal[]
  wishlist: WishlistItem[]
  events: AppEvent[]
  reminders: Reminder[]
  addSalary: (salary: Salary) => void
  updateSalary: (id: string, data: Partial<Salary>) => void
  removeSalary: (id: string) => void
  addTransaction: (t: Transaction) => void
  removeTransaction: (id: string) => void
  addDebt: (d: DebtType) => void
  updateDebt: (id: string, data: Partial<DebtType>) => void
  removeDebt: (id: string) => void
  addGoal: (g: SavingsGoal) => void
  updateGoal: (id: string, data: Partial<SavingsGoal>) => void
  removeGoal: (id: string) => void
  addWishlistItem: (w: WishlistItem) => void
  updateWishlistItem: (id: string, data: Partial<WishlistItem>) => void
  removeWishlistItem: (id: string) => void
  addEvent: (e: AppEvent) => void
  updateEvent: (id: string, data: Partial<AppEvent>) => void
  removeEvent: (id: string) => void
  addReminder: (r: Reminder) => void
  toggleReminder: (id: string) => void
  removeReminder: (id: string) => void
}

function generateId() {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set) => ({
      salaries: [],
      transactions: [],
      debts: [],
      goals: [],
      wishlist: [],
      events: [],
      reminders: [],
      addSalary: (salary) =>
        set((s) => ({ salaries: [...s.salaries, { ...salary, id: generateId() }] })),
      updateSalary: (id, data) =>
        set((s) => ({
          salaries: s.salaries.map((sal) => (sal.id === id ? { ...sal, ...data } : sal)),
        })),
      removeSalary: (id) =>
        set((s) => ({ salaries: s.salaries.filter((sal) => sal.id !== id) })),
      addTransaction: (t) =>
        set((s) => ({ transactions: [...s.transactions, { ...t, id: generateId() }] })),
      removeTransaction: (id) =>
        set((s) => ({ transactions: s.transactions.filter((tx) => tx.id !== id) })),
      addDebt: (d) =>
        set((s) => ({ debts: [...s.debts, { ...d, id: generateId() }] })),
      updateDebt: (id, data) =>
        set((s) => ({
          debts: s.debts.map((d) => (d.id === id ? { ...d, ...data } : d)),
        })),
      removeDebt: (id) =>
        set((s) => ({ debts: s.debts.filter((d) => d.id !== id) })),
      addGoal: (g) =>
        set((s) => ({ goals: [...s.goals, { ...g, id: generateId() }] })),
      updateGoal: (id, data) =>
        set((s) => ({
          goals: s.goals.map((g) => (g.id === id ? { ...g, ...data } : g)),
        })),
      removeGoal: (id) =>
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      addWishlistItem: (w) =>
        set((s) => ({ wishlist: [...s.wishlist, { ...w, id: generateId() }] })),
      updateWishlistItem: (id, data) =>
        set((s) => ({
          wishlist: s.wishlist.map((w) => (w.id === id ? { ...w, ...data } : w)),
        })),
      removeWishlistItem: (id) =>
        set((s) => ({ wishlist: s.wishlist.filter((w) => w.id !== id) })),
      addEvent: (e) =>
        set((s) => ({ events: [...s.events, { ...e, id: generateId() }] })),
      updateEvent: (id, data) =>
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, ...data } : e)),
        })),
      removeEvent: (id) =>
        set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      addReminder: (r) =>
        set((s) => ({ reminders: [...s.reminders, { ...r, id: generateId() }] })),
      toggleReminder: (id) =>
        set((s) => ({
          reminders: s.reminders.map((r) =>
            r.id === id ? { ...r, completed: !r.completed } : r
          ),
        })),
      removeReminder: (id) =>
        set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) })),
    }),
    { name: 'finance-store' }
  )
)
