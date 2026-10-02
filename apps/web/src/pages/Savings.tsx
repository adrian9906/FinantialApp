import { useMemo, useState } from 'react'
import { buildSavingWithdrawalDescription, getMonthKey, getSavingsFundingBreakdown, getWishlistReservedAmount, isWishlistPurchased, parseSavingDescription } from '@plata/shared'
import { useFinanceStore } from '@/store/financeStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExportExcelButton } from '@/components/reports/ExportExcelButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePickerField } from '@/components/ui/date-picker-field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, PiggyBank, Pencil, ArrowUpRight } from 'lucide-react'
import { useMonthlyOverview } from '@/lib/useMonthlyOverview'
import { formatMoney, formatMoneyWithCode, getCurrencyByCode, useCurrencyInput } from '@/lib/currency'
import { exportSavingsReport } from '@/lib/reportExports'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePreferencesStore } from '@/store/preferencesStore'
import { getTodayDateKey } from '@/lib/date'
import { AccountSavingsPanel } from '@/components/savings/AccountSavingsPanel'
import { IncomeAccountSelect } from '@/components/income/IncomeAccountSelect'
import { findSavingsAccount, getAccountAllocationFormula, getSavingsAccountBalances } from '@/lib/account-savings'
import { useActiveIncomeAccount } from '@/lib/useActiveIncomeAccount'

