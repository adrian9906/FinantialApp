import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const WEEKDAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function parseDateValue(value: string) {
  if (!value) {
    return new Date()
  }

  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return new Date()
  }

  return new Date(year, month - 1, day)
}

function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatDateLabel(value: string) {
  if (!value) {
    return 'Elige una fecha'
  }

  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDateValue(value))
}

interface DatePickerFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  description?: string
}

export function DatePickerField({ label, value, onChange, description }: DatePickerFieldProps) {
  const selectedDate = useMemo(() => parseDateValue(value), [value])
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))

  useEffect(() => {
    setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
  }, [selectedDate])

  const monthMatrix = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const startOffset = (firstDay.getDay() + 6) % 7
    const startDate = new Date(firstDay)
    startDate.setDate(firstDay.getDate() - startOffset)

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + index)
      return date
    })
  }, [visibleMonth])

  const selectedValue = value
  const selectedMonth = visibleMonth.getMonth()
  const selectedYear = visibleMonth.getFullYear()

  return (
    <div className="space-y-2">
      <Label className="text-medium-gray">{label}</Label>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
          <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Seleccionado</p>
          <p className="mt-2 text-lg font-semibold text-on-surface capitalize">{formatDateLabel(value)}</p>
          <p className="mt-1 text-sm text-muted-gray">
            {value ? `Valor guardado: ${value}` : description ?? 'Selecciona el dia exacto que quieres guardar.'}
          </p>
        </Card>

        <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-on-surface">{MONTH_LABELS[selectedMonth]}</p>
              <p className="text-xs text-muted-gray">{selectedYear}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-gray hover:text-on-surface"
                onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-gray hover:text-on-surface"
                onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-[0.18em] text-muted-gray">
            {WEEKDAY_LABELS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {monthMatrix.map((date) => {
              const dayValue = toDateValue(date)
              const isCurrentMonth = date.getMonth() === selectedMonth
              const isSelected = dayValue === selectedValue

              return (
                <Button
                  key={dayValue}
                  type="button"
                  variant={isSelected ? 'default' : 'ghost'}
                  className={isSelected
                    ? 'h-10 border border-primary-container bg-primary-container text-white hover:brightness-110'
                    : `h-10 border border-transparent ${isCurrentMonth ? 'text-on-surface hover:bg-surface hover:text-on-surface' : 'text-muted-gray/55 hover:text-muted-gray'}`}
                  onClick={() => onChange(dayValue)}
                >
                  {date.getDate()}
                </Button>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
