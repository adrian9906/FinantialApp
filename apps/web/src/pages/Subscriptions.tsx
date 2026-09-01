import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Pencil, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react'
import type { Subscription } from '@plata/shared'
import { useFinanceStore } from '@/store/financeStore'
import { formatMoney, useCurrencyInput } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FormState = { name: string; amount: string; billingDay: string }
const emptyForm: FormState = { name: '', amount: '', billingDay: '1' }

export default function Subscriptions() {
  const subscriptions = useFinanceStore((state) => state.subscriptions)
  const addSubscription = useFinanceStore((state) => state.addSubscription)
  const updateSubscription = useFinanceStore((state) => state.updateSubscription)
  const removeSubscription = useFinanceStore((state) => state.removeSubscription)
  const currencyInput = useCurrencyInput()
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const active = useMemo(() => subscriptions.filter((item) => item.status === 'active'), [subscriptions])
  const cancelled = useMemo(() => subscriptions.filter((item) => item.status === 'cancelled'), [subscriptions])
  const monthlyTotal = active.reduce((sum, item) => sum + item.amount, 0)

  function openForm(item?: Subscription) {
    setEditId(item?.id ?? null)
    setForm(item ? { name: item.name, amount: currencyInput.formatInput(item.amount), billingDay: String(item.billingDay) } : emptyForm)
    setOpen(true)
  }

  async function save() {
    const amount = currencyInput.toUsd(form.amount)
    const billingDay = Math.max(1, Math.min(31, Math.round(Number(form.billingDay))))
    if (!form.name.trim() || !Number.isFinite(amount) || amount <= 0 || saving) return
    setSaving(true)
    try {
      const data = { name: form.name.trim(), amount, billingDay, status: 'active' as const, startedAt: new Date().toISOString().slice(0, 10) }
      if (editId) await updateSubscription(editId, data)
      else await addSubscription(data)
      setOpen(false)
      setForm(emptyForm)
      setEditId(null)
    } finally { setSaving(false) }
  }

  async function toggle(item: Subscription) {
    const cancelling = item.status === 'active'
    await updateSubscription(item.id, {
      status: cancelling ? 'cancelled' : 'active',
      cancelledAt: cancelling ? new Date().toISOString().slice(0, 10) : undefined,
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-on-surface md:text-[36px]">Suscripciones</h1>
          <p className="text-sm text-muted-gray">Pagos mensuales que salen de tus Gastos esenciales. Cancelarlos libera ese presupuesto.</p>
        </div>
        <Button onClick={() => openForm()} className="border border-graphite bg-primary-container text-white hover:bg-primary-container/80"><Plus className="size-4" /> Agregar suscripción</Button>
      </header>

      <Card className="border-0 bg-surface shadow-vault">
        <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm text-muted-gray">Compromiso mensual activo</p><p className="mt-1 text-3xl font-semibold text-on-surface">{formatMoney(monthlyTotal)}</p></div>
          <p className="max-w-md text-sm text-muted-gray">Este importe forma parte de Gastos esenciales y reduce su margen mensual. No crea un pago duplicado en tu historial.</p>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-gray"><span className="size-1.5 rounded-full bg-success" /> Activas ({active.length})</h2>
        {active.length === 0 ? <Card className="border-0 bg-surface p-8 text-center text-sm text-muted-gray shadow-vault">Añade ChatGPT u otro pago recurrente para verlo aquí.</Card> : active.map((item) => <SubscriptionRow key={item.id} item={item} onEdit={openForm} onToggle={toggle} onRemove={removeSubscription} />)}
      </section>

      {cancelled.length > 0 && <section className="space-y-3"><h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-gray"><span className="size-1.5 rounded-full bg-graphite" /> Canceladas ({cancelled.length})</h2>{cancelled.map((item) => <SubscriptionRow key={item.id} item={item} onEdit={openForm} onToggle={toggle} onRemove={removeSubscription} />)}</section>}

      <Dialog open={open} onOpenChange={(value) => !saving && setOpen(value)}>
        <DialogContent className="border-graphite bg-surface sm:max-w-lg"><DialogHeader><DialogTitle>{editId ? 'Editar suscripción' : 'Nueva suscripción'}</DialogTitle><DialogDescription>Ejemplo: ChatGPT, con importe mensual y día aproximado de cobro.</DialogDescription></DialogHeader>
          <div className="space-y-4"><div className="space-y-2"><Label>Nombre</Label><Input value={form.name} placeholder="ChatGPT" onChange={(event) => setForm({ ...form, name: event.target.value })} className="border-graphite bg-abyss" /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Importe mensual</Label><Input inputMode="decimal" value={form.amount} placeholder="20" onChange={(event) => setForm({ ...form, amount: event.target.value })} className="border-graphite bg-abyss" /></div><div className="space-y-2"><Label>Día de cobro</Label><Input type="number" min="1" max="31" value={form.billingDay} onChange={(event) => setForm({ ...form, billingDay: event.target.value })} className="border-graphite bg-abyss" /></div></div></div>
          <DialogFooter><Button variant="ghost" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button><Button loading={saving} onClick={() => void save()} className="bg-primary-container text-white">Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SubscriptionRow({ item, onEdit, onToggle, onRemove }: { item: Subscription; onEdit: (item: Subscription) => void; onToggle: (item: Subscription) => Promise<void>; onRemove: (id: string) => Promise<void> }) {
  const active = item.status === 'active'
  return <Card className={`border-0 bg-surface shadow-vault ${active ? '' : 'opacity-65'}`}><div className="flex items-center gap-3 p-4"><div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-primary/15 text-primary' : 'bg-surface-container-high text-muted-gray'}`}>{active ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}</div><div className="min-w-0 flex-1"><p className="truncate font-medium text-on-surface">{item.name}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-muted-gray"><CalendarDays className="size-3" /> Cada mes, día {item.billingDay}</p></div><p className="shrink-0 font-semibold text-on-surface">{formatMoney(item.amount)}<span className="text-xs font-normal text-muted-gray">/mes</span></p><div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" onClick={() => onEdit(item)} title="Editar"><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => void onToggle(item)} title={active ? 'Cancelar suscripción' : 'Reactivar suscripción'}>{active ? <XCircle className="size-4 text-warning" /> : <RotateCcw className="size-4 text-primary" />}</Button><Button variant="ghost" size="icon" onClick={() => void onRemove(item.id)} title="Eliminar"><Trash2 className="size-4 text-error" /></Button></div></div></Card>
}
