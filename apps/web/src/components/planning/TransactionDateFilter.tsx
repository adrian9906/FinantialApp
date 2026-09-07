import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { TransactionDateFilter as TransactionDateFilterValue } from '@/lib/date'

const FILTER_OPTIONS: Array<{ value: TransactionDateFilterValue; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'cycle', label: 'Todo el cobro' },
]

interface TransactionDateFilterProps {
  value: TransactionDateFilterValue
  onChange: (value: TransactionDateFilterValue) => void
  resultCount: number
  itemLabel: string
}

export function TransactionDateFilter({ value, onChange, resultCount, itemLabel }: TransactionDateFilterProps) {
  return (
    <div className="rounded-2xl border border-graphite bg-surface px-4 py-4 shadow-vault-sm sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold text-on-surface">Mostrar por fecha</p>
        </div>
        <p className="text-xs text-muted-gray" aria-live="polite">
          {resultCount} {resultCount === 1 ? itemLabel : `${itemLabel}s`}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por fecha">
        {FILTER_OPTIONS.map((option) => {
          const isActive = value === option.value

          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={isActive ? 'secondary' : 'outline'}
              aria-pressed={isActive}
              className={isActive
                ? 'shrink-0 border-primary/30 bg-primary/15 text-primary hover:bg-primary/20'
                : 'shrink-0 border-graphite bg-abyss text-muted-gray hover:bg-surface-container-high hover:text-on-surface'}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
