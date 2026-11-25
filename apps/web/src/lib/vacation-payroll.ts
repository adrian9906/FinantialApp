import type { IncomeSource, Salary, VacationAdjustment } from '@plata/shared'

export function nextMonthKey(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const next = new Date(year, monthNumber, 1, 12)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

export function countWorkingDays(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const count = new Date(year, monthNumber, 0).getDate()
  let days = 0
  for (let day = 1; day <= count; day += 1) {
    const weekday = new Date(year, monthNumber - 1, day, 12).getDay()
    if (weekday !== 0 && weekday !== 6) days += 1
  }
  return days
}

export function countWorkingDaysInRange(startDate: string, endDate: string) {
  let days = 0
  const cursor = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  while (cursor <= end) {
    const weekday = cursor.getDay()
    if (weekday !== 0 && weekday !== 6) days += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function vacationSalaryDelta(vacation: Pick<VacationAdjustment, 'mode' | 'amount'>) {
  return vacation.mode === 'paid' ? vacation.amount : -vacation.amount
}

/** Apply or reverse a scheduled adjustment on exactly one future salary row. */
export function applyVacationDelta(
  salaries: Salary[],
  sources: IncomeSource[],
  vacation: VacationAdjustment,
  delta: number,
  createId: () => string,
) {
  const source = sources.find((entry) => entry.id === vacation.incomeSourceId)
  const match = salaries.find((entry) => entry.month === vacation.payrollMonth && entry.sourceId === vacation.incomeSourceId)
  if (match) {
    return salaries.map((entry) => entry.id === match.id ? {
      ...entry,
      vacationAdjustment: Number(entry.vacationAdjustment ?? 0) + delta,
      balance: Number(entry.balance ?? entry.amount) + delta,
    } : entry)
  }

  const previous = salaries.filter((entry) => entry.sourceId === vacation.incomeSourceId && entry.month < vacation.payrollMonth)
    .sort((a, b) => b.month.localeCompare(a.month))[0]
  const rolloverAmount = Math.max(0, Number(previous?.balance ?? 0))
  const amount = source?.recurring === false || source?.balanceMode === 'zero'
    ? 0
    : Number(previous?.amount ?? 0)
  const salary: Salary = {
    id: createId(),
    month: vacation.payrollMonth,
    sourceId: vacation.incomeSourceId,
    sourceName: vacation.incomeSourceName,
    currencyCode: source?.currencyCode ?? previous?.currencyCode ?? 'USD',
    kind: 'recurring',
    balanceMode: source?.balanceMode === 'zero' ? 'zero' : 'fixed',
    amount,
    rolloverAmount,
    vacationAdjustment: delta,
    balance: Number(previous?.balance ?? 0) + amount + delta,
    transferAdjustment: 0,
  }
  return [salary, ...salaries]
}
