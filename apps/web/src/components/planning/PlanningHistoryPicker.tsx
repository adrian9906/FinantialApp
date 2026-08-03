import { History, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { PlanningHistorySuggestion } from '@/lib/productivity'

type PlanningHistoryPickerProps = {
  suggestions: PlanningHistorySuggestion[]
  query: string
  getCategoryLabel: (category: string) => string
  onReuse: (suggestion: PlanningHistorySuggestion) => void
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  month: 'short',
  year: 'numeric',
})

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function formatMonth(month: string) {
  const [year, monthValue] = month.split('-').map(Number)
  if (!year || !monthValue) return month
  return MONTH_FORMATTER.format(new Date(year, monthValue - 1, 1))
}

export function PlanningHistoryPicker({
  suggestions,
  query,
  getCategoryLabel,
  onReuse,
}: PlanningHistoryPickerProps) {
  const normalizedQuery = normalizeText(query)
  const visibleSuggestions = suggestions
    .filter((suggestion) => (
      !normalizedQuery
      || normalizeText(`${suggestion.itemName} ${getCategoryLabel(suggestion.category)}`)
        .includes(normalizedQuery)
    ))
    .slice(0, 8)

  if (suggestions.length === 0) return null

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/15 bg-primary/5">
      <div className="flex items-start gap-3 border-b border-primary/10 px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <History className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-on-surface">Reutilizar del historial</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-gray">
            Toca un artículo anterior para copiar su nombre, categoría y último precio.
          </p>
        </div>
      </div>

      {visibleSuggestions.length > 0 ? (
        <div className="grid max-h-52 gap-2 overflow-y-auto p-3 sm:grid-cols-2">
          {visibleSuggestions.map((suggestion) => (
            <Button
              key={suggestion.key}
              type="button"
              variant="ghost"
              onClick={() => onReuse(suggestion)}
              className="h-auto min-w-0 justify-between gap-3 border border-graphite bg-abyss px-3 py-3 text-left hover:border-primary/30 hover:bg-surface-container-low"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-on-surface">
                  {suggestion.itemName}
                </span>
                <span className="mt-1 block truncate text-xs font-normal text-muted-gray">
                  {getCategoryLabel(suggestion.category)}
                  {' · '}
                  {formatMonth(suggestion.lastUsedMonth)}
                  {suggestion.monthsUsed > 1 ? ` · ${suggestion.monthsUsed} meses` : ''}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold text-primary">
                  ${suggestion.amount.toLocaleString()}
                </span>
                <RotateCcw className="size-3.5 text-muted-gray" />
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <p className="px-4 py-4 text-sm text-muted-gray">
          No hay coincidencias en tu historial.
        </p>
      )}
    </section>
  )
}
