import { useDeferredValue, useMemo, useState } from 'react'
import { Search, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  buildGlobalSearchIndex,
  getSearchFilterOptions,
  type GlobalSearchResult,
  type SearchSection,
} from '@/lib/productivity'
import { useFinanceStore } from '@/store/financeStore'
import { useActiveIncomeAccount } from '@/lib/useActiveIncomeAccount'

const SECTION_LABELS: Record<SearchSection, string> = {
  expense: 'Gastos',
  want: 'Gustos',
  wishlist: 'Deseos',
  debt: 'Deudas',
  reminder: 'Recordatorios',
}

function SearchFilter({ id, label, value, options, onChange }: {
  id: string
  label: string
  value: string
  options: Array<{ value: string, label: string }>
  onChange: (value: string) => void
}) {
  return (
    <Field className="min-w-0">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} items={options} onValueChange={(next) => onChange(next ?? 'all')}>
        <SelectTrigger id={id} className="h-9 w-full min-w-0">
          <SelectValue className="truncate" />
        </SelectTrigger>
        <SelectContent><SelectGroup>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectGroup></SelectContent>
      </Select>
    </Field>
  )
}

export function GlobalSearchDialog() {
  const navigate = useNavigate()
  const allTransactions = useFinanceStore((state) => state.transactions)
  const allWishlist = useFinanceStore((state) => state.wishlist)
  const allDebts = useFinanceStore((state) => state.debts)
  const { activeIncomeSourceId } = useActiveIncomeAccount()
  const transactions = useMemo(() => allTransactions.filter((item) => item.incomeSourceId === activeIncomeSourceId), [activeIncomeSourceId, allTransactions])
  const wishlist = useMemo(() => allWishlist.filter((item) => item.incomeSourceId === activeIncomeSourceId), [activeIncomeSourceId, allWishlist])
  const debts = useMemo(() => allDebts.filter((item) => item.incomeSourceId === activeIncomeSourceId), [activeIncomeSourceId, allDebts])
  const reminders = useFinanceStore((state) => state.reminders)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [monthFilter, setMonthFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sectionFilter, setSectionFilter] = useState<'all' | SearchSection>('all')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const deferredQuery = useDeferredValue(query)

  const searchIndex = useMemo(
    () => buildGlobalSearchIndex({ transactions, wishlist, debts, reminders }),
    [transactions, wishlist, debts, reminders],
  )
  const filterOptions = useMemo(() => getSearchFilterOptions(searchIndex), [searchIndex])

  const filteredResults = useMemo(() => {
    const normalizedQuery = deferredQuery
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()
    const min = Number(minAmount)
    const max = Number(maxAmount)

    return searchIndex
      .filter((item) => {
        if (normalizedQuery && !item.keywords.includes(normalizedQuery)) return false
        if (sectionFilter !== 'all' && item.section !== sectionFilter) return false
        if (monthFilter !== 'all' && item.month !== monthFilter) return false
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
        if (statusFilter !== 'all' && item.status !== statusFilter) return false
        if (minAmount && Number.isFinite(min) && item.amount < min) return false
        if (maxAmount && Number.isFinite(max) && item.amount > max) return false
        return true
      })
      .slice(0, 40)
  }, [categoryFilter, deferredQuery, maxAmount, minAmount, monthFilter, searchIndex, sectionFilter, statusFilter])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setQuery('')
      setMonthFilter('all')
      setCategoryFilter('all')
      setStatusFilter('all')
      setSectionFilter('all')
      setMinAmount('')
      setMaxAmount('')
    }
  }

  function handleGoToResult(result: GlobalSearchResult) {
    setOpen(false)
    navigate(result.href)
  }

  return (
    <>
      <button
        type="button"
        aria-label="Abrir búsqueda global"
        onClick={() => setOpen(true)}
        className="group flex size-11 shrink-0 items-center justify-center rounded-2xl border border-graphite bg-surface/90 text-left shadow-vault transition-all hover:border-primary/35 hover:bg-surface-container-high sm:h-auto sm:w-full sm:justify-start sm:gap-3 sm:px-4 sm:py-3"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-primary sm:bg-primary/10">
          <Search className="size-4" />
        </div>
        <div className="hidden min-w-0 flex-1 sm:block">
          <p className="text-sm font-semibold text-on-surface">Busqueda global</p>
          <p className="line-clamp-2 text-xs leading-5 text-muted-gray sm:line-clamp-1">
            Busca gastos, gustos, deseos, deudas y recordatorios con filtros reales.
          </p>
        </div>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-graphite bg-surface p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-graphite px-5 pb-4 pt-5">
            <DialogTitle className="flex items-center gap-2 text-on-surface">
              <Search className="size-4 text-primary" />
              Busqueda global y filtros avanzados
            </DialogTitle>
            <DialogDescription>
              Encuentra cualquier movimiento o pendiente sin saltar entre pantallas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
            <FieldGroup className="grid min-w-0 items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field className="min-w-0 sm:col-span-2 lg:col-span-4">
                <FieldLabel htmlFor="global-search-query">Buscar</FieldLabel>
                <Input id="global-search-query" value={query} onChange={(event) => setQuery(event.target.value)}
                  placeholder="Producto, deuda, deseo o recordatorio..." className="h-9 w-full" />
              </Field>
              <SearchFilter id="global-search-section" label="Sección" value={sectionFilter}
                onChange={(value) => setSectionFilter(value as 'all' | SearchSection)}
                options={[{ value: 'all', label: 'Todas las secciones' }, ...Object.entries(SECTION_LABELS).map(([value, label]) => ({ value, label }))]} />
              <SearchFilter id="global-search-month" label="Mes" value={monthFilter} onChange={setMonthFilter}
                options={[{ value: 'all', label: 'Todos los meses' }, ...filterOptions.months]} />
              <SearchFilter id="global-search-category" label="Categoría" value={categoryFilter} onChange={setCategoryFilter}
                options={[{ value: 'all', label: 'Todas las categorías' }, ...filterOptions.categories]} />
              <SearchFilter id="global-search-status" label="Estado" value={statusFilter} onChange={setStatusFilter}
                options={[{ value: 'all', label: 'Todos los estados' }, ...filterOptions.statuses]} />
            </FieldGroup>
            <FieldGroup className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Field className="min-w-0">
                <FieldLabel htmlFor="global-search-min">Monto mínimo</FieldLabel>
                <Input id="global-search-min" type="number" inputMode="decimal" value={minAmount}
                  onChange={(event) => setMinAmount(event.target.value)} placeholder="Sin mínimo" className="h-9 w-full" />
              </Field>
              <Field className="min-w-0">
                <FieldLabel htmlFor="global-search-max">Monto máximo</FieldLabel>
                <Input id="global-search-max" type="number" inputMode="decimal" value={maxAmount}
                  onChange={(event) => setMaxAmount(event.target.value)} placeholder="Sin máximo" className="h-9 w-full" />
              </Field>
            </FieldGroup>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {filteredResults.length} resultado(s)
              </Badge>
              {(query || monthFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all' || sectionFilter !== 'all' || minAmount || maxAmount) ? (
                <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
                  Filtros activos
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
                  Cuenta activa
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[52dvh] rounded-2xl border border-graphite bg-abyss/60">
              <div className="space-y-2 p-3">
                {filteredResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Sparkles className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">Sin coincidencias</p>
                      <p className="mt-1 text-xs text-muted-gray">
                        Ajusta los filtros o prueba con otro nombre, categoria o monto.
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredResults.map((result) => (
                    <button
                      key={`${result.section}:${result.id}`}
                      type="button"
                      onClick={() => handleGoToResult(result)}
                      className="flex w-full flex-col gap-3 rounded-2xl border border-graphite bg-surface px-4 py-4 text-left transition-all hover:border-primary/35 hover:bg-surface-container-high sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-on-surface">{result.title}</p>
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {SECTION_LABELS[result.section]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-gray">{result.subtitle}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
                            {result.categoryLabel}
                          </Badge>
                          <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
                            {result.statusLabel}
                          </Badge>
                          {result.month ? (
                            <Badge variant="secondary" className="bg-surface-container-high text-on-surface">
                              {result.monthLabel}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-on-surface">
                        {result.amountLabel}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
