export function getTodayDateKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export type TransactionDateFilter = 'today' | 'yesterday' | 'current-month' | 'previous-month' | 'all'

function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function matchesTransactionDateFilter(
  value: string,
  filter: TransactionDateFilter,
  referenceDate = new Date(),
) {
  if (filter === 'all') return true

  const dateKey = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false

  const todayKey = getLocalDateKey(referenceDate)
  if (filter === 'today') return dateKey === todayKey

  if (filter === 'yesterday') {
    const yesterday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - 1)
    return dateKey === getLocalDateKey(yesterday)
  }

  const currentMonthKey = todayKey.slice(0, 7)
  if (filter === 'current-month') return dateKey.startsWith(currentMonthKey)

  const previousMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1)
  return dateKey.startsWith(getLocalDateKey(previousMonth).slice(0, 7))
}

export function filterAndSortTransactionsByDate<T extends { date: string; itemName: string }>(
  items: T[],
  filter: TransactionDateFilter,
) {
  const referenceDate = new Date()
  const filteredItems: T[] = []

  for (const item of items) {
    if (matchesTransactionDateFilter(item.date, filter, referenceDate)) filteredItems.push(item)
  }

  return filteredItems.sort(
    (left, right) => right.date.localeCompare(left.date) || left.itemName.localeCompare(right.itemName),
  )
}
