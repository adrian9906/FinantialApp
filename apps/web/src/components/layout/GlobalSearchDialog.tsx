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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  buildGlobalSearchIndex,
  getSearchFilterOptions,
  type GlobalSearchResult,
  type SearchSection,
} from '@/lib/productivity'
import { useFinanceStore } from '@/store/financeStore'

const SECTION_LABELS: Record<SearchSection, string> = {
  expense: 'Gastos',
  want: 'Gustos',
  wishlist: 'Deseos',
  debt: 'Deudas',
  reminder: 'Recordatorios',
}

export function GlobalSearchDialog() {
  const navigate = useNavigate()
  const transactions = useFinanceStore((state) => state.transactions)
  const wishlist = useFinanceStore((state) => state.wishlist)
  const debts = useFinanceStore((state) => state.debts)
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
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3 rounded-2xl border border-graphite bg-surface/90 px-4 py-3 text-left shadow-vault transition-all hover:border-primary/35 hover:bg-surface-container-high"
      >
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Search className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-on-surface">Busqueda global</p>
          <p className="truncate text-xs text-muted-gray">
            Busca gastos, gustos, deseos, deudas y recordatorios con filtros reales.
          </p>
        </div>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="border-graphite bg-surface p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-graphite px-5 pb-4 pt-5">
            <DialogTitle className="flex items-center gap-2 text-on-surface">
              <Search className="size-4 text-primary" />
              Busqueda global y filtros avanzados
            </DialogTitle>
            <DialogDescription>
              Encuentra cualquier movimiento o pendiente sin saltar entre pantallas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 pb-5 pt-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(0,0.8fr))]">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por producto, deuda, deseo o recordatorio..."
                className="border-graphite bg-abyss text-on-surface"
              />
              <Select value={sectionFilter} onValueChange={(value) => setSectionFilter(value as 'all' | SearchSection)}>
                <SelectTrigger className="border-graphite bg-abyss text-on-surface">
                  <SelectValue placeholder="Seccion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las secciones</SelectItem>
                  {Object.entries(SECTION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={monthFilter} onValueChange={(value) => setMonthFilter(value ?? 'all')}>
                <SelectTrigger className="border-graphite bg-abyss text-on-surface">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {filterOptions.months.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value ?? 'all')}>
                <SelectTrigger className="border-graphite bg-abyss text-on-surface">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorias</SelectItem>
                  {filterOptions.categories.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? 'all')}>
                <SelectTrigger className="border-graphite bg-abyss text-on-surface">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {filterOptions.statuses.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="number"
                inputMode="decimal"
                value={minAmount}
                onChange={(event) => setMinAmount(event.target.value)}
                placeholder="Monto minimo"
                className="border-graphite bg-abyss text-on-surface"
              />
              <Input
                type="number"
                inputMode="decimal"
                value={maxAmount}
                onChange={(event) => setMaxAmount(event.target.value)}
                placeholder="Monto maximo"
                className="border-graphite bg-abyss text-on-surface"
              />
            </div>

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
                  Vista global
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
