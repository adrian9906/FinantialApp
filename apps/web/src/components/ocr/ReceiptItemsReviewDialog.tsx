import { useMemo, useState } from 'react'
import { ArrowLeftRight, Banknote, Trash2 } from 'lucide-react'
import {
  suggestCategoryFromReceipt,
  type CategorizationRule,
  type ExpenseCategory,
  type ReceiptOCRLineItem,
  type ReceiptOCRTransactionType,
  type WantCategory,
} from '@plata/shared'

import { Button } from '@/components/ui/button'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { formatMoneyInput, getCurrencyByCode, parseMoneyInputToUsd } from '@/lib/currency'
import type { IncomeAccountView } from '@/lib/income-account-view'
import {
  getEligibleReceiptAccounts,
  getMissingReceiptAccountMessage,
  getReceiptCurrencyCodes,
  resolveReceiptAccountId,
  type ReceiptPaymentMethod,
} from '@/lib/receipt-account'
import {
  getDefaultReceiptCategory,
  type ReceiptReviewCategoryGroups,
  type ReceiptReviewResult,
} from '@/lib/receipt-review'
import { getTodayDateKey } from '@/lib/date'
import { normalizeCurrencyPreference, usePreferencesStore, USD_CURRENCY } from '@/store/preferencesStore'

export type { ReceiptReviewResult } from '@/lib/receipt-review'

/** One row being reviewed. Numeric values remain text while the user edits. */
interface ReviewRow {
  key: string
  quantity: string
  name: string
  price: string
  transactionType: ReceiptOCRTransactionType
  category: string
}

interface ReceiptItemsReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ReceiptOCRLineItem[]
  initialDate?: string
  defaultTransactionType: ReceiptOCRTransactionType
  categoryGroups: ReceiptReviewCategoryGroups
  userRules?: readonly CategorizationRule[]
  /** Accounts available this month; the receipt is charged to one of them. */
  accounts: IncomeAccountView[]
  onConfirm: (items: ReceiptReviewResult[], date: string, account: IncomeAccountView) => Promise<void>
}

