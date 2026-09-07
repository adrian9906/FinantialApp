export function getTodayDateKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Scoped to the current pay cycle (cobro). The monthly close archives every
 * expense and want into monthlyPlanningHistory and removes them from the list,
 * so whatever remains already belongs to the active cobro — regardless of the
 * calendar month it falls in.
 */
export type TransactionDateFilter = 'today' | 'yesterday' | 'cycle'

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
  const dateKey = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false

  const todayKey = getLocalDateKey(referenceDate)

  if (filter === 'today') return dateKey === todayKey

  if (filter === 'yesterday') {
    const yesterday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - 1)
    return dateKey === getLocalDateKey(yesterday)
  }

  // The close already emptied the list, so everything still here is this
  // cobro: no date cut-off, or spending made after the close but before the
  // month rolls over would vanish from the page.
  return true
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
