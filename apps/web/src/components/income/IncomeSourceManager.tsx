import { useState } from 'react'
import { ArrowLeftRight, Banknote, Briefcase, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFinanceStore } from '@/store/financeStore'

export function IncomeSourceManager() {
  const incomeSources = useFinanceStore((state) => state.incomeSources)
  const salaries = useFinanceStore((state) => state.salaries)
  const addIncomeSource = useFinanceStore((state) => state.addIncomeSource)
  const updateIncomeSource = useFinanceStore((state) => state.updateIncomeSource)
  const removeIncomeSource = useFinanceStore((state) => state.removeIncomeSource)

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [recurring, setRecurring] = useState(true)
  const [balanceMode, setBalanceMode] = useState<'fixed' | 'zero'>('fixed')
  const [isCash, setIsCash] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function resetForm() {
    setName('')
    setRecurring(true)
    setBalanceMode('fixed')
    setIsCash(true)
    setEditId(null)
    setError(null)
  }

  function openCreate() {
    resetForm()
    setOpen(true)
  }

  function openEdit(id: string) {
    const source = incomeSources.find((entry) => entry.id === id)
    if (!source) return
    setEditId(id)
    setName(source.name)
    setRecurring(source.recurring)
    setBalanceMode(source.balanceMode === 'zero' ? 'zero' : 'fixed')
    setIsCash(source.isCash !== false)
    setError(null)
    setOpen(true)
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Escribe un nombre para la fuente de ingreso.')
      return
    }

    const duplicated = incomeSources.some(
      (entry) => entry.id !== editId && entry.name.trim().toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicated) {
      setError('Ya tienes una fuente con ese nombre.')
      return
    }

    setIsSaving(true)
    try {
      const sourceData: Omit<import('@plata/shared').IncomeSource, 'id'> = {
        name: trimmed,
        recurring,
        balanceMode: recurring ? balanceMode : 'fixed',
        isCash,
      }
      if (editId) await updateIncomeSource(editId, sourceData)
      else await addIncomeSource(sourceData)
      setOpen(false)
      resetForm()
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove(id: string) {
    // Deleting a source removes its registered income, so the amounts stop
    // counting toward the formula. Say so before it happens.
    const affected = salaries.filter((entry) => entry.sourceId === id).length
    const source = incomeSources.find((entry) => entry.id === id)
    const confirmed = window.confirm(
      affected > 0
        ? `Se eliminarán también los ${affected} ingreso(s) registrados de "${source?.name}". ¿Continuar?`
        : `¿Eliminar "${source?.name}"?`,
    )
    if (!confirmed) return

    try {
      await removeIncomeSource(id)
      toast.success('Fuente de ingreso eliminada.')
    } catch {
      toast.error('No se pudo eliminar la fuente.')
    }
  }

  return (
    <Card className="border-graphite bg-surface p-5 shadow-vault">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="size-4 text-primary" aria-hidden="true" />
          <div>
            <h3 className="text-base font-semibold text-on-surface">Fuentes de ingreso</h3>
            <p className="text-xs text-muted-gray">Tus trabajos y otras entradas de dinero.</p>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Agregar
        </Button>
      </div>

      {incomeSources.length === 0 ? (
        <p className="rounded-xl border border-dashed border-graphite bg-abyss/70 p-4 text-sm text-muted-gray">
          Aún no tienes fuentes. Agrega tu trabajo para registrar ingresos por separado.
        </p>
      ) : (
        <ul className="space-y-2">
          {incomeSources.map((source) => (
            <li
              key={source.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-graphite bg-abyss p-3"
            >
              <div>
                <p className="text-sm font-medium text-on-surface">{source.name}</p>
                <p className="text-xs text-muted-gray">
                  {source.recurring
                    ? source.balanceMode === 'zero' ? 'Mensual · comienza en 0' : 'Mensual · conserva el saldo'
                    : 'Solo cuenta este mes'}
                </p>
                <p className={`mt-1 inline-flex items-center gap-1 text-xs ${source.isCash === false ? 'text-sky-300' : 'text-emerald-300'}`}>
                  {source.isCash === false ? <ArrowLeftRight className="size-3.5" /> : <Banknote className="size-3.5" />}
                  {source.isCash === false ? 'Transferencia' : 'Efectivo'}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" aria-label={`Editar ${source.name}`} onClick={() => openEdit(source.id)}>
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Eliminar ${source.name}`} onClick={() => void handleRemove(source.id)}>
                  <Trash2 className="size-4 text-error" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar fuente' : 'Nueva fuente de ingreso'}</DialogTitle>
            <DialogDescription>
              Ponle el nombre de tu trabajo o de la entrada de dinero, por ejemplo "Empresa X" o "Freelance".
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label className="text-medium-gray">Nombre</Label>
              <Input
                value={name}
                onChange={(event) => { setName(event.target.value); setError(null) }}
                placeholder="Empresa X, Freelance, Bonus anual..."
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-medium-gray">Forma de pago de esta cuenta</Label>
              <Select value={isCash ? 'cash' : 'transfer'} onValueChange={(value) => setIsCash(value !== 'transfer')}>
                <SelectTrigger><SelectValue>{isCash ? 'Efectivo' : 'Transferencia'}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash"><Banknote className="size-4" />Efectivo</SelectItem>
                  <SelectItem value="transfer"><ArrowLeftRight className="size-4" />Transferencia</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-gray">Los gastos y gustos tomarán esta forma de pago automáticamente.</p>
            </div>

            <div className="grid gap-2">
              <Label className="text-medium-gray">Tipo</Label>
              <Select value={recurring ? 'recurring' : 'one-off'} onValueChange={(value) => setRecurring(value === 'recurring')}>
                <SelectTrigger>
                  {/* Short labels: the full meaning is spelled out in the hint
                      below, and long options were being clipped in the list. */}
                  <SelectValue>{recurring ? 'Todos los meses' : 'Solo este mes'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Todos los meses</SelectItem>
                  <SelectItem value="one-off">Solo este mes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-gray">
                {recurring
                  ? 'Este ingreso seguirá existiendo automáticamente cada mes.'
                  : 'Como un bonus: solo cuenta en el mes en que lo registras.'}
              </p>
            </div>

            {recurring ? (
              <div className="grid gap-2 rounded-xl border border-graphite bg-abyss p-3">
                <Label className="text-medium-gray">¿Cómo inicia el próximo mes?</Label>
                <Select value={balanceMode} onValueChange={(value) => setBalanceMode(value === 'zero' ? 'zero' : 'fixed')}>
                  <SelectTrigger><SelectValue>{balanceMode === 'zero' ? 'En cero' : 'Con el mismo saldo'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Con el mismo saldo</SelectItem>
                    <SelectItem value="zero">En cero</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-gray">
                  {balanceMode === 'fixed'
                    ? 'Ideal para Salario: el importe se repite automáticamente.'
                    : 'Ideal para Cambio en moneda nacional: aparece en 0 y luego le asignas o transfieres dinero.'}
                </p>
              </div>
            ) : null}

            {error ? <p className="text-sm text-error">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={isSaving} onClick={() => void handleSave()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
