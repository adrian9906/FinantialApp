import { getExpenseCategoryLabel, parseExpenseDescription, type ExpenseCategory, type Transaction } from '@plata/shared'

type RankedLeak = {
  label: string
  totalAmount: number
  count: number
}

export type UnnecessarySpendingAlert = {
  id: string
  tone: 'success' | 'info' | 'warning' | 'critical'
  title: string
  description: string
}

export type UnnecessarySpendingInsights = {
  monthKey: string
  checkedExpenseTotal: number
  unnecessaryTotal: number
  unnecessaryCount: number
  unnecessaryShare: number
  topCategories: RankedLeak[]
  topProducts: RankedLeak[]
  latestItems: Array<{
    id: string
    itemName: string
    category: string
    amount: number
    date: string
  }>
}

function toCategoryLabel(category: string) {
  return getExpenseCategoryLabel(category as ExpenseCategory) ?? category
}

export function buildUnnecessarySpendingInsights(
  transactions: Transaction[],
  monthKey = new Date().toISOString().slice(0, 7),
): UnnecessarySpendingInsights {
  const checkedExpenses = transactions.filter((transaction) => {
    if (transaction.type !== 'expense') return false
    if (!transaction.date.startsWith(monthKey)) return false
    return parseExpenseDescription(transaction.description).status === 'checked'
  })

  const unnecessaryExpenses = checkedExpenses
    .map((transaction) => ({
      transaction,
      parsed: parseExpenseDescription(transaction.description),
    }))
    .filter(({ parsed }) => parsed.unnecessary)

  const checkedExpenseTotal = checkedExpenses.reduce((sum, transaction) => sum + transaction.amount, 0)
  const unnecessaryTotal = unnecessaryExpenses.reduce((sum, entry) => sum + entry.transaction.amount, 0)
  const unnecessaryCount = unnecessaryExpenses.length
  const unnecessaryShare = checkedExpenseTotal > 0 ? unnecessaryTotal / checkedExpenseTotal : 0

  const categories = new Map<string, RankedLeak>()
  const products = new Map<string, RankedLeak>()

  unnecessaryExpenses.forEach(({ transaction, parsed }) => {
    const categoryLabel = toCategoryLabel(parsed.category)
    const categoryEntry = categories.get(categoryLabel) ?? {
      label: categoryLabel,
      totalAmount: 0,
      count: 0,
    }
    categoryEntry.totalAmount += transaction.amount
    categoryEntry.count += 1
    categories.set(categoryLabel, categoryEntry)

    const productKey = parsed.itemName.trim().toLowerCase()
    const productEntry = products.get(productKey) ?? {
      label: parsed.itemName,
      totalAmount: 0,
      count: 0,
    }
    productEntry.totalAmount += transaction.amount
    productEntry.count += 1
    products.set(productKey, productEntry)
  })

  return {
    monthKey,
    checkedExpenseTotal,
    unnecessaryTotal,
    unnecessaryCount,
    unnecessaryShare,
    topCategories: [...categories.values()].sort((left, right) => right.totalAmount - left.totalAmount).slice(0, 5),
    topProducts: [...products.values()].sort((left, right) => right.totalAmount - left.totalAmount).slice(0, 5),
    latestItems: unnecessaryExpenses
      .map(({ transaction, parsed }) => ({
        id: transaction.id,
        itemName: parsed.itemName,
        category: toCategoryLabel(parsed.category),
        amount: transaction.amount,
        date: transaction.date,
      }))
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 5),
  }
}

export function buildUnnecessarySpendingAlerts(insights: UnnecessarySpendingInsights): UnnecessarySpendingAlert[] {
  if (insights.unnecessaryTotal <= 0) {
    return [{
      id: 'unnecessary-clear',
      tone: 'success',
      title: 'No has marcado fugas innecesarias este mes',
      description: 'Sigue así o empieza a marcar los gastos evitables para medir cuánto dinero podrías rescatar.',
    }]
  }

  const alerts: UnnecessarySpendingAlert[] = []

  if (insights.unnecessaryShare >= 0.3) {
    alerts.push({
      id: 'unnecessary-critical-share',
      tone: 'critical',
      title: 'Una parte fuerte de tus gastos ya se fue en cosas evitables',
      description: `${Math.round(insights.unnecessaryShare * 100)}% de tus gastos hechos este mes salió de compras que marcaste como innecesarias.`,
    })
  } else if (insights.unnecessaryShare >= 0.15) {
    alerts.push({
      id: 'unnecessary-warning-share',
      tone: 'warning',
      title: 'Tus fugas innecesarias ya pesan en el presupuesto',
      description: `${Math.round(insights.unnecessaryShare * 100)}% de lo que gastaste este mes podría haberse quedado disponible o pasar a ahorro.`,
    })
  }

  const topCategory = insights.topCategories[0]
  if (topCategory) {
    alerts.push({
      id: 'unnecessary-top-category',
      tone: 'info',
      title: `Tu mayor fuga actual está en ${topCategory.label}`,
      description: `Esa categoría acumula ${topCategory.count} gasto(s) marcados como innecesarios y ya suma ${topCategory.totalAmount.toFixed(2)}.`,
    })
  }

  if (insights.unnecessaryCount >= 3) {
    alerts.push({
      id: 'unnecessary-frequency',
      tone: 'warning',
      title: 'La fuga no es solo dinero, también es repetición',
      description: `Ya marcaste ${insights.unnecessaryCount} gasto(s) evitables este mes. Frenar la frecuencia suele liberar más dinero que recortar una sola compra.`,
    })
  }

  return alerts.slice(0, 3)
}
