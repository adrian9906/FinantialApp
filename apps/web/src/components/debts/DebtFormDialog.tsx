import { Landmark } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DebtAccountOption } from '@/lib/debt-record'

export interface DebtFormState {
  incomeSourceId: string
  amount: string
  history: string
  startDate: string
  endDate: string
  interest: string
}

interface Props {
  open: boolean
  editing: boolean
  saving: boolean
  error: string | null
  form: DebtFormState
  accounts: DebtAccountOption[]
  currencyCode: string
  onOpenChange: (open: boolean) => void
  onChange: (form: DebtFormState) => void
  onAccountChange: (id: string) => void
  onCancel: () => void
  onSave: () => void
}

export function DebtFormDialog({ open, editing, saving, error, form, accounts, currencyCode, onOpenChange, onChange, onAccountChange, onCancel, onSave }: Props) {
  const items = [
    { value: 'unassigned', label: 'Sin cuenta asignada' },
    ...accounts.map((account) => ({ value: account.id, label: account.name })),
  ]
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving) onOpenChange(nextOpen) }}>
      <DialogContent className="flex max-h-[min(90dvh,44rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg sm:p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-5 pr-12">
          <div className="flex items-center gap-2 text-primary">
            <Landmark className="size-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em]">Deudas</span>
          </div>
          <DialogTitle className="text-xl">{editing ? 'Editar deuda' : 'Agregar deuda'}</DialogTitle>
          <DialogDescription>Registra el préstamo y la cuenta a la que pertenece.</DialogDescription>
        </DialogHeader>
        <form id="debt-form" className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto px-5 py-5" onSubmit={(event) => { event.preventDefault(); onSave() }}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="debt-account">Cuenta de la deuda</FieldLabel>
              <Select items={items} value={form.incomeSourceId || 'unassigned'} onValueChange={(value) => onAccountChange(value === 'unassigned' ? '' : value ?? '')}>
                <SelectTrigger id="debt-account" className="w-full min-w-0 data-[size=default]:h-11">
                  <SelectValue className="min-w-0"><span className="truncate">{items.find((item) => item.value === (form.incomeSourceId || 'unassigned'))?.label}</span></SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>Moneda de la cuenta: {currencyCode}</FieldDescription>
            </Field>
            <FieldGroup className="grid min-w-0 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
              <Field className="min-w-0">
                <FieldLabel htmlFor="debt-amount">Monto ({currencyCode})</FieldLabel>
                <Input id="debt-amount" type="number" inputMode="decimal" min="0.01" step="any" placeholder="0.00" required value={form.amount} onChange={(event) => onChange({ ...form, amount: event.target.value })} className="h-11" />
              </Field>
              <Field className="min-w-0">
                <FieldLabel htmlFor="debt-interest">Interés (%)</FieldLabel>
                <Input id="debt-interest" type="number" inputMode="decimal" min="0" step="any" placeholder="Opcional" value={form.interest} onChange={(event) => onChange({ ...form, interest: event.target.value })} className="h-11" />
              </Field>
            </FieldGroup>
            <Field>
              <FieldLabel htmlFor="debt-history">Motivo de la deuda</FieldLabel>
              <Input id="debt-history" placeholder="Ej. préstamo personal" required value={form.history} onChange={(event) => onChange({ ...form, history: event.target.value })} className="h-11" />
            </Field>
            <FieldGroup className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Field className="min-w-0">
                <FieldLabel htmlFor="debt-start-date">Fecha de inicio</FieldLabel>
                <Input id="debt-start-date" type="date" required value={form.startDate} onChange={(event) => onChange({ ...form, startDate: event.target.value })} className="h-11 max-w-full dark:[color-scheme:dark]" />
              </Field>
              <Field className="min-w-0">
                <FieldLabel htmlFor="debt-end-date">Fecha de vencimiento</FieldLabel>
                <Input id="debt-end-date" type="date" required min={form.startDate} value={form.endDate} onChange={(event) => onChange({ ...form, endDate: event.target.value })} className="h-11 max-w-full dark:[color-scheme:dark]" />
              </Field>
            </FieldGroup>
            <FieldDescription>Guardar la deuda no descuenta dinero. Los pagos se registran por separado.</FieldDescription>
            {error ? <FieldError role="alert">{error}</FieldError> : null}
          </FieldGroup>
        </form>
        <DialogFooter className="m-0 shrink-0 flex-row gap-3 px-5 py-4">
          <Button variant="outline" disabled={saving} onClick={onCancel} className="h-11 flex-1">Cancelar</Button>
          <Button type="submit" form="debt-form" loading={saving} disabled={saving} className="h-11 flex-1">Guardar deuda</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
