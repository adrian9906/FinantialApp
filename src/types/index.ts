export interface Salary {
  id: string
  amount: number
  month: string
  received: boolean
}

export interface Transaction {
  id: string
  amount: number
  type: 'expense' | 'want' | 'saving'
  description: string
  date: string
}

export interface Debt {
  id: string
  name: string
  totalAmount: number
  paidAmount: number
  interestRate: number
  dueDate: string
  monthlyPayment: number
}

export interface SavingsGoal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: string
}

export interface WishlistItem {
  id: string
  name: string
  price: number
  priority: 'low' | 'medium' | 'high'
  savedAmount: number
  url?: string
  notes?: string
}

export interface AppEvent {
  id: string
  name: string
  date: string
  budget: number
  spent: number
}

export interface Reminder {
  id: string
  title: string
  description: string
  date: string
  completed: boolean
}