export default function Savings() {
  const transactions = useFinanceStore((state) => state.transactions)
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const updateTransaction = useFinanceStore((state) => state.updateTransaction)
  const removeTransaction = useFinanceStore((state) => state.removeTransaction)
  const salaries = useFinanceStore((state) => state.salaries)
  const incomeSources = useFinanceStore((state) => state.incomeSources)
  const wishlist = useFinanceStore((state) => state.wishlist)
  const overview = useMonthlyOverview()
  const moneyInput = useCurrencyInput()
  const formula = usePreferencesStore((state) => state.formula)
  const accountSavingsFormulas = usePreferencesStore((state) => state.accountSavingsFormulas)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)
  const setActiveCurrency = usePreferencesStore((state) => state.setActiveCurrency)
  const {
    accounts,
    activeAccount: selectedAccount,
    activeIncomeSourceId: selectedAccountId,
    selectAccount: setSelectedAccountPreference,
  } = useActiveIncomeAccount()
  const savingsCurrencyCode = activeCurrencyCode === 'CUP' ? 'CUP' : 'USD'
  const selectedSavingsSource = findSavingsAccount(incomeSources, savingsCurrencyCode, true)
  const sourceById = useMemo(() => new Map(incomeSources.map((source) => [source.id, source])), [incomeSources])
  const selectedFormula = getAccountAllocationFormula(accountSavingsFormulas, selectedAccountId, formula)
  const wantsEnabled = selectedFormula.wants > 0
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ amount: '', date: getTodayDateKey() })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    target: 'purpose' as 'expense' | 'want' | 'purpose',
    itemName: '',
    date: getTodayDateKey(),
  })

  function resetForm() {
    setForm({ amount: '', date: getTodayDateKey() })
    setEditId(null)
    setFormError(null)
  }

  function resetWithdrawForm() {
    setWithdrawForm({
      amount: moneyInput.fromUsd(Math.max(0, accountAccumulatedSavings)),
      target: 'purpose',
      itemName: '',
      date: getTodayDateKey(),
    })
    setWithdrawError(null)
  }

  function handleOpen(entry?: (typeof transactions)[number]) {
    if (entry) {
      setEditId(entry.id)
      setForm({ amount: moneyInput.fromUsd(entry.amount), date: entry.date })
    } else {
      setEditId(null)
      setForm({ amount: moneyInput.fromUsd(Math.max(0, remaining)), date: getTodayDateKey() })
    }
    setFormError(null)
    setOpen(true)
  }

  function handleOpenWithdraw() {
    setWithdrawForm({
      amount: moneyInput.fromUsd(Math.max(0, accountAccumulatedSavings)),
      target: 'purpose',
      itemName: '',
      date: getTodayDateKey(),
    })
    setWithdrawError(null)
    setWithdrawOpen(true)
  }

  async function handleSave() {
    if (!form.amount || isSaving) return
    const amount = moneyInput.toUsd(form.amount)

    if (editId) {
      const currentAmount = transactions.find((t) => t.id === editId)?.amount ?? 0
      const availableForEdit = Math.max(0, remaining + currentAmount)
      if (amount > availableForEdit) {
        setFormError(`Solo puedes ajustar hasta ${formatMoney(availableForEdit)}.`)
        return
      }
    } else if (amount > remaining) {
      setFormError(`Solo puedes ahorrar hasta ${formatMoney(remaining)}.`)
      return
    }

    const data = {
      amount,
      type: 'saving' as const,
      date: form.date || new Date().toISOString().slice(0, 10),
      incomeSourceId: selectedAccount?.source.id,
      incomeSourceName: selectedAccount?.source.name,
      isCash: selectedAccount?.source.isCash !== false,
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

  const savingsList = transactions.filter((transaction) => {
    if (transaction.type !== 'saving') return false
    const source = transaction.incomeSourceId ? sourceById.get(transaction.incomeSourceId) : undefined
    return (source?.currencyCode ?? 'USD').trim().toUpperCase() === savingsCurrencyCode
  })
  const accountPeriodSavings = overview.periodTransactions
    .filter((transaction) => transaction.type === 'saving'
      && transaction.incomeSourceId === selectedAccountId
      && transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const accountBudgetSavings = (selectedAccount ? selectedAccount.salary.amount : 0) * (selectedFormula.savings / 100)
  const remaining = accountBudgetSavings - accountPeriodSavings
  const budgetFull = remaining <= 0
  const generatedSavingsBalance = selectedSavingsSource
    ? getSavingsAccountBalances(salaries, incomeSources, savingsCurrencyCode, getMonthKey())
    : 0
  const currencyWishlist = wishlist
    .filter((item) => (item.sourceCurrency ?? 'USD').trim().toUpperCase() === savingsCurrencyCode)
  const purchasedWishlistAmount = currencyWishlist
    .filter((item) => isWishlistPurchased(item))
    .reduce((sum, item) => sum + getWishlistReservedAmount(item), 0)
  const accountAccumulatedSavings = Math.max(0, generatedSavingsBalance - purchasedWishlistAmount)
  const availableSavings = accountAccumulatedSavings
  const fundingBreakdown = getSavingsFundingBreakdown(savingsList, currencyWishlist)
  const borrowedSavings = Math.min(availableSavings, Math.max(0, fundingBreakdown.borrowedBalance))
  const ownSavings = Math.max(0, availableSavings - borrowedSavings)
  const availableWithdrawAmount = availableSavings

  async function handleWithdraw() {
    if (isWithdrawing) return
    if (withdrawForm.target === 'want' && !wantsEnabled) {
      setWithdrawError('No puedes enviar dinero a Gustos porque esa sección tiene una asignación de 0%.')
      return
    }

    const amount = moneyInput.toUsd(withdrawForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawError('El monto debe ser mayor que cero.')
      return
    }
    if (amount > availableWithdrawAmount) {
      setWithdrawError(
        `Solo puedes sacar hasta ${formatMoney(availableWithdrawAmount)} de tus ahorros.`,
      )
      return
    }
    if (!withdrawForm.itemName.trim()) {
      setWithdrawError('Escribe un concepto para registrar el movimiento.')
      return
    }

    const movementDate = withdrawForm.date || new Date().toISOString().slice(0, 10)
    const savingWithdrawal = {
      amount: -amount,
      type: 'saving' as const,
      description: buildSavingWithdrawalDescription(withdrawForm.target, withdrawForm.itemName),
      date: movementDate,
      incomeSourceId: selectedAccount?.source.id,
      incomeSourceName: selectedAccount?.source.name,
      isCash: selectedAccount?.source.isCash !== false,
    }
    setIsWithdrawing(true)

    try {
      await addTransaction(savingWithdrawal)

      resetWithdrawForm()
      setWithdrawOpen(false)
    } finally {
      setIsWithdrawing(false)
    }
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      await exportSavingsReport(savingsList)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-on-surface tracking-tight">Ahorros</h1>
          <p className="text-sm text-muted-gray">Página de gestión de ahorros.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ExportExcelButton loading={isExporting} onClick={handleExport} />
          <Button
            variant="secondary"
            disabled={availableSavings <= 0}
            onClick={() => handleOpenWithdraw()}
            className="bg-surface-container-high text-on-surface hover:bg-surface-container-higher disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowUpRight className="size-4" /> Sacar dinero
          </Button>
          <Button onClick={() => handleOpen()} disabled={budgetFull} className="bg-tertiary-container text-white hover:bg-tertiary-container/80 shadow-vault disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus className="size-4" /> Agregar ahorro
          </Button>
        </div>
      </header>

      <Card className="border-graphite bg-surface p-5 shadow-vault">
        <p className="mb-3 text-xs uppercase tracking-[0.18em] text-medium-gray">Cuenta de ahorro</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['USD', 'CUP'] as const).map((currencyCode) => {
            const source = findSavingsAccount(incomeSources, currencyCode, true)
            const balance = source ? getSavingsAccountBalances(salaries, incomeSources, currencyCode, getMonthKey()) : 0
            const active = savingsCurrencyCode === currencyCode
            return (
              <button
                key={currencyCode}
                type="button"
                onClick={() => setActiveCurrency(currencyCode)}
                className={`rounded-2xl border p-4 text-left transition-colors ${active ? 'border-primary bg-primary/10' : 'border-graphite bg-abyss hover:bg-surface-container-low'}`}
              >
                <span className="text-sm font-semibold text-on-surface">Ahorro {currencyCode}</span>
                <span className="mt-2 block text-2xl font-semibold tabular-nums text-success">
                  {formatMoneyWithCode(balance, getCurrencyByCode(currencyCode))}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="border-graphite bg-surface p-5 shadow-vault">
        <IncomeAccountSelect
          accounts={accounts}
          value={selectedAccountId}
          onValueChange={setSelectedAccountPreference}
          label="Cuenta de ingreso para movimientos manuales"
        />
      </Card>

      <AccountSavingsPanel accounts={accounts} />

      <section>
        <Card className="relative overflow-hidden border-success/20 bg-surface p-6 shadow-vault md:p-8">
          <div className="absolute right-0 top-0 size-40 translate-x-12 -translate-y-12 rounded-full bg-success/10" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.22em] text-success">Ahorro total disponible</p>
            <p className="mt-3 text-5xl font-semibold tracking-tight tabular-nums text-on-surface md:text-6xl">
              {formatMoney(accountAccumulatedSavings)}
            </p>
            <p className="mt-3 max-w-xl text-sm text-muted-gray">
              Saldo acumulado de la cuenta, después de compras de deseos, retiros y pagos de deuda.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-success/15 bg-success/5 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-medium-gray">Ahorro propio disponible</p>
                <p className="mt-2 text-xl font-semibold tabular-nums text-success">{formatMoney(ownSavings)}</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200">Adquirido en deuda disponible</p>
                <p className="mt-2 text-xl font-semibold tabular-nums text-amber-200">{formatMoney(borrowedSavings)}</p>
              </div>
            </div>
          </div>
        </Card>

      </section>

      {savingsList.length === 0 ? (
        <Card className="bg-surface border-0 shadow-vault">
          <div className="flex flex-col items-center gap-3 py-16 text-muted-gray text-sm">
            <PiggyBank className="size-8" />
            <p>Sin ahorros registrados</p>
            <Button variant="secondary" onClick={() => handleOpen()} disabled={budgetFull} className="bg-surface-container-high text-on-surface disabled:opacity-40 disabled:cursor-not-allowed">Registrar ahorro</Button>
          </div>
        </Card>
      ) : (
        <div className="bg-surface rounded-xl shadow-vault overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_100px_80px] gap-4 p-4 border-b border-graphite bg-surface-container-lowest text-xs text-muted-gray uppercase tracking-wider font-semibold">
            <span>Fecha</span>
            <span className="text-right">Monto</span>
            <span className="text-right">Acción</span>
          </div>
          <div className="divide-y divide-graphite">
            {savingsList.map((transaction) => (
              <div key={transaction.id} className="group grid grid-cols-1 gap-3 p-4 transition-colors hover:bg-surface-container-low md:grid-cols-[1fr_100px_80px] md:gap-4 md:items-center">
                <div>
                  <p className="text-sm font-medium text-on-surface">
                    {(() => {
                      const savingDetails = parseSavingDescription(transaction.description)
                      if (savingDetails.kind === 'withdrawal') {
                        const baseLabel = savingDetails.target === 'want'
                          ? 'Retirado hacia gustos'
                          : savingDetails.target === 'purpose'
                            ? 'Pagado para un proposito'
                            : 'Retirado hacia gastos'
                        const detail = savingDetails.label ? `${baseLabel}: ${savingDetails.label}` : baseLabel
                        return savingDetails.sourceGoalName ? `${detail} desde ${savingDetails.sourceGoalName}` : detail
                      }
                      if (savingDetails.kind === 'debt-acquisition') {
                        return `Dinero prestado adquirido: ${savingDetails.label ?? 'Deuda'}`
                      }
                      if (savingDetails.kind === 'debt-payment') {
                        return `Pago de deuda desde ahorros: ${savingDetails.label ?? 'Deuda'}`
                      }
                      if (savingDetails.kind !== 'transfer') return 'Ahorro registrado'
                      return savingDetails.source === 'want' ? 'Transferido desde gustos' : 'Transferido desde gastos'
                    })()}
                  </p>
                  <p className="text-xs text-muted-gray">{transaction.date}</p>
                </div>
                <span className={`text-sm font-medium md:text-right ${transaction.amount >= 0 ? 'text-success' : 'text-error'}`}>
                  {transaction.amount >= 0 ? '+' : '-'}{formatMoney(Math.abs(transaction.amount))}
                </span>
                <div className="opacity-100 transition-opacity md:text-right md:opacity-0 md:group-hover:opacity-100">
                  <div className="flex justify-end gap-1">
                    {(() => {
                      const savingDetails = parseSavingDescription(transaction.description)
                      return savingDetails.kind === 'manual' && transaction.amount >= 0 ? (
                        <Button aria-label="Editar ahorro" variant="ghost" size="icon" className="text-muted-gray hover:text-primary" onClick={() => handleOpen(transaction)}>
                          <Pencil data-icon="inline-start" />
                        </Button>
                      ) : null
                    })()}
                    {(() => {
                      const savingDetails = parseSavingDescription(transaction.description)
                      return savingDetails.kind === 'debt-acquisition' || savingDetails.kind === 'debt-payment' ? null : (
                        <Button aria-label="Eliminar ahorro" variant="ghost" size="icon" className="text-muted-gray hover:text-error" onClick={() => void removeTransaction(transaction.id)}>
                          <Trash2 data-icon="inline-start" />
                        </Button>
                      )
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!isSaving) setOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">{editId ? 'Editar ahorro' : 'Agregar ahorro'}</DialogTitle>
            <DialogDescription>Guarda el monto y la fecha del movimiento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-medium-gray">Monto ({moneyInput.currency.code})</Label>
              <Input type="number" placeholder="500" value={form.amount} onChange={(e) => { setFormError(null); setForm({ ...form, amount: e.target.value }) }} className="bg-abyss border-graphite text-on-surface" />
              {!editId && remaining > 0 && (
                <p className="text-xs text-muted-gray">Disponible para ahorrar: {formatMoney(Math.max(0, remaining))}</p>
              )}
            </div>
            <DatePickerField
              label="Fecha"
              value={form.date}
              onChange={(value) => { setFormError(null); setForm({ ...form, date: value }) }}
              description="Elige cuándo entró realmente ese aporte al ahorro."
            />
            {formError ? <p className="text-sm text-error">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={isSaving} onClick={() => { resetForm(); setOpen(false) }} className="text-muted-gray">Cancelar</Button>
            <Button loading={isSaving} onClick={() => void handleSave()} className="bg-primary-container text-white hover:bg-primary-container/80 shadow-vault">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawOpen} onOpenChange={(nextOpen) => { if (!isWithdrawing) setWithdrawOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-on-surface">Sacar dinero de ahorros</DialogTitle>
            <DialogDescription>
              Usa esta opción cuando necesites sacar dinero guardado para un gasto, un gusto o un propósito puntual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-medium-gray">Monto ({moneyInput.currency.code})</Label>
                <Input
                  type="number"
                  placeholder="80"
                  value={withdrawForm.amount}
                  onChange={(e) => {
                    setWithdrawError(null)
                    setWithdrawForm((current) => ({ ...current, amount: e.target.value }))
                  }}
                  className="bg-abyss border-graphite text-on-surface"
                />
                <p className="text-xs text-muted-gray">
                  Disponible: {formatMoney(availableWithdrawAmount)} en ahorro total
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-medium-gray">Pasarlo a</Label>
                <Select
                  value={withdrawForm.target}
                  onValueChange={(value) => {
                    setWithdrawError(null)
                    setWithdrawForm((current) => ({ ...current, target: value as 'expense' | 'want' | 'purpose' }))
                  }}
                >
                  <SelectTrigger className="bg-abyss border-graphite text-on-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-graphite bg-surface">
                    <SelectItem value="purpose">Proposito</SelectItem>
                    <SelectItem value="expense">Gasto</SelectItem>
                    <SelectItem value="want" disabled={!wantsEnabled}>Gusto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-medium-gray">Concepto</Label>
              <Input
                placeholder={
                  withdrawForm.target === 'expense'
                    ? 'Emergencia, medicina, reparacion...'
                    : withdrawForm.target === 'want'
                      ? 'Salida, capricho, compra...'
                      : 'Caja reguladora, tramite, pieza, objetivo pagado...'
                }
                value={withdrawForm.itemName}
                onChange={(e) => {
                  setWithdrawError(null)
                  setWithdrawForm((current) => ({ ...current, itemName: e.target.value }))
                }}
                className="bg-abyss border-graphite text-on-surface"
              />
            </div>

            <DatePickerField
              label="Fecha"
              value={withdrawForm.date}
              onChange={(value) => {
                setWithdrawError(null)
                setWithdrawForm((current) => ({ ...current, date: value }))
              }}
              description={
                withdrawForm.target === 'purpose'
                  ? 'La fecha se guarda en la salida del ahorro para dejar constancia del pago realizado.'
                  : 'La misma fecha se usa para la salida del ahorro y para el movimiento destino.'
              }
            />
            {withdrawError ? <p className="text-sm text-error">{withdrawError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={isWithdrawing}
              onClick={() => {
                resetWithdrawForm()
                setWithdrawOpen(false)
              }}
              className="text-muted-gray"
            >
              Cancelar
            </Button>
            <Button
              loading={isWithdrawing}
              disabled={isWithdrawing || availableWithdrawAmount <= 0}
              onClick={() => void handleWithdraw()}
              className="bg-primary-container text-white hover:bg-primary-container/80 shadow-vault"
            >
              Sacar dinero
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
