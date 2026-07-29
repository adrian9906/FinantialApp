import type { Salary } from './types'

export function getMonthKey(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function addMonthsToKey(monthKey: string, amount: number) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + amount, 1)
  return getMonthKey(date)
}

export function normalizeSalaryHistory(salaries: Salary[]) {
  const salariesByMonth = new Map<string, Salary>()

  for (const salary of salaries) {
    if (!salariesByMonth.has(salary.month)) {
      salariesByMonth.set(salary.month, salary)
    }
  }

  return [...salariesByMonth.values()].sort((a, b) => b.month.localeCompare(a.month))
}

export function getSalaryForMonth(salaries: Salary[], month = getMonthKey()) {
  return normalizeSalaryHistory(salaries).find((salary) => salary.month <= month) ?? null
}

export function carrySalaryForwardToMonth(
  salaries: Salary[],
  targetMonth: string,
  createId: () => string,
) {
  const normalized = normalizeSalaryHistory(salaries)
  const sourceSalary = normalized.find((salary) => salary.month <= targetMonth)

  if (!sourceSalary || sourceSalary.month === targetMonth) {
    return normalized
  }

  const existingMonths = new Set(normalized.map((salary) => salary.month))
  const carriedSalaries: Salary[] = []
  let month = addMonthsToKey(sourceSalary.month, 1)

  while (month <= targetMonth) {
    if (!existingMonths.has(month)) {
      carriedSalaries.push({
        id: createId(),
        amount: sourceSalary.amount,
        month,
      })
    }
    month = addMonthsToKey(month, 1)
  }

  return normalizeSalaryHistory([...carriedSalaries, ...normalized])
}
