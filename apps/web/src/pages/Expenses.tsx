import { useEffect, useState } from 'react'
import { ArrowUpRight, Dumbbell, HeartPulse, House, Package, Pencil, Plus, ShoppingBasket, Trash2, type LucideIcon } from 'lucide-react'
import { useFinanceStore } from '@/store/financeStore'
import { buildExpenseDescription, getPlannedExpenseTotal, parseExpenseDescription, type ExpenseCategory } from '@/lib/expense-utils'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePickerField } from '@/components/ui/date-picker-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ExpenseFormState {
  amount: string
  itemName: string
  category: ExpenseCategory
  date: string
}

interface ExpenseViewItem {
  id: string
  amount: number
  date: string
  itemName: string
  category: ExpenseCategory
  status: 'pending' | 'checked'
}

const CATEGORY_META: Record<
  ExpenseCategory,
  { label: string; hint: string; icon: LucideIcon; accent: string; badge: string; stroke: string }
> = {
  food: {
    label: 'Comida',
    hint: 'Mercado, frutas, snacks y cocina diaria.',
    icon: ShoppingBasket,
    accent: 'text-primary',
    badge: 'bg-primary/15 text-primary',
    stroke: '#8b5cf6',
  },
  home: {
    label: 'Pagos del hogar',
    hint: 'Luz, agua, internet, gas y mantenimiento.',
    icon: House,
    accent: 'text-sky-300',
    badge: 'bg-sky-400/15 text-sky-300',
    stroke: '#7dd3fc',
  },
  gym: {
    label: 'Gym',
    hint: 'Suplementos, cuota, ropa y accesorios.',
    icon: Dumbbell,
    accent: 'text-emerald-300',
    badge: 'bg-emerald-400/15 text-emerald-300',
    stroke: '#6ee7b7',
  },
  health: {
    label: 'Salud',
    hint: 'Medicinas, consultas y cuidado personal.',
    icon: HeartPulse,
    accent: 'text-rose-300',
    badge: 'bg-rose-400/15 text-rose-300',
    stroke: '#fda4af',
  },
  essentials: {
    label: 'Otros esenciales',
    hint: 'Todo lo necesario que no cae en otra categoria.',
    icon: Package,
    accent: 'text-amber-300',
    badge: 'bg-amber-400/15 text-amber-300',
    stroke: '#fcd34d',
  },
}

function HandDrawnStrike({ color }: { color: string }) {
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 360 120"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M18 34
           C 20 20, 38 18, 50 30
           C 58 40, 46 54, 30 50
           C 14 46, 10 28, 18 34
           M 30 38
           C 64 30, 96 18, 130 28
           S 196 48, 230 28
           S 294 18, 336 42"
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: drawn ? 0 : 1,
          transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </svg>
  )
}

function SparkBurst({ color }: { color: string }) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setActive(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20 flex size-10 items-center justify-center">
      {Array.from({ length: 8 }, (_, index) => {
        const rotation = index * 45
        const length = index % 2 === 0 ? 12 : 8

        return (
          <span
            key={rotation}
            className="absolute left-1/2 top-1/2 block h-0.5 rounded-full"
            style={{
              width: `${length}px`,
              backgroundColor: color,
              transform: `translate(-50%, -50%) rotate(${rotation}deg) translateX(${active ? 16 : 3}px) scaleX(${active ? 1 : 0.2})`,
              opacity: active ? 0 : 0.95,
              transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 520ms ease-out',
              transitionDelay: `${index * 18}ms`,
            }}
          />
        )
      })}
    </div>
  )
}

