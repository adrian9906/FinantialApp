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

export interface Debt {
  id: string
  amount: number
  history: string
  startDate: string
  endDate: string
  interest?: number
}

export interface WishlistItem {
  id: string
  name: string
  price: number
  priority: 'low' | 'medium' | 'high'
  savedAmount: number
  image?: string
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
