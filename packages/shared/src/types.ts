/** A configurable income source: a job, a client, a side gig. */
export interface IncomeSource {
  id: string
  name: string
  /** Currency owned by the account; transactions inherit it. */
  currencyCode?: string
  /** Recurring sources carry forward to the next month on their own. */
  recurring: boolean
  /** Fixed sources either repeat their balance or start each month at zero. */
  balanceMode?: 'fixed' | 'zero'
  /** Default payment rail for purchases made from this account. */
  isCash?: boolean
  archived?: boolean
}

/**
 * One income entry for a month. Kept as `Salary` so existing stored records
 * stay valid: the new fields are optional and an entry without them behaves
 * exactly like the single monthly salary the app used to have.
 */
export interface Salary {
  id: string
  amount: number
  /** Spendable account balance; amount remains the monthly planning base. */
  balance?: number
  month: string
  /** Currency used by this income account. Amount stays normalized to USD. */
  currencyCode?: string
  /** Which income source this belongs to; absent on legacy records. */
  sourceId?: string
  /** Free-text label kept alongside the id so history survives a deleted source. */
  sourceName?: string
  /** One-off income (bonus, aguinaldo) never carries forward. */
  kind?: 'recurring' | 'one-off'
  /** How a recurring balance is initialized when the next month is created. */
  balanceMode?: 'fixed' | 'zero'
}

export interface Transaction {
  id: string
  amount: number
  /** Where the purchase happened. Optional, free text. */
  place?: string
  /** Receipt or purchase photos as validated image data URLs. Optional. */
  attachments?: string[]
  /**
   * How it was paid: true is cash, false is a transfer. Absent on existing
   * records, which are treated as cash.
   */
  isCash?: boolean
  /** Income account charged by this transaction. */
  incomeSourceId?: string
  incomeSourceName?: string
  type: 'expense' | 'want' | 'saving'
  description?: string
  date: string
  createdAt?: string
}

export interface DebtPayment {
  amount: number
  date: string
  createdAt?: string
}

export interface Debt {
  id: string
  incomeSourceId?: string
  incomeSourceName?: string
  direction?: 'payable' | 'receivable'
  counterparty?: string
  amount: number
  history: string
  startDate: string
  endDate: string
  interest?: number
  paidAmount: number
  remainingAmount: number
  progress: number
  isSettled: boolean
  payments?: DebtPayment[]
}

export interface WishlistItem {
  id: string
  incomeSourceId?: string
  incomeSourceName?: string
  name: string
  price: number
  priority: 'low' | 'medium' | 'high'
  savedAmount: number
  externalContribution?: number
  isPurchased?: boolean
  purchasedAt?: string
  image?: string
  sourceStore?: string
  sourceUrl?: string
  sourceCurrency?: string
}

export interface PriceScoutResult {
  store: string
  title: string
  price: number
  currency: string
  image: string
  url: string
}

export interface PriceScoutSearchResponse {
  query: string
  total: number
  results: PriceScoutResult[]
}

export interface MonthlyPlanningItem {
  amount: number
  itemName: string
  category: string
  status: 'pending' | 'checked'
  date: string
  unnecessary?: boolean
  incomeSourceId?: string
  incomeSourceName?: string
}

export interface MonthlyPlanningHistory {
  id: string
  month: string
  label: string
  createdAt: string
  expenses: MonthlyPlanningItem[]
  wants: MonthlyPlanningItem[]
  savingTransactionIds?: string[]
}

export interface AppEvent {
  id: string
  incomeSourceId?: string
  incomeSourceName?: string
  name: string
  date: string
  amount: number
  isNotification: boolean
}

export interface Projection {
  id: string
  incomeSourceId?: string
  incomeSourceName?: string
  targetSalary: number
}

export interface SavingsGoal {
  id: string
  incomeSourceId?: string
  incomeSourceName?: string
  name: string
  category: 'emergency' | 'travel' | 'rent' | 'phone' | 'custom'
  targetAmount: number
  currentAmount: number
  monthlyContribution: number
}

export interface Reminder {
  id: string
  title: string
  description: string
  date: string
  completed: boolean
}

export interface AuthUser {
  id: string
  name: string
  email: string
}

/** A recurring monthly commitment. It is planned spending, not a posted expense. */
export interface Subscription {
  id: string
  incomeSourceId?: string
  incomeSourceName?: string
  name: string
  amount: number
  billingDay: number
  status: 'active' | 'cancelled'
  startedAt: string
  cancelledAt?: string
}
