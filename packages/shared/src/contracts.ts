import type {
  AppEvent,
  IncomeSource,
  AuthUser,
  Debt,
  MonthlyPlanningHistory,
  Projection,
  Reminder,
  Salary,
  SavingsGoal,
  Subscription,
  Transaction,
  WishlistItem,
} from './types.js'
import { getWishlistExternalContribution, isWishlistPurchased } from './wishlist.js'

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
  incomeSources: IncomeSource[]
  transactions: Transaction[]
  debts: Debt[]
  wishlist: WishlistItem[]
  monthlyPlanningHistory: MonthlyPlanningHistory[]
  events: AppEvent[]
  projections: Projection[]
  savingsGoals: SavingsGoal[]
  reminders: Reminder[]
  subscriptions: Subscription[]
}

export function createEmptyBootstrapPayload(): BootstrapPayload {
  return {
    salaries: [],
    incomeSources: [],
    transactions: [],
    debts: [],
    wishlist: [],
    monthlyPlanningHistory: [],
    events: [],
    projections: [],
    savingsGoals: [],
    reminders: [],
    subscriptions: [],
  }
}

export function normalizeBootstrapPayload(payload?: Partial<BootstrapPayload> | null): BootstrapPayload {
  return {
    salaries: (payload?.salaries ?? []).map((salary) => ({
      ...salary,
      currencyCode: String(salary.currencyCode ?? 'USD').trim().toUpperCase() || 'USD',
      balanceMode: salary.balanceMode === 'zero' ? 'zero' : 'fixed',
      balance: Number(salary.balance ?? salary.amount ?? 0),
    })),
    incomeSources: (payload?.incomeSources ?? []).map((source) => ({
      ...source,
      currencyCode: String(source.currencyCode ?? 'USD').trim().toUpperCase() || 'USD',
      balanceMode: source.balanceMode === 'zero' ? 'zero' : 'fixed',
      isCash: source.isCash !== false,
    })),
    transactions: payload?.transactions ?? [],
    debts: payload?.debts ?? [],
    wishlist: (payload?.wishlist ?? []).map((item): WishlistItem => ({
      ...item,
      savedAmount: Number(item.savedAmount ?? 0),
      externalContribution: getWishlistExternalContribution(item),
      isPurchased: isWishlistPurchased(item),
    })),
    monthlyPlanningHistory: payload?.monthlyPlanningHistory ?? [],
    events: payload?.events ?? [],
    projections: payload?.projections ?? [],
    savingsGoals: payload?.savingsGoals ?? [],
    reminders: payload?.reminders ?? [],
    subscriptions: payload?.subscriptions ?? [],
  }
}
