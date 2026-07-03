import type {
  AppEvent,
  AuthUser,
  Debt,
  MonthlyPlanningHistory,
  Projection,
  Reminder,
  Salary,
  Transaction,
  WishlistItem,
} from './types'

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
  monthlyPlanningHistory: MonthlyPlanningHistory[]
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
    monthlyPlanningHistory: [],
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
    monthlyPlanningHistory: payload?.monthlyPlanningHistory ?? [],
    events: payload?.events ?? [],
    projections: payload?.projections ?? [],
    reminders: payload?.reminders ?? [],
  }
}
