import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { ReceiptOCRLineItem } from '@plata/shared'

import { Button } from '@/components/ui/button'
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
import { formatMoney, parseMoneyInputToUsd } from '@/lib/currency'
import { normalizeCurrencyPreference, usePreferencesStore, USD_CURRENCY } from '@/store/preferencesStore'

export interface ReceiptReviewCategory {
  value: string
  label: string
}

/** One row being reviewed. Prices are held as text so the field stays editable. */
interface ReviewRow {
  key: string
  name: string
  price: string
  category: string
}

export interface ReceiptReviewResult {
  name: string
  /** Already converted to USD, the currency everything is stored in. */
  amount: number
  category: string
}

interface ReceiptItemsReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ReceiptOCRLineItem[]
  categories: ReceiptReviewCategory[]
  defaultCategory: string
  /** Suggests a category per product name, using the learned rules. */
  suggestCategory?: (name: string) => string | undefined
  onConfirm: (items: ReceiptReviewResult[]) => Promise<void>
}

export function ReceiptItemsReviewDialog({
  open,
  onOpenChange,
  items,
  categories,
  defaultCategory,
  suggestCategory,
  onConfirm,
}: ReceiptItemsReviewDialogProps) {
  const currencies = usePreferencesStore((state) => state.currencies)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)

  const [currencyCode, setCurrencyCode] = useState(activeCurrencyCode)
  const [rows, setRows] = useState<ReviewRow[]>(() => items.map((item, index) => ({
    key: `${index}-${item.name}`,
    name: item.name.trim(),
    // The OCR reads the amount printed on the receipt, so it is shown in the
    // selected currency rather than converted.
    price: item.price ? String(item.price) : '',
    category: suggestCategory?.(item.name) ?? item.category ?? defaultCategory,
  })))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currency = useMemo(
    () => normalizeCurrencyPreference(
      currencies.find((entry) => entry.code === String(currencyCode).trim().toUpperCase()) ?? USD_CURRENCY,
    ),
    [currencies, currencyCode],
  )

  function updateRow(key: string, patch: Partial<ReviewRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
    setError(null)
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key))
  }

  const totalUsd = rows.reduce((sum, row) => sum + parseMoneyInputToUsd(row.price || 0, currency), 0)

  async function handleConfirm() {
    if (rows.length === 0) {
      setError('No queda ningún producto para agregar.')
      return
    }

    const invalid = rows.find((row) => !row.name.trim() || parseMoneyInputToUsd(row.price || 0, currency) <= 0)
    if (invalid) {
      setError('Revisa que todos los productos tengan nombre y un precio mayor a cero.')
      return
    }

    setIsSaving(true)
    try {
      await onConfirm(rows.map((row) => ({
        name: row.name.trim(),
        amount: parseMoneyInputToUsd(row.price, currency),
        category: row.category,
      })))
      onOpenChange(false)
    } catch {
      setError('No se pudieron agregar los productos. Intenta de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isSaving) onOpenChange(next) }}>
      <DialogContent className="border-graphite bg-surface sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-on-surface">Productos del recibo</DialogTitle>
          <DialogDescription>
            Revisa el precio y elige la categoría de cada producto. Al agregarlos quedarán marcados
            como comprados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-2">
            <Label className="text-medium-gray">Moneda del recibo</Label>
            <Select value={currencyCode} onValueChange={(value) => setCurrencyCode(value ?? activeCurrencyCode)}>
              <SelectTrigger className="bg-abyss border-graphite">
                <SelectValue>{currency.code}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {currencies.map((entry) => (
                  <SelectItem key={entry.code} value={entry.code}>
                    {entry.code} · {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.16em] text-medium-gray">Total</p>
            <p className="text-lg font-semibold text-on-surface">{formatMoney(totalUsd)}</p>
          </div>
        </div>

        <ScrollArea className="max-h-95 pr-2">
          <div className="space-y-2">
            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-graphite bg-abyss/70 p-4 text-sm text-muted-gray">
                No hay productos para revisar.
              </p>
            ) : rows.map((row) => (
              <div
                key={row.key}
                className="grid gap-2 rounded-xl border border-graphite bg-abyss p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto] sm:items-end"
              >
                <div className="grid gap-1">
                  <Label className="text-xs text-medium-gray">Producto</Label>
                  <Input
                    value={row.name}
                    onChange={(event) => updateRow(row.key, { name: event.target.value })}
                    className="bg-surface border-graphite"
                  />
                </div>

                <div className="grid gap-1">
                  <Label className="text-xs text-medium-gray">Precio ({currency.code})</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={row.price}
                    onChange={(event) => updateRow(row.key, { price: event.target.value })}
                    className="bg-surface border-graphite"
                  />
                </div>

                <div className="grid gap-1">
                  <Label className="text-xs text-medium-gray">Categoría</Label>
                  <Select
                    value={row.category}
                    onValueChange={(value) => updateRow(row.key, { category: value ?? defaultCategory })}
                  >
                    <SelectTrigger className="bg-surface border-graphite">
                      <SelectValue>
                        {categories.find((entry) => entry.value === row.category)?.label ?? 'Elegir'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((entry) => (
                        <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar ${row.name || 'producto'}`}
                  className="text-muted-gray hover:text-error"
                  onClick={() => removeRow(row.key)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        {error ? <p className="text-sm text-error">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button loading={isSaving} disabled={rows.length === 0} onClick={() => void handleConfirm()}>
            Agregar {rows.length > 0 ? `${rows.length} producto${rows.length === 1 ? '' : 's'}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
