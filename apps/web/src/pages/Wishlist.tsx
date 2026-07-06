import { useMemo, useState } from 'react'
import {
  buildPurchaseProjection,
  getWishlistAvailableAmount,
  getWishlistExternalContribution,
  getWishlistReservedAmount,
  isWishlistPurchased,
} from '@plata/shared'
import { Grid3X3, LayoutList, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react'

import { ImageUploadField } from '@/components/wishlist/ImageUploadField'
import { ExportExcelButton } from '@/components/reports/ExportExcelButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { exportWishlistReport } from '@/lib/reportExports'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'
import { useFinanceStore } from '@/store/financeStore'

interface FormState {
  name: string
  price: string
  externalContribution: string
  priority: 'low' | 'medium' | 'high'
  image?: string
}

type ViewMode = 'cards' | 'list'

const currencyFormatter = new Intl.NumberFormat('en-US')
const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function parseMoneyInput(value: string) {
  const normalized = value.replace(/\s+/g, '').replace(/,/g, '')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
}

function getPriorityLabel(priority: FormState['priority']) {
  if (priority === 'high') return 'Alta'
  if (priority === 'low') return 'Baja'
  return 'Media'
}

function getPriorityBadgeClass(priority: FormState['priority']) {
  if (priority === 'low') {
    return 'border-red-500/30 bg-red-500/15 text-red-200'
  }

  if (priority === 'medium') {
    return 'border-amber-500/30 bg-amber-500/15 text-amber-200'
  }

  return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
}

export default function Wishlist() {
  const wishlist = useFinanceStore((state) => state.wishlist)
  const transactions = useFinanceStore((state) => state.transactions)
  const salaries = useFinanceStore((state) => state.salaries)
  const addWishlistItem = useFinanceStore((state) => state.addWishlistItem)
  const updateWishlistItem = useFinanceStore((state) => state.updateWishlistItem)
  const removeWishlistItem = useFinanceStore((state) => state.removeWishlistItem)
  const overview = useMonthlyOverview()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [form, setForm] = useState<FormState>({
    name: '',
    price: '',
    externalContribution: '',
    priority: 'medium',
    image: undefined,
  })

  const averageMonthlySavings = useMemo(() => {
    const totalSaved = transactions
      .filter((transaction) => transaction.type === 'saving')
      .reduce((sum, transaction) => sum + transaction.amount, 0)

    const trackedMonths = salaries.length > 0
      ? new Set(salaries.map((salary) => salary.month)).size
      : new Set(
        transactions
          .filter((transaction) => transaction.type === 'saving')
          .map((transaction) => transaction.date.slice(0, 7))
      ).size

    if (trackedMonths === 0) return 0

    return totalSaved / trackedMonths
  }, [salaries, transactions])

  const currentSavedAmount = Math.max(0, overview.totalSavings)
  const purchasedCount = wishlist.filter((item) => isWishlistPurchased(item)).length

  const editItem = useMemo(
    () => wishlist.find((item) => item.id === editId) ?? null,
    [editId, wishlist]
  )

  const reachedItems = wishlist.filter((item) => getWishlistAvailableAmount(item, currentSavedAmount) >= item.price && item.price > 0).length

  function resetForm() {
    setForm({
      name: '',
      price: '',
      externalContribution: '',
      priority: 'medium',
      image: undefined,
    })
    setEditId(null)
  }

  function handleOpen(entry?: typeof wishlist[number]) {
    if (entry) {
      setEditId(entry.id)
      setForm({
        name: entry.name,
        price: String(entry.price),
        externalContribution: String(getWishlistExternalContribution(entry) || ''),
        priority: entry.priority,
        image: entry.image,
      })
    } else {
      resetForm()
    }

    setOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.price || isSaving) return

    const nextPrice = parseMoneyInput(form.price)
    const nextExternalContribution = parseMoneyInput(form.externalContribution)
    const wasPurchased = editItem?.isPurchased ?? false

    const data = {
      name: form.name.trim(),
      price: nextPrice,
      priority: form.priority,
      savedAmount: wasPurchased ? Math.max(0, nextPrice - nextExternalContribution) : 0,
      externalContribution: nextExternalContribution,
      isPurchased: wasPurchased,
      image: form.image,
    }

    setIsSaving(true)
    try {
      if (editId) {
        await updateWishlistItem(editId, data)
      } else {
        await addWishlistItem(data)
      }

      resetForm()
      setOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTogglePurchased(item: typeof wishlist[number]) {
    if (isSaving || item.price <= 0) return

    const purchased = isWishlistPurchased(item)
    const externalContribution = getWishlistExternalContribution(item)
    const availableToSpend = getWishlistAvailableAmount(item, currentSavedAmount)

    if (!purchased && availableToSpend < item.price) {
      return
    }

    setIsSaving(true)
    try {
      await updateWishlistItem(item.id, {
        savedAmount: purchased ? 0 : Math.max(0, item.price - externalContribution),
        isPurchased: !purchased,
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      await exportWishlistReport(wishlist)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-on-surface md:text-[36px]">Deseos</h1>
          <p className="max-w-2xl text-sm text-muted-gray">
            Organiza cada producto con foto, suma dinero externo si hace falta y mira cuando podrias comprarlo segun tu ahorro real mas aportes extra.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-xl border border-graphite bg-abyss p-1">
            <Button
              type="button"
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              className={viewMode === 'cards' ? 'bg-surface-container-high text-on-surface hover:bg-surface-container-high/80' : 'text-muted-gray'}
              onClick={() => setViewMode('cards')}
            >
              <Grid3X3 data-icon="inline-start" />
              Tarjetas
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className={viewMode === 'list' ? 'bg-surface-container-high text-on-surface hover:bg-surface-container-high/80' : 'text-muted-gray'}
              onClick={() => setViewMode('list')}
            >
              <LayoutList data-icon="inline-start" />
              Lista
            </Button>
          </div>

          <ExportExcelButton loading={isExporting} onClick={handleExport} />
          <Button onClick={() => handleOpen()} className="bg-primary-container text-white hover:bg-primary-container/80 shadow-vault">
            <Plus className="size-4" />
            Agregar artículo
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-0 bg-surface p-5 shadow-vault">
          <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Ahorro disponible</p>
          <p className="mt-3 text-3xl font-semibold text-on-surface">{formatCurrency(currentSavedAmount)}</p>
          <p className="mt-2 text-sm text-muted-gray">
            {overview.reservedForPurchasedWishlist > 0
              ? `${formatCurrency(overview.reservedForPurchasedWishlist)} ya se descontaron por deseos marcados como comprados.`
              : 'Este total se compara automaticamente contra cada producto.'}
          </p>
        </Card>

        <Card className="border-0 bg-surface p-5 shadow-vault">
          <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Promedio mensual</p>
          <p className="mt-3 text-3xl font-semibold text-on-surface">{formatCurrency(averageMonthlySavings)}</p>
          <p className="mt-2 text-sm text-muted-gray">Calculado con tus registros de ahorro reales por mes.</p>
        </Card>

        <Card className="border-0 bg-surface p-5 shadow-vault">
          <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Deseos alcanzables hoy</p>
          <p className="mt-3 text-3xl font-semibold text-on-surface">{reachedItems}</p>
          <p className="mt-2 text-sm text-muted-gray">{purchasedCount} deseo(s) ya marcados como comprados.</p>
        </Card>
      </section>

      {wishlist.length === 0 ? (
        <Card className="border-0 bg-surface shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-gray">
            <ShoppingCart className="size-8" />
            <p>Tu lista de deseos esta vacía</p>
            <Button variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface hover:bg-surface-container-high/80">
              Agrega tu primer artículo
            </Button>
          </div>
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {wishlist.map((item) => {
            const purchased = isWishlistPurchased(item)
            const reservedAmount = getWishlistReservedAmount(item)
            const externalContribution = getWishlistExternalContribution(item)
            const effectiveSavedAmount = getWishlistAvailableAmount(item, currentSavedAmount)
            const canBePurchased = purchased || effectiveSavedAmount >= item.price
            const projection = purchased
              ? {
                  remaining: 0,
                  progress: 100,
                  timelineLabel: 'Ya lo compraste.',
                  purchaseDateLabel: `Descontado del ahorro: ${formatCurrency(reservedAmount)}`,
                  isReady: true,
                }
              : buildPurchaseProjection(item.price, effectiveSavedAmount, averageMonthlySavings, (date) => dateFormatter.format(date))

            return (
              <article key={item.id} className="overflow-hidden rounded-2xl bg-surface shadow-vault">
                <div className="relative h-52 bg-abyss">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(167,139,250,0.18),transparent_55%)]">
                      <ShoppingCart className="size-10 text-muted-gray" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-abyss via-abyss/60 to-transparent px-5 pb-4 pt-10">
                    <Badge variant="outline" className={getPriorityBadgeClass(item.priority)}>
                      Prioridad {getPriorityLabel(item.priority)}
                    </Badge>
                    {purchased ? (
                      <Badge variant="secondary" className="ml-2 bg-emerald-500/15 text-emerald-200">
                        Comprado
                      </Badge>
                    ) : null}
                    <h2 className="mt-2 text-2xl font-semibold text-white">{item.name}</h2>
                    <p className="mt-1 text-sm text-lavender">{formatCurrency(item.price)}</p>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-graphite bg-abyss p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-on-surface">Marcar como comprado</p>
                      <p className="text-xs text-muted-gray">
                        {purchased
                          ? `Ya se descontaron ${formatCurrency(reservedAmount)} de tus ahorros.`
                          : canBePurchased
                            ? `Ya puedes comprarlo. De tus ahorros saldrian ${formatCurrency(Math.max(0, item.price - externalContribution))}.`
                            : `Aun no alcanza el ahorro disponible mas el aporte externo para cubrir ${formatCurrency(item.price)}.`}
                      </p>
                    </div>
                    <Checkbox
                      checked={purchased}
                      disabled={isSaving || !canBePurchased}
                      onCheckedChange={() => void handleTogglePurchased(item)}
                      aria-label={`Marcar ${item.name} como comprado`}
                    />
                  </div>

                  <div className="rounded-xl border border-graphite bg-abyss p-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-muted-gray">Progreso</span>
                      <span className="font-medium text-on-surface">{Math.round(projection.progress)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
                      <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${projection.progress}%` }} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-gray">
                      <span>Tienes: {formatCurrency(effectiveSavedAmount)}</span>
                      <span>Faltan: {formatCurrency(projection.remaining)}</span>
                    </div>
                    {externalContribution > 0 ? (
                      <p className="mt-3 text-xs text-muted-gray">
                        Incluye {formatCurrency(externalContribution)} de dinero externo para este deseo.
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 rounded-xl border border-graphite bg-abyss p-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Tiempo estimado</p>
                      <p className="mt-2 text-sm font-medium text-on-surface">{projection.timelineLabel}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Fecha posible</p>
                      <p className="mt-2 text-sm font-medium text-on-surface">{projection.purchaseDateLabel}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-gray">
                      Basado en {formatCurrency(effectiveSavedAmount)} disponibles y un promedio de {formatCurrency(averageMonthlySavings)} al mes.
                    </p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpen(item)}>
                        <Pencil data-icon="inline-start" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => void removeWishlistItem(item.id)}>
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {wishlist.map((item) => {
            const purchased = isWishlistPurchased(item)
            const reservedAmount = getWishlistReservedAmount(item)
            const externalContribution = getWishlistExternalContribution(item)
            const effectiveSavedAmount = getWishlistAvailableAmount(item, currentSavedAmount)
            const canBePurchased = purchased || effectiveSavedAmount >= item.price
            const projection = purchased
              ? {
                  remaining: 0,
                  progress: 100,
                  timelineLabel: 'Ya lo compraste.',
                  purchaseDateLabel: `Descontado del ahorro: ${formatCurrency(reservedAmount)}`,
                  isReady: true,
                }
              : buildPurchaseProjection(item.price, effectiveSavedAmount, averageMonthlySavings, (date) => dateFormatter.format(date))

            return (
              <article key={item.id} className="rounded-2xl bg-surface p-4 shadow-vault">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                  <div className="flex items-start gap-4 xl:w-[28rem]">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-abyss">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ShoppingCart className="size-7 text-muted-gray" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={getPriorityBadgeClass(item.priority)}>
                          Prioridad {getPriorityLabel(item.priority)}
                        </Badge>
                        {purchased ? (
                          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-200">
                            Comprado
                          </Badge>
                        ) : null}
                      </div>
                      <h2 className="text-xl font-semibold text-on-surface">{item.name}</h2>
                      <p className="text-sm text-primary">{formatCurrency(item.price)}</p>
                      <p className="text-sm text-muted-gray">{projection.purchaseDateLabel}</p>
                    </div>
                  </div>

                  <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="rounded-xl border border-graphite bg-abyss p-4">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-gray">Progreso</span>
                        <span className="font-medium text-on-surface">{Math.round(projection.progress)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
                        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${projection.progress}%` }} />
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-muted-gray">
                        <p>Tienes ahorrados: {formatCurrency(effectiveSavedAmount)}</p>
                        <p>Restante: {formatCurrency(projection.remaining)}</p>
                        {externalContribution > 0 ? <p>Aporte externo: {formatCurrency(externalContribution)}</p> : null}
                        <p>{projection.timelineLabel}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3 rounded-xl border border-graphite bg-abyss p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-on-surface">Marcar como comprado</p>
                          <p className="text-xs text-muted-gray">
                            {purchased
                              ? `Ya se descontaron ${formatCurrency(reservedAmount)} de tus ahorros.`
                              : canBePurchased
                                ? `Marca el check para descontar ${formatCurrency(Math.max(0, item.price - externalContribution))} de tus ahorros.`
                                : 'Todavia no tienes ahorro suficiente, incluso contando el aporte externo.'}
                          </p>
                        </div>
                        <Checkbox
                          checked={purchased}
                          disabled={isSaving || !canBePurchased}
                          onCheckedChange={() => void handleTogglePurchased(item)}
                          aria-label={`Marcar ${item.name} como comprado`}
                        />
                      </div>

                      <p className="rounded-xl border border-graphite bg-abyss p-4 text-sm text-muted-gray">
                        {purchased
                          ? `Este deseo ya fue comprado y se descontaron ${formatCurrency(reservedAmount)} de tus ahorros.`
                          : `Si mantienes este ritmo de ahorro, podras comprarlo el ${projection.purchaseDateLabel.replace('Compra posible: ', '')}.`}
                      </p>

                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpen(item)}>
                          <Pencil data-icon="inline-start" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => void removeWishlistItem(item.id)}>
                          <Trash2 data-icon="inline-start" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!isSaving) setOpen(nextOpen) }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-graphite bg-surface sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar articulo' : 'Agregar deseo'}</DialogTitle>
            <DialogDescription>
              Define el producto aqui. El progreso y la fecha de compra se calculan automaticamente usando tu ahorro total real.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-medium-gray">Nombre del articulo</Label>
              <Input
                placeholder="Laptop nueva"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="border-graphite bg-abyss text-on-surface"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-medium-gray">Precio</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                  className="border-graphite bg-abyss text-on-surface"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-medium-gray">Dinero externo</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.externalContribution}
                  onChange={(event) => setForm((current) => ({ ...current, externalContribution: event.target.value }))}
                  className="border-graphite bg-abyss text-on-surface"
                />
                <p className="text-xs text-muted-gray">
                  Usa este campo si parte del dinero saldra de ingresos extra y no del ahorro calculado por la formula.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-medium-gray">Prioridad</Label>
                <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value as FormState['priority'] }))}>
                  <SelectTrigger className="border-graphite bg-abyss text-on-surface">
                    <SelectValue placeholder="Selecciona prioridad">
                      {getPriorityLabel(form.priority)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border-graphite bg-surface">
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-medium-gray">Foto del producto</Label>
              <ImageUploadField value={form.image} onChange={(image) => setForm((current) => ({ ...current, image }))} />
            </div>

            <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Resumen del deseo</p>
              <p className="mt-2 text-lg font-semibold text-on-surface">{form.name || 'Articulo sin nombre'}</p>
              <p className="mt-1 text-sm text-muted-gray">
                {form.price ? `Meta: ${formatCurrency(parseMoneyInput(form.price))}` : 'Agrega el precio para activar la proyeccion de compra.'}
              </p>
              <p className="mt-1 text-sm text-muted-gray">
                Ahorro real ahora mismo: {formatCurrency(currentSavedAmount)}
              </p>
              <p className="mt-1 text-sm text-muted-gray">
                Aporte externo para este deseo: {formatCurrency(parseMoneyInput(form.externalContribution))}
              </p>
              <p className="mt-1 text-sm text-muted-gray">
                {form.price
                  ? buildPurchaseProjection(
                    parseMoneyInput(form.price),
                    currentSavedAmount + parseMoneyInput(form.externalContribution),
                    averageMonthlySavings,
                    (date) => dateFormatter.format(date),
                  ).purchaseDateLabel
                  : 'Sin fecha estimada todavia.'}
              </p>
            </Card>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              disabled={isSaving}
              onClick={() => {
                resetForm()
                setOpen(false)
              }}
              className="text-muted-gray"
            >
              Cancelar
            </Button>
            <Button loading={isSaving} onClick={() => void handleSave()} className="bg-primary-container text-white hover:brightness-110 shadow-vault">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
