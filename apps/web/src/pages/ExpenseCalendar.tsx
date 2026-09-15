import { useMemo, useState, useSyncExternalStore } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { useActiveIncomeAccount } from '@/lib/useActiveIncomeAccount'
import { formatMoneyWithCode, getCurrencyByCode } from '@/lib/currency'
import { getExpenseCategoryLabel } from '@/lib/expense-utils'
import { getCalendarMovements, toCalendarDay } from '@/lib/expense-calendar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { getWantCategoryLabel, type WantCategory } from '@/lib/want-utils'
import { cn } from '@/lib/utils'

const categories: Record<string, string> = { food: 'Comida', home: 'Hogar', services: 'Servicios', gym: 'Gym', health: 'Salud', essentials: 'Otros esenciales' }
const weekdays = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const longDate = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })
const monthLabel = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' })
const movementTypes = [
  { type: 'expense', label: 'Gastos', color: 'var(--calendar-expense)' },
  { type: 'want', label: 'Gustos', color: 'var(--calendar-want)' },
  { type: 'saving', label: 'Ahorros', color: 'var(--calendar-saving)' },
] as const
function subscribeMobile(callback: () => void) {
  const query = window.matchMedia('(max-width: 767px)')
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
const getMobileSnapshot = () => window.matchMedia('(max-width: 767px)').matches

function parseDay(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date()
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return toCalendarDay(date) === value ? date : new Date()
}

export default function ExpenseCalendar() {
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, () => false)
  const [dayOpen, setDayOpen] = useState(false)
  const [params, setParams] = useSearchParams()
  const selected = parseDay(params.get('date'))
  const selectedKey = toCalendarDay(selected)
  const month = parseDay(params.get('month') ?? selectedKey)
  const today = toCalendarDay(new Date())
  const transactions = useFinanceStore((state) => state.transactions)
  const history = useFinanceStore((state) => state.monthlyPlanningHistory)
  const hasLoaded = useFinanceStore((state) => state.hasLoaded)
  const { activeAccount, activeIncomeSourceId } = useActiveIncomeAccount()
  const currencies = usePreferencesStore((state) => state.currencies)
  const code = activeAccount?.salary.currencyCode ?? activeAccount?.source.currencyCode ?? 'USD'
  const currency = currencies.find((entry) => entry.code === code) ?? getCurrencyByCode(code)
  const money = (amount: number) => formatMoneyWithCode(amount, currency)
  const entries = useMemo(() => getCalendarMovements(transactions, history, activeIncomeSourceId), [transactions, history, activeIncomeSourceId])
  const byDay = useMemo(() => {
    const map = new Map<string, typeof entries>()
    for (const entry of entries) map.set(entry.date, [...(map.get(entry.date) ?? []), entry])
    return map
  }, [entries])
  const dayEntries = byDay.get(selectedKey) ?? []
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), 1 - offset + index))

  function selectDay(date: Date, openDetails = false) {
    setParams({ date: toCalendarDay(date), month: toCalendarDay(new Date(date.getFullYear(), date.getMonth(), 1)) }, { replace: true })
    if (isMobile && openDetails) setDayOpen(true)
  }
  function changeMonth(delta: number) {
    setParams({ date: selectedKey, month: toCalendarDay(new Date(first.getFullYear(), first.getMonth() + delta, 1)) }, { replace: true })
  }

  const summary = <div className="grid grid-cols-1 gap-2">
    {movementTypes.map((kind) => {
      const rows = dayEntries.filter((entry) => entry.type === kind.type)
      const total = rows.filter((entry) => entry.status === 'checked').reduce((sum, entry) => sum + entry.amount, 0)
      const pending = rows.filter((entry) => entry.status === 'pending').reduce((sum, entry) => sum + entry.amount, 0)
      return <div key={kind.type} className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-surface-container-high px-3 py-2">
        <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ backgroundColor: kind.color }} />{kind.label}</span>
        <span className="text-sm">{money(total)}{pending !== 0 && <span className="text-muted-gray"> · {money(pending)} pendiente</span>}</span>
      </div>
    })}
  </div>
  const details = <div className="flex min-w-0 flex-col gap-3" aria-live="polite">
    {summary}
    {!hasLoaded ? <p role="status">Cargando movimientos…</p> : dayEntries.length === 0 ? <p className="py-8 text-center text-muted-gray">{activeAccount ? 'No hay movimientos registrados en esta fecha.' : 'Selecciona o crea una cuenta de ingresos para consultar sus movimientos.'}</p> : dayEntries.map((entry) => {
      const kind = movementTypes.find((value) => value.type === entry.type)!
      const category = entry.type === 'want' ? getWantCategoryLabel(entry.category as WantCategory) ?? 'Gusto'
        : entry.type === 'saving' ? 'Ahorro' : categories[entry.category] ?? getExpenseCategoryLabel(entry.category as `custom:${string}`) ?? entry.category
      return <div key={entry.id} className="flex min-w-0 flex-col gap-2 rounded-xl border-l-4 bg-surface-container-high p-3 sm:flex-row sm:items-start sm:justify-between" style={{ borderLeftColor: kind.color }}>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="break-words font-medium text-on-surface">{entry.itemName}</p>
          <p className="text-xs text-muted-gray">{kind.label} · {category} · {entry.status === 'checked' ? (entry.type === 'saving' ? 'Registrado' : 'Pagado') : 'Pendiente'}{entry.archived ? ' · Historial' : ''}</p>
        </div>
        <p className="break-words font-semibold text-on-surface sm:shrink-0">{money(entry.amount)}</p>
      </div>
    })}
    <div className="mt-2 flex flex-wrap gap-3 text-sm text-primary">
      <Link to="/expenses" className="hover:underline">Gestionar gastos →</Link>
      <Link to="/wants" className="hover:underline">Gustos →</Link>
      <Link to="/savings" className="hover:underline">Ahorros →</Link>
    </div>
  </div>

  return (
    <div className="expense-calendar flex min-w-0 flex-col gap-4 sm:gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">Calendario de gastos</h1>
          <p className="text-sm text-muted-gray">Explora tus compras día a día · {activeAccount?.source.name ?? 'Selecciona una cuenta'}</p>
        </div>
        <Button variant="outline" onClick={() => selectDay(new Date())}>Ir a hoy</Button>
      </header>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-gray" aria-label="Colores de los movimientos">
        {movementTypes.map((kind) => <span key={kind.type} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: kind.color }} />{kind.label}</span>)}
      </div>
      <div className="grid min-w-0 items-start gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => changeMonth(-1)}><ChevronLeft /></Button>
              <CardTitle className="capitalize" aria-live="polite">{monthLabel.format(first)}</CardTitle>
              <Button variant="ghost" size="icon" aria-label="Mes siguiente" onClick={() => changeMonth(1)}><ChevronRight /></Button>
            </div>
            <CardDescription>Toca un día para ver sus gastos, gustos y ahorros.</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <div className="grid grid-cols-7 gap-1">
              {weekdays.map((day) => <div key={day} className="py-2 text-center text-xs text-muted-gray">{day}</div>)}
              {days.map((date) => {
                const key = toCalendarDay(date)
                const purchases = byDay.get(key) ?? []
                const counts = movementTypes.map((kind) => `${purchases.filter((entry) => entry.type === kind.type).length} ${kind.label.toLowerCase()}`).join(', ')
                return <button key={key} type="button" aria-pressed={key === selectedKey} aria-current={key === today ? 'date' : undefined}
                  aria-label={`${longDate.format(date)}, ${counts}`}
                  aria-haspopup={isMobile ? 'dialog' : undefined}
                  onClick={() => selectDay(date, true)}
                  className={cn('flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-transparent px-0.5 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-primary sm:min-h-20 sm:rounded-xl',
                    key === selectedKey ? 'bg-secondary-container text-on-secondary-container' : 'hover:bg-surface-container-high',
                    date.getMonth() !== first.getMonth() && key !== selectedKey ? 'text-muted-gray opacity-60' : 'text-on-surface',
                    key === today && 'border-primary')}>
                  <span className="text-sm font-medium">{date.getDate()}</span>
                  <span className="flex h-2 items-center gap-1" aria-hidden="true">
                    {movementTypes.filter((kind) => purchases.some((entry) => entry.type === kind.type)).map((kind) => <span key={kind.type} className="size-1.5 rounded-full sm:size-2" style={{ backgroundColor: kind.color }} />)}
                  </span>
                </button>
              })}
            </div>
          </CardContent>
        </Card>
        <Card className="hidden min-w-0 md:flex">
          <CardHeader>
            <CardTitle>{longDate.format(selected)}</CardTitle>
            <CardDescription>{dayEntries.length} movimientos en esta fecha</CardDescription>
          </CardHeader>
          <CardContent>
            {details}
          </CardContent>
        </Card>
      </div>
      {isMobile && <Dialog open={dayOpen} onOpenChange={setDayOpen}>
        <DialogContent className="expense-calendar max-h-[85dvh] min-w-0">
          <DialogHeader className="pr-8">
            <DialogTitle>{longDate.format(selected)}</DialogTitle>
            <DialogDescription>{dayEntries.length} movimientos · {activeAccount?.source.name ?? 'Sin cuenta seleccionada'}</DialogDescription>
          </DialogHeader>
          {details}
        </DialogContent>
      </Dialog>}
    </div>
  )
}