export function ReceiptItemsReviewDialog({
  open,
  onOpenChange,
  items,
  initialDate,
  defaultTransactionType,
  categoryGroups,
  userRules = [],
  accounts,
  onConfirm,
}: ReceiptItemsReviewDialogProps) {
  const currencies = usePreferencesStore((state) => state.currencies)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)

  function resolveCategory(name: string, transactionType: ReceiptOCRTransactionType, preferred?: string) {
    const options = categoryGroups[transactionType]
    if (preferred && options.some((option) => option.value === preferred)) return preferred

    const suggested = suggestCategoryFromReceipt(name, transactionType, userRules).category
    if (suggested && options.some((option) => option.value === suggested)) return suggested
    return getDefaultReceiptCategory(transactionType)
  }

  const currencyCodes = useMemo(() => getReceiptCurrencyCodes(accounts), [accounts])
  const [date, setDate] = useState(initialDate ?? getTodayDateKey())
  const [currencyCode, setCurrencyCode] = useState(
    () => currencyCodes.includes(activeCurrencyCode.trim().toUpperCase())
      ? activeCurrencyCode.trim().toUpperCase()
      : currencyCodes[0] ?? activeCurrencyCode.trim().toUpperCase(),
  )
  const [paymentMethod, setPaymentMethod] = useState<ReceiptPaymentMethod>('cash')
  const [accountPreference, setAccountPreference] = useState('')
  const [rows, setRows] = useState<ReviewRow[]>(() => items.map((item, index) => ({
    key: `${index}-${item.name}`,
    quantity: String(item.quantity ?? 1),
    name: item.name.trim(),
    price: item.price ? String(item.price) : '',
    transactionType: defaultTransactionType,
    category: resolveCategory(item.name, defaultTransactionType, item.category),
  })))
  const [activeRowKey, setActiveRowKey] = useState(() => items.length > 0 ? `0-${items[0].name}` : '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eligibleAccounts = useMemo(
    () => getEligibleReceiptAccounts(accounts, currencyCode, paymentMethod),
    [accounts, currencyCode, paymentMethod],
  )
  const selectedAccountId = resolveReceiptAccountId(eligibleAccounts, accountPreference)
  const selectedAccount = eligibleAccounts.find((entry) => entry.source.id === selectedAccountId)

  // The receipt is denominated by the account that receives it, so amounts are
  // parsed with that currency instead of a free-floating pick.
  const currency = useMemo(
    () => selectedAccount
      ? getCurrencyByCode(selectedAccount.salary.currencyCode)
      : normalizeCurrencyPreference(
          currencies.find((entry) => entry.code === String(currencyCode).trim().toUpperCase()) ?? USD_CURRENCY,
        ),
    [currencies, currencyCode, selectedAccount],
  )

  function updateRow(key: string, patch: Partial<ReviewRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
    setError(null)
  }

  function changeTransactionType(key: string, transactionType: ReceiptOCRTransactionType) {
    setRows((current) => current.map((row) => row.key === key
      ? { ...row, transactionType, category: resolveCategory(row.name, transactionType) }
      : row))
    setError(null)
  }

  function removeRow(key: string) {
    const index = rows.findIndex((row) => row.key === key)
    const next = rows.filter((row) => row.key !== key)
    setRows(next)
    if (key === activeRowKey) setActiveRowKey(next[Math.min(index, next.length - 1)]?.key ?? '')
  }

  const receiptTotal = rows.reduce((sum, row) => {
    const price = Number(row.price.trim().replace(',', '.'))
    return sum + (Number.isFinite(price) ? price : 0)
  }, 0)

  async function handleConfirm() {
    if (!date) {
      setError('Selecciona la fecha del recibo.')
      return
    }
    if (!selectedAccount) {
      setError(getMissingReceiptAccountMessage(currencyCode, paymentMethod))
      return
    }
    if (rows.length === 0) {
      setError('No queda ningún producto para agregar.')
      return
    }

    const invalid = rows.find((row) => {
      const quantity = Number(row.quantity.trim().replace(',', '.'))
      return !row.name.trim()
        || !Number.isFinite(quantity)
        || quantity <= 0
        || parseMoneyInputToUsd(row.price || 0, currency) <= 0
    })
    if (invalid) {
      setError('Revisa que todos los productos tengan cantidad, nombre y un precio mayor que cero.')
      return
    }

    setIsSaving(true)
    try {
      await onConfirm(rows.map((row): ReceiptReviewResult => {
        const shared = {
          name: row.name.trim(),
          quantity: Number(row.quantity.trim().replace(',', '.')),
          amount: parseMoneyInputToUsd(row.price, currency),
          // The account owns the payment rail; a transfer account can never
          // receive a cash purchase.
          isCash: paymentMethod === 'cash',
        }
        return row.transactionType === 'expense'
          ? { ...shared, transactionType: 'expense', category: row.category as ExpenseCategory }
          : { ...shared, transactionType: 'want', category: row.category as WantCategory }
      }), date, selectedAccount)
      onOpenChange(false)
    } catch {
      setError('No se pudieron agregar los productos. Revisa los presupuestos e intenta de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isSaving) onOpenChange(next) }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden border-graphite bg-surface p-3 sm:max-w-2xl sm:p-5">
        <DialogHeader>
          <DialogTitle className="text-on-surface">Revisar productos del recibo</DialogTitle>
          <DialogDescription className="pr-7 text-xs leading-5 sm:text-sm">
            Toca un producto para editar su categoría, destino y forma de pago.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-3 overflow-y-auto overflow-x-hidden pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-end gap-2 rounded-xl bg-abyss p-3">
            <DatePickerField
              label="Fecha"
              value={date}
              onChange={(value) => { setDate(value); setError(null) }}
            />
            <div className="grid min-w-0 gap-1">
              <Label className="text-xs text-medium-gray">Moneda</Label>
              <Select
                value={currencyCode}
                onValueChange={(value) => {
                  setCurrencyCode((value ?? currencyCode).trim().toUpperCase())
                  setAccountPreference('')
                  setError(null)
                }}
              >
                <SelectTrigger className="min-w-0 border-graphite bg-surface">
                  <SelectValue>{currencyCode}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(currencyCodes.length > 0 ? currencyCodes : [currencyCode]).map((code) => (
                    <SelectItem key={code} value={code}>
                      {code} · {currencies.find((entry) => entry.code === code)?.name ?? code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 grid gap-1">
              <Label className="text-xs text-medium-gray">Forma de pago</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => {
                  setPaymentMethod(value === 'transfer' ? 'transfer' : 'cash')
                  setAccountPreference('')
                  setError(null)
                }}
              >
                <SelectTrigger className="border-graphite bg-surface">
                  <SelectValue>{paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {eligibleAccounts.length > 1 ? (
              <div className="col-span-2 grid gap-1">
                <Label className="text-xs text-medium-gray">Cuenta</Label>
                <Select
                  value={selectedAccountId}
                  onValueChange={(value) => { setAccountPreference(value ?? ''); setError(null) }}
                >
                  <SelectTrigger className="border-graphite bg-surface">
                    <SelectValue>{selectedAccount?.source.name ?? 'Seleccionar cuenta'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleAccounts.map((entry) => (
                      <SelectItem key={entry.source.id} value={entry.source.id}>
                        {entry.source.name} · {formatMoneyInput(Number(entry.salary.balance ?? entry.salary.amount), currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {selectedAccount ? (
              eligibleAccounts.length === 1 ? (
                <p className="col-span-2 text-[11px] text-muted-gray">
                  Se cargará a <span className="text-on-surface">{selectedAccount.source.name}</span>.
                </p>
              ) : null
            ) : (
              <p className="col-span-2 rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs leading-5 text-warning">
                {getMissingReceiptAccountMessage(currencyCode, paymentMethod)}
              </p>
            )}

            <div className="col-span-2 flex items-center justify-between border-t border-graphite/70 pt-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-medium-gray">{rows.length} productos</p>
              <p className="text-base font-semibold tabular-nums text-on-surface">{formatMoneyInput(receiptTotal, currency)}</p>
            </div>
          </div>

          <div className="space-y-2">
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-graphite bg-abyss/70 p-4 text-sm text-muted-gray">
              No hay productos para revisar.
            </p>
          ) : rows.map((row, index) => {
            const categories = categoryGroups[row.transactionType]
            const isActive = row.key === activeRowKey
            return (
              <article key={row.key} className={`min-w-0 rounded-xl border bg-abyss transition-colors ${isActive ? 'border-primary/45' : 'border-graphite'}`}>
                <div className="flex min-w-0 items-center gap-1 p-2">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setActiveRowKey(row.key)}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-on-surface">{row.quantity || '1'} × {row.name || 'Producto sin nombre'}</span>
                      <span className="block truncate text-[11px] text-muted-gray">{row.transactionType === 'expense' ? 'Gasto' : 'Gusto'} · {paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-sm font-semibold text-on-surface">{row.price || '0'}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar ${row.name || 'producto'}`}
                    className="shrink-0 text-muted-gray hover:text-error"
                    onClick={() => removeRow(row.key)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>

                {isActive ? <div className="grid grid-cols-2 gap-2 border-t border-graphite/70 p-3 sm:grid-cols-6 sm:items-end">
                  <div className="grid gap-1">
                    <Label className="text-xs text-medium-gray">Cantidad</Label>
                    <Input type="number" inputMode="decimal" min="0.01" value={row.quantity} onChange={(event) => updateRow(row.key, { quantity: event.target.value })} className="border-graphite bg-surface" />
                  </div>
                  <div className="col-span-2 grid gap-1 sm:col-span-3">
                    <Label className="text-xs text-medium-gray">Producto</Label>
                    <Input value={row.name} onChange={(event) => updateRow(row.key, { name: event.target.value })} className="border-graphite bg-surface" />
                  </div>
                  <div className="grid gap-1 sm:col-span-2">
                    <Label className="text-xs text-medium-gray">Precio ({currency.code})</Label>
                    <Input type="number" inputMode="decimal" min="0.01" value={row.price} onChange={(event) => updateRow(row.key, { price: event.target.value })} className="border-graphite bg-surface" />
                  </div>
                  <div className="grid gap-1 sm:col-span-2">
                    <Label className="text-xs text-medium-gray">Enviar a</Label>
                    <Select value={row.transactionType} onValueChange={(value) => changeTransactionType(row.key, value as ReceiptOCRTransactionType)}>
                      <SelectTrigger className="border-graphite bg-surface">
                        <SelectValue>{row.transactionType === 'expense' ? 'Gastos' : 'Gustos'}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Gastos</SelectItem>
                        <SelectItem value="want">Gustos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1 sm:col-span-2">
                    <Label className="text-xs text-medium-gray">Categoría</Label>
                    <Select value={row.category} onValueChange={(value) => updateRow(row.key, { category: value ?? getDefaultReceiptCategory(row.transactionType) })}>
                      <SelectTrigger className="border-graphite bg-surface">
                        <SelectValue>{categories.find((entry) => entry.value === row.category)?.label ?? 'Elegir'}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div> : null}

                {isActive ? <div className="mx-3 mb-3 min-w-0 rounded-lg bg-surface px-3 py-2.5">
                  <div className="flex min-w-0 items-center justify-between gap-2 opacity-60">
                    <span className={`inline-flex items-center gap-2 text-sm ${paymentMethod === 'cash' ? 'text-emerald-300' : 'text-muted-gray'}`}>
                      <Banknote className="size-4 shrink-0" aria-hidden="true" /> <span className="hidden min-[360px]:inline">Efectivo</span>
                    </span>
                    <Switch
                      checked={paymentMethod === 'transfer'}
                      disabled
                      aria-label={`${row.name}: ${paymentMethod === 'cash' ? 'efectivo' : 'transferencia'}`}
                    />
                    <span className={`inline-flex items-center gap-2 text-sm ${paymentMethod === 'transfer' ? 'text-sky-300' : 'text-muted-gray'}`}>
                      <ArrowLeftRight className="size-4 shrink-0" aria-hidden="true" /> <span className="hidden min-[360px]:inline">Transferencia</span>
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-4 text-muted-gray">
                    La forma de pago la define la cuenta{selectedAccount ? ` ${selectedAccount.source.name}` : ''}; cámbiala arriba para todo el recibo.
                  </p>
                </div> : null}
              </article>
            )
          })}
          </div>

          {error ? <p className="text-sm text-error">{error}</p> : null}
        </div>

        <DialogFooter className="-mx-3 -mb-3 shrink-0 px-3 py-3 sm:-mx-5 sm:-mb-5 sm:px-5">
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button loading={isSaving} disabled={rows.length === 0 || !selectedAccount} onClick={() => void handleConfirm()}>
            Crear {rows.length > 0 ? `${rows.length} producto${rows.length === 1 ? '' : 's'}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
