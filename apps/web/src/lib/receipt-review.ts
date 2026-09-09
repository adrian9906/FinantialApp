import {
  buildExpenseDescription,
  buildWantDescription,
  getExpenseCategoryLabel,
  getWantCategoryLabel,
  parseExpenseDescription,
  parseWantDescription,
  type ExpenseCategory,
  type ReceiptOCRTransactionType,
  type Transaction,
  type WantCategory,
} from '@plata/shared'

export interface ReceiptReviewCategory {
  value: string
  label: string
}

export type ReceiptReviewCategoryGroups = Record<ReceiptOCRTransactionType, ReceiptReviewCategory[]>

interface ReceiptReviewResultBase {
  name: string
  quantity: number
  /** Already converted to USD, the currency everything is stored in. */
  amount: number
  isCash: boolean
}

export type ReceiptReviewResult = ReceiptReviewResultBase & (
  | { transactionType: 'expense'; category: ExpenseCategory }
  | { transactionType: 'want'; category: WantCategory }
)

const EXPENSE_CATEGORIES: ReceiptReviewCategory[] = [
  { value: 'food', label: 'Comida' },
  { value: 'home', label: 'Pagos del hogar' },
  { value: 'services', label: 'Servicios' },
  { value: 'gym', label: 'Gym' },
  { value: 'health', label: 'Salud' },
  { value: 'essentials', label: 'Otros esenciales' },
]

const WANT_CATEGORIES: ReceiptReviewCategory[] = [
  { value: 'outings', label: 'Salidas' },
  { value: 'shopping', label: 'Compras' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'subscriptions', label: 'Suscripciones' },
  { value: 'selfcare', label: 'Autocuidado' },
]

export function getDefaultReceiptCategory(transactionType: ReceiptOCRTransactionType) {
  return transactionType === 'expense' ? 'essentials' : 'outings'
}

export function buildReceiptCategoryGroups(transactions: Transaction[]): ReceiptReviewCategoryGroups {
  const expenseCategories = new Map(EXPENSE_CATEGORIES.map((category) => [category.value, category]))
  const wantCategories = new Map(WANT_CATEGORIES.map((category) => [category.value, category]))

  transactions.forEach((transaction) => {
    if (transaction.type === 'expense') {
      const category = parseExpenseDescription(transaction.description).category
      if (!expenseCategories.has(category)) {
        expenseCategories.set(category, {
          value: category,
          label: getExpenseCategoryLabel(category) ?? 'Categoría personalizada',
        })
      }
    }

    if (transaction.type === 'want') {
      const category = parseWantDescription(transaction.description).category
      if (!wantCategories.has(category)) {
        wantCategories.set(category, {
          value: category,
          label: getWantCategoryLabel(category) ?? 'Categoría personalizada',
        })
      }
    }
  })

  return {
    expense: Array.from(expenseCategories.values()),
    want: Array.from(wantCategories.values()),
  }
}

export function getReceiptTotalsByType(items: ReceiptReviewResult[]) {
  return items.reduce(
    (totals, item) => ({
      ...totals,
      [item.transactionType]: totals[item.transactionType] + item.amount,
    }),
    { expense: 0, want: 0 },
  )
}

export function buildReceiptTransaction(item: ReceiptReviewResult, date: string) {
  const quantity = Number.isInteger(item.quantity)
    ? String(item.quantity)
    : item.quantity.toLocaleString('es')
  const itemName = `${quantity} × ${item.name.trim()}`

  if (item.transactionType === 'expense') {
    return {
      amount: item.amount,
      type: 'expense' as const,
      description: buildExpenseDescription(item.category, itemName, 'checked'),
      date,
      isCash: item.isCash,
    }
  }

  return {
    amount: item.amount,
    type: 'want' as const,
    description: buildWantDescription(item.category, itemName, 'checked'),
    date,
    isCash: item.isCash,
  }
}