export default function Expenses() {
  const transactions = useFinanceStore((state) => state.transactions)
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const updateTransaction = useFinanceStore((state) => state.updateTransaction)
  const removeTransaction = useFinanceStore((state) => state.removeTransaction)
  const overview = useMonthlyOverview()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [sparkBursts, setSparkBursts] = useState<Record<string, number>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<ExpenseFormState>({
    amount: '',
    itemName: '',
    category: 'food',
    date: '',
  })

  function resetForm() {
    setForm({
      amount: '',
      itemName: '',
      category: 'food',
      date: '',
    })
    setEditId(null)
    setFormError(null)
  }

  function handleOpen(entry?: (typeof transactions)[number]) {
    if (entry) {
      const parsed = parseExpenseDescription(entry.description)
      setEditId(entry.id)
      setForm({
        amount: String(entry.amount),
        itemName: parsed.itemName,
        category: parsed.category,
        date: entry.date,
      })
    } else {
      resetForm()
    }
    setOpen(true)
  }

  async function handleSave() {
    if (!form.amount || !form.itemName || isSaving) return

    const nextAmount = Number(form.amount)
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setFormError('El precio debe ser mayor que cero.')
      return
    }

    if (nextAmount > availableToPlan) {
      setFormError(`Ese precio supera el disponible para planificar: $${availableToPlan.toLocaleString()}.`)
      return
    }

    if (plannedTotal + nextAmount > overview.budgetExpenses) {
      setFormError(`No puedes agregarlo porque la lista total se iria a $${(plannedTotal + nextAmount).toLocaleString()} y tu limite es $${overview.budgetExpenses.toLocaleString()}.`)
      return
    }

    const currentStatus = editId
      ? expenseItems.find((item) => item.id === editId)?.status ?? 'pending'
      : 'pending'

    const data = {
      amount: nextAmount,
      type: 'expense' as const,
      description: buildExpenseDescription(form.category, form.itemName, currentStatus),
      date: form.date || new Date().toISOString().slice(0, 10),
    }

    setIsSaving(true)

    try {
      if (editId) {
        await updateTransaction(editId, data)
      } else {
        await addTransaction(data)
      }

      resetForm()
      setOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const expenseItems: ExpenseViewItem[] = transactions
    .filter((transaction) => transaction.type === 'expense')
    .map((transaction) => {
      const parsed = parseExpenseDescription(transaction.description)
      return {
        id: transaction.id,
        amount: transaction.amount,
        date: transaction.date,
        itemName: parsed.itemName,
        category: parsed.category,
        status: parsed.status,
      }
    })

  const groupedExpenses = Object.entries(CATEGORY_META).map(([key, meta]) => {
    const items = expenseItems
      .filter((item) => item.category === key)
      .sort((a, b) => a.itemName.localeCompare(b.itemName))

    const total = items.reduce((sum, item) => sum + item.amount, 0)
    const completed = items.filter((item) => item.status === 'checked').length

    return {
      key: key as ExpenseCategory,
      meta,
      items,
      total,
      completed,
    }
  })

  const expenseCount = expenseItems.length
  const checkedCount = expenseItems.filter((item) => item.status === 'checked').length
  const pendingCount = expenseItems.filter((item) => item.status === 'pending').length
  const currentItemAmount = editId ? expenseItems.find((item) => item.id === editId)?.amount ?? 0 : 0
  const plannedTotal = getPlannedExpenseTotal(transactions) - currentItemAmount
  const availableToPlan = Math.max(0, overview.budgetExpenses - plannedTotal)
  const pct = overview.budgetExpenses > 0 ? Math.min(100, Math.round((overview.totalExpenses / overview.budgetExpenses) * 100)) : 0
  const remaining = overview.budgetExpenses - overview.totalExpenses
  const typedAmount = Number(form.amount)
  const liveBudgetError = !form.amount
    ? null
    : !Number.isFinite(typedAmount) || typedAmount <= 0
      ? 'El precio debe ser mayor que cero.'
      : typedAmount > availableToPlan
        ? `Te pasas por $${(typedAmount - availableToPlan).toLocaleString()}. Solo te quedan $${availableToPlan.toLocaleString()} disponibles para planificar.`
        : plannedTotal + typedAmount > overview.budgetExpenses
          ? `No puedes agregar este producto porque la lista subiria a $${(plannedTotal + typedAmount).toLocaleString()} y tu limite es $${overview.budgetExpenses.toLocaleString()}.`
          : null

  async function toggleChecked(item: ExpenseViewItem) {
    const nextStatus = item.status === 'checked' ? 'pending' : 'checked'

    if (nextStatus === 'checked') {
      setSparkBursts((bursts) => ({
        ...bursts,
        [item.id]: (bursts[item.id] ?? 0) + 1,
      }))
    }

    await updateTransaction(item.id, {
      amount: item.amount,
      type: 'expense',
      date: item.date,
      description: buildExpenseDescription(item.category, item.itemName, nextStatus),
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-on-surface md:text-[36px]">Gastos</h1>
          <p className="max-w-2xl text-sm text-muted-gray">
            Convierte los gastos esenciales en una lista de compras organizada por categorias. Cada producto sigue guardandose en Prisma como una transaccion de gasto.
          </p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-primary-container text-white shadow-vault hover:bg-primary-container/80">
          <Plus className="size-4" /> Agregar producto
        </Button>
      </header>

      <div className="relative overflow-hidden rounded-xl bg-surface p-6 shadow-vault">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-full bg-primary/8 blur-2xl" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wider text-muted-gray">Presupuesto mensual (50%)</p>
              <Badge variant="secondary" className={remaining >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}>
                {remaining >= 0 ? `$${remaining.toLocaleString()} disponible` : `$${Math.abs(remaining).toLocaleString()} excedido`}
              </Badge>
            </div>
            <h2 className="mb-3 text-[28px] font-semibold text-on-surface">
              ${overview.totalExpenses.toLocaleString()} <span className="text-base font-normal text-muted-gray">/ ${overview.budgetExpenses.toLocaleString()}</span>
            </h2>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div className="h-full rounded-full bg-primary transition-all duration-1000" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-medium-gray">Productos</p>
              <p className="mt-2 text-2xl font-semibold text-on-surface">{expenseCount}</p>
              <p className="mt-1 text-xs text-muted-gray">Items esenciales guardados</p>
            </Card>
            <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-medium-gray">Check hechos</p>
              <p className="mt-2 text-2xl font-semibold text-on-surface">{checkedCount}</p>
              <p className="mt-1 text-xs text-muted-gray">{pendingCount} pendientes por activar</p>
            </Card>
          </div>
        </div>
      </div>

      {expenseItems.length === 0 ? (
        <Card className="border-0 bg-surface shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-gray">
            <ArrowUpRight className="size-8" />
            <p>No hay productos registrados</p>
            <Button variant="secondary" onClick={() => handleOpen()} className="bg-surface-container-high text-on-surface hover:bg-surface-container-higher">
              Crear tu primera lista
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {groupedExpenses.map(({ key, meta, items, total, completed }) => {
            const Icon = meta.icon

            return (
              <Card key={key} className="border-graphite bg-surface shadow-vault">
                <div className="flex items-start justify-between gap-3 border-b border-graphite p-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-11 items-center justify-center rounded-xl bg-abyss ${meta.accent} shadow-vault-sm`}>
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-on-surface">{meta.label}</h3>
                        <p className="text-xs text-muted-gray">{meta.hint}</p>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className={meta.badge}>
                    {items.length} items
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 border-b border-graphite px-5 py-4">
                  <div className="rounded-xl bg-abyss p-3 shadow-vault-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-medium-gray">Total</p>
                    <p className="mt-2 text-lg font-semibold text-on-surface">${total.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-abyss p-3 shadow-vault-sm">
                    <p className="text-xs uppercase tracking-[0.16em] text-medium-gray">Completados</p>
                    <p className="mt-2 text-lg font-semibold text-on-surface">{completed}/{items.length}</p>
                  </div>
                </div>

                <ScrollArea className="h-[360px]">
                  <div className="space-y-3 p-4">
                    {items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-graphite bg-abyss/70 p-5 text-sm text-muted-gray">
                        Aun no hay productos en esta categoria.
                      </div>
                    ) : (
                      items.map((item) => {
                        const isChecked = item.status === 'checked'

                        return (
                          <div
                            key={item.id}
                            className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 ${isChecked
                              ? 'border-primary/30 bg-abyss/90 opacity-80'
                              : 'border-graphite bg-abyss hover:border-outline-variant'
                              }`}
                          >
                            {isChecked ? <HandDrawnStrike color={meta.stroke} /> : null}

                            <div className="relative z-10 flex items-start gap-3">
                              <div className="relative mt-0.5 shrink-0">
                                {sparkBursts[item.id] && isChecked ? <SparkBurst key={`${item.id}-${sparkBursts[item.id]}`} color={meta.stroke} /> : null}
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => void toggleChecked(item)}
                                  aria-label={`Marcar ${item.itemName}`}
                                  className="gap-0"
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className={`text-sm font-medium ${isChecked ? 'text-muted-gray line-through' : 'text-on-surface'}`}>
                                      {item.itemName}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-gray">{item.date}</p>
                                  </div>
                                  <span className={`text-sm font-semibold ${isChecked ? 'text-muted-gray' : 'text-error'}`}>
                                    ${item.amount.toLocaleString()}
                                  </span>
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <span className="text-xs text-muted-gray">
                                    {isChecked ? 'Marcado como comprado' : 'Pendiente por comprar'}
                                  </span>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={isChecked}
                                      className="text-muted-gray hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                                      onClick={() => handleOpen(transactions.find((entry) => entry.id === item.id))}
                                    >
                                      <Pencil data-icon="inline-start" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={isChecked}
                                      className="text-muted-gray hover:text-error disabled:cursor-not-allowed disabled:opacity-30"
                                      onClick={() => void removeTransaction(item.id)}
                                    >
                                      <Trash2 data-icon="inline-start" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!isSaving) setOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar producto' : 'Agregar producto'}</DialogTitle>
            <DialogDescription>Guarda cada producto esencial como un gasto individual, organizado por categoria.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-medium-gray">Categoria</Label>
                <Select value={form.category} onValueChange={(value) => { setFormError(null); setForm((current) => ({ ...current, category: value as ExpenseCategory })) }}>
                  <SelectTrigger className="bg-abyss border-graphite text-on-surface">
                    <SelectValue>{CATEGORY_META[form.category].label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border-graphite bg-surface">
                    {Object.entries(CATEGORY_META).map(([key, meta]) => (
                      <SelectItem key={key} value={key}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-medium-gray">Precio</Label>
                <Input
                  type="number"
                  placeholder="18"
                  value={form.amount}
                  onChange={(e) => { setFormError(null); setForm((current) => ({ ...current, amount: e.target.value })) }}
                  className="bg-abyss border-graphite text-on-surface"
                />
                {liveBudgetError ? <p className="text-xs text-error">{liveBudgetError}</p> : <p className="text-xs text-muted-gray">Puedes planificar hasta ${availableToPlan.toLocaleString()} sin pasarte.</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-medium-gray">Producto</Label>
              <Input
                placeholder="Pechuga de pollo, proteina, detergente..."
                value={form.itemName}
                onChange={(e) => { setFormError(null); setForm((current) => ({ ...current, itemName: e.target.value })) }}
                className="bg-abyss border-graphite text-on-surface"
              />
            </div>

            <DatePickerField
              label="Fecha"
              value={form.date}
              onChange={(value) => { setFormError(null); setForm((current) => ({ ...current, date: value })) }}
              description="Ubica el dia en que este producto entra en tu lista o se compra."
            />

            <Card className="border-graphite bg-abyss p-4 shadow-vault-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-medium-gray">Vista previa</p>
              <p className="mt-2 text-lg font-semibold text-on-surface">
                {form.itemName || 'Producto sin nombre'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className={CATEGORY_META[form.category].badge}>
                  {CATEGORY_META[form.category].label}
                </Badge>
                <span className="text-sm text-muted-gray">
                  {form.amount ? `$${Number(form.amount).toLocaleString()}` : 'Sin precio'}
                </span>
                <span className="text-sm text-muted-gray">
                  {form.date || 'Sin fecha'}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-gray">
                Disponible para planificar: ${availableToPlan.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted-gray">
                El dinero solo se descuenta del presupuesto cuando marques el checkbox del producto.
              </p>
            </Card>
            {formError ? <p className="text-sm text-error">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={isSaving} onClick={() => { resetForm(); setOpen(false) }} className="text-muted-gray">Cancelar</Button>
            <Button
              loading={isSaving}
              onClick={() => void handleSave()}
              disabled={isSaving || !form.amount || !form.itemName}
              className="bg-primary-container text-white shadow-vault hover:brightness-110"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
