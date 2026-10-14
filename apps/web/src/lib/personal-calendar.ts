import type { AppEvent } from '@plata/shared'

export function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function calendarMonthDays(month: string) {
  const [year, number] = month.split('-').map(Number)
  const first = new Date(year, number - 1, 1, 12)
  first.setDate(1 - (first.getDay() + 6) % 7)
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(first)
    day.setDate(first.getDate() + index)
    return calendarDateKey(day)
  })
}

/** Dates stay local; recurring payments on the 31st fall on the month's last day. */
export function occursOn(event: AppEvent, day: string) {
  const start = event.date.slice(0, 10)
  if (day < start) return false
  if (!event.recurrence || event.recurrence === 'none') return start === day
  const [year, month, date] = day.split('-').map(Number)
  const [, originalMonth, originalDay] = start.split('-').map(Number)
  if (event.recurrence === 'yearly' && month !== originalMonth) return false
  const lastDay = new Date(year, month, 0).getDate()
  return date === Math.min(originalDay, lastDay)
}

export function eventsOn(events: AppEvent[], day: string) {
  return events.filter((event) => occursOn(event, day))
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.name.localeCompare(b.name))
}
