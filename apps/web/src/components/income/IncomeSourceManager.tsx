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
import { convertUsdToInput, ensureCurrencyPreference, formatMoneyWithCode, getCurrencyByCode } from '@/lib/currency'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { getIncomesForMonth, getMonthKey, normalizeSalaryHistory } from '@plata/shared'

export function IncomeSourceManager() {
  const incomeSources = useFinanceStore((state) => state.incomeSources)
  const salaries = useFinanceStore((state) => state.salaries)
  const addIncomeSource = useFinanceStore((state) => state.addIncomeSource)
  const updateIncomeSource = useFinanceStore((state) => state.updateIncomeSource)
  const removeIncomeSource = useFinanceStore((state) => state.removeIncomeSource)
  const addSalary = useFinanceStore((state) => state.addSalary)
  const updateSalary = useFinanceStore((state) => state.updateSalary)
  const currencies = usePreferencesStore((state) => state.currencies)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)
  const currentMonth = getMonthKey()
  const currentIncomes = getIncomesForMonth(salaries, currentMonth)
  const salaryHistory = normalizeSalaryHistory(salaries)
  const visibleSources = incomeSources.filter((source) => {
    const accountIncome = currentIncomes.find((entry) => entry.sourceId === source.id)
      ?? salaryHistory.find((entry) => entry.sourceId === source.id)
    const accountCurrencyCode = source.currencyCode ?? accountIncome?.currencyCode
    return accountCurrencyCode?.trim().toUpperCase() === activeCurrencyCode.trim().toUpperCase()
  })

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currencyCode, setCurrencyCode] = useState(activeCurrencyCode)
  const [recurring, setRecurring] = useState(true)
  const [balanceMode, setBalanceMode] = useState<'fixed' | 'zero'>('fixed')
  const [isCash, setIsCash] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function resetForm() {
    setName('')
    setAmount('')
    setCurrencyCode(activeCurrencyCode)
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
    const currentIncome = currentIncomes.find((entry) => entry.sourceId === id)
    const latestIncome = salaryHistory.find((entry) => entry.sourceId === id)
    const accountIncome = currentIncome ?? latestIncome
    const accountCurrencyCode = source.currencyCode ?? accountIncome?.currencyCode ?? activeCurrencyCode
    setAmount(currentIncome ? convertUsdToInput(currentIncome.balance ?? currentIncome.amount, getCurrencyByCode(accountCurrencyCode)) : '0')
    setCurrencyCode(accountCurrencyCode)
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

    const parsedAmount = Number(amount.trim().replace(',', '.'))
    if (amount.trim() === '' || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError('Escribe una cantidad válida para esta cuenta. Puede ser 0.')
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
      // Persist the chosen currency as a preference so the account keeps its
      // denomination on other devices instead of falling back to USD.
      ensureCurrencyPreference(currencyCode)
      const sourceData: Omit<import('@plata/shared').IncomeSource, 'id'> = {
        name: trimmed,
        currencyCode,
        recurring,
        balanceMode: recurring ? balanceMode : 'fixed',
        isCash,
      }
      const currency = getCurrencyByCode(currencyCode)
      const amountUsd = parsedAmount / currency.exchangeRate
      const initialIncome = {
        amount: amountUsd,
        balance: amountUsd,
        month: currentMonth,
        currencyCode,
        kind: (recurring ? 'recurring' : 'one-off') as 'recurring' | 'one-off',
        balanceMode: recurring && balanceMode === 'zero' ? 'zero' as const : 'fixed' as const,
      }

      if (editId) {
        const source = incomeSources.find((entry) => entry.id === editId)
        if (!source) throw new Error('No se pudo encontrar la cuenta de ingreso.')
        await updateIncomeSource(editId, sourceData)
        const currentIncome = currentIncomes.find((entry) => entry.sourceId === source.id)
        const incomeData = { ...initialIncome, sourceId: source.id, sourceName: trimmed }
        if (currentIncome) await updateSalary(currentIncome.id, incomeData)
        else await addSalary(incomeData)
      } else {
        await addIncomeSource(sourceData, initialIncome)
      }

      toast.success(editId ? 'Cuenta actualizada.' : 'Cuenta de ingreso creada.')
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
            <h3 className="text-base font-semibold text-on-surface">Cuentas de ingreso</h3>
            <p className="text-xs text-muted-gray">Cada cuenta conserva su propio saldo y moneda.</p>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Nueva cuenta
        </Button>
      </div>

      {visibleSources.length === 0 ? (
        <p className="rounded-xl border border-dashed border-graphite bg-abyss/70 p-4 text-sm text-muted-gray">
          No tienes cuentas en {activeCurrencyCode}. Crea una con su saldo inicial y moneda.
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleSources.map((source) => {
            const currentIncome = currentIncomes.find((entry) => entry.sourceId === source.id)
            const latestIncome = salaryHistory.find((entry) => entry.sourceId === source.id)
            const accountCurrency = getCurrencyByCode(source.currencyCode ?? currentIncome?.currencyCode ?? latestIncome?.currencyCode ?? activeCurrencyCode)
            const accountBalance = currentIncome?.balance ?? currentIncome?.amount ?? 0

            return (
              <li
                key={source.id}
                className="rounded-xl border border-graphite bg-abyss p-4 shadow-vault-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-on-surface">{source.name}</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-on-surface">
                      {formatMoneyWithCode(accountBalance, accountCurrency)}
                    </p>
                    <p className="text-xs text-muted-gray">Saldo disponible · {accountCurrency.name}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" aria-label={`Editar ${source.name}`} onClick={() => openEdit(source.id)}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Eliminar ${source.name}`} onClick={() => void handleRemove(source.id)}>
                      <Trash2 className="size-4 text-error" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-graphite pt-3">
                  <p className="text-xs text-muted-gray">
                    {source.recurring
                      ? source.balanceMode === 'zero' ? 'Mensual · comienza en 0' : 'Mensual · conserva el saldo'
                      : 'Solo cuenta este mes'}
                  </p>
                  <p className={`inline-flex items-center gap-1 text-xs ${source.isCash === false ? 'text-sky-300' : 'text-emerald-300'}`}>
                    {source.isCash === false ? <ArrowLeftRight className="size-3.5" /> : <Banknote className="size-3.5" />}
                    {source.isCash === false ? 'Transferencia' : 'Efectivo'}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar cuenta' : 'Nueva cuenta de ingreso'}</DialogTitle>
            <DialogDescription>
              Define el nombre, cuánto dinero tiene y en qué moneda está guardado.
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <div className="grid gap-2">
                <Label htmlFor="income-account-amount" className="text-medium-gray">Dinero en la cuenta</Label>
                <Input
                  id="income-account-amount"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => { setAmount(event.target.value); setError(null) }}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-medium-gray">Moneda</Label>
                <Select value={currencyCode} onValueChange={(value) => setCurrencyCode(value ?? activeCurrencyCode)}>
                  <SelectTrigger><SelectValue>{currencyCode}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>{currency.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-gray">
              Puedes poner 0 y después asignarle o transferirle dinero.
            </p>

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
