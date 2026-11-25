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
  VacationAdjustment,
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
  vacationAdjustments: VacationAdjustment[]
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
    vacationAdjustments: [],
  }
}

export function normalizeBootstrapPayload(payload?: Partial<BootstrapPayload> | null): BootstrapPayload {
  return {
    salaries: (payload?.salaries ?? []).map((salary) => {
      const source = payload?.incomeSources?.find((entry) => entry.id === salary.sourceId)
      const isSavingsAccount = (source?.name ?? salary.sourceName ?? '').trim().toLocaleLowerCase('es').startsWith('ahorro ')
      const amount = Number(salary.amount ?? 0)
      const balance = Number(salary.balance ?? amount)
      const transferAdjustment = Number(salary.transferAdjustment ?? (
        isSavingsAccount ? 0 : Math.max(0, balance - amount)
      ))
      const inferredRollover = isSavingsAccount
        ? 0
        : Math.max(0, balance - amount - Math.max(0, transferAdjustment))

      return {
        ...salary,
        currencyCode: String(source?.currencyCode ?? salary.currencyCode ?? 'USD').trim().toUpperCase() || 'USD',
        balanceMode: salary.balanceMode === 'zero' ? 'zero' : 'fixed',
        balance,
        rolloverAmount: Number(salary.rolloverAmount ?? inferredRollover),
        transferAdjustment,
        vacationAdjustment: Number(salary.vacationAdjustment ?? 0),
      }
    }),
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
    vacationAdjustments: payload?.vacationAdjustments ?? [],
  }
}
