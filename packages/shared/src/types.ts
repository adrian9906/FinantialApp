export interface Salary {
  id: string
  amount: number
  month: string
}

export interface Transaction {
  id: string
  amount: number
  type: 'expense' | 'want' | 'saving'
  description?: string
  date: string
}

export interface DebtPayment {
  amount: number
  date: string
}

export interface Debt {
  id: string
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
  name: string
  price: number
  priority: 'low' | 'medium' | 'high'
  savedAmount: number
  externalContribution?: number
  isPurchased?: boolean
  image?: string
}

export interface MonthlyPlanningItem {
  amount: number
  itemName: string
  category: string
  status: 'pending' | 'checked'
  date: string
}

export interface MonthlyPlanningHistory {
  id: string
  month: string
  label: string
  createdAt: string
  expenses: MonthlyPlanningItem[]
  wants: MonthlyPlanningItem[]
}

export interface AppEvent {
  id: string
  name: string
  date: string
  amount: number
  isNotification: boolean
}

export interface Projection {
  id: string
  targetSalary: number
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
