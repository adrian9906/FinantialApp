import type { MonthlyPlanningHistory } from '@plata/shared'
import { CalendarDays, History, ListRestart } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/currency'

type PlanningListHistoryProps = {
  history: MonthlyPlanningHistory[]
  type: 'expense' | 'want'
  restoringId: string | null
  disabled?: boolean
  onReuse: (entry: MonthlyPlanningHistory) => void
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
})

function formatMonth(month: string) {
  const [year, monthValue] = month.split('-').map(Number)
  if (!year || !monthValue) return month
  return MONTH_FORMATTER.format(new Date(year, monthValue - 1, 1))
}

export function PlanningListHistory({
  history,
  type,
  restoringId,
  disabled = false,
  onReuse,
}: PlanningListHistoryProps) {
  const availableLists = history
    .filter((entry) => (type === 'expense' ? entry.expenses : entry.wants).length > 0)
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 6)

  if (availableLists.length === 0) return null

  const sectionLabel = type === 'expense' ? 'gastos' : 'gustos'

  return (
    <section className="overflow-hidden rounded-2xl border border-graphite bg-surface shadow-vault">
      <div className="flex flex-col gap-3 border-b border-graphite px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <History className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-on-surface">Historial de listas</h2>
            <p className="mt-1 text-sm text-muted-gray">
              Recupera una lista completa de {sectionLabel} de un mes anterior.
            </p>
          </div>
        </div>
        <span className="text-xs uppercase tracking-[0.18em] text-medium-gray">
          {availableLists.length} {availableLists.length === 1 ? 'lista guardada' : 'listas guardadas'}
        </span>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {availableLists.map((entry) => {
          const items = type === 'expense' ? entry.expenses : entry.wants
          const total = items.reduce((sum, item) => sum + item.amount, 0)
          const preview = items.slice(0, 3).map((item) => item.itemName).join(' · ')
          const remainingCount = Math.max(0, items.length - 3)
          const isRestoring = restoringId === entry.id

          return (
            <article
              key={`${type}-${entry.id}`}
              className="flex min-w-0 flex-col rounded-2xl border border-graphite bg-abyss p-4 shadow-vault-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-medium-gray">
                    <CalendarDays className="size-3.5" />
                    <span className="truncate capitalize">{formatMonth(entry.month)}</span>
                  </div>
                  <p className="mt-3 text-xl font-semibold text-on-surface">
                    {formatMoney(total)}
                  </p>
                </div>
                <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-on-surface">
                  {items.length} {items.length === 1 ? 'artículo' : 'artículos'}
                </span>
              </div>

              <p className="mt-3 min-h-10 text-xs leading-5 text-muted-gray">
                {preview}
                {remainingCount > 0 ? ` · +${remainingCount} más` : ''}
              </p>

              <Button
                type="button"
                variant="secondary"
                loading={isRestoring}
                disabled={disabled || restoringId !== null}
                onClick={() => onReuse(entry)}
                className="mt-4 w-full bg-primary/10 text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ListRestart className="size-4" />
                Reutilizar lista
              </Button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
