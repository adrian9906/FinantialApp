import type { AppEvent, AuthUser, Debt, Projection, Reminder, Salary, Transaction, WishlistItem } from './types'

export type AuthMode = 'anonymous' | 'guest' | 'authenticated'

export interface AuthCredentials {
  email: string
  password: string
  rememberMe: boolean
}

export interface RegisterPayload extends AuthCredentials {
  name: string
}

export interface AuthResponse {
  user: AuthUser
  sessionToken?: string | null
}

export interface BootstrapPayload {
  salaries: Salary[]
  transactions: Transaction[]
  debts: Debt[]
  wishlist: WishlistItem[]
  events: AppEvent[]
  projections: Projection[]
  reminders: Reminder[]
}

export function createEmptyBootstrapPayload(): BootstrapPayload {
  return {
    salaries: [],
    transactions: [],
    debts: [],
    wishlist: [],
    events: [],
    projections: [],
    reminders: [],
  }
}

export function normalizeBootstrapPayload(payload?: Partial<BootstrapPayload> | null): BootstrapPayload {
  return {
    salaries: payload?.salaries ?? [],
    transactions: payload?.transactions ?? [],
    debts: payload?.debts ?? [],
    wishlist: payload?.wishlist ?? [],
    events: payload?.events ?? [],
    projections: payload?.projections ?? [],
    reminders: payload?.reminders ?? [],
  }
}
