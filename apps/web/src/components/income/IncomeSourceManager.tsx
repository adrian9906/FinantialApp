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
import { convertToUsd, convertUsdToInput, ensureCurrencyPreference, formatMoneyWithCode, getCurrencyByCode } from '@/lib/currency'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { getMonthKey, normalizeSalaryHistory } from '@plata/shared'
import { isSavingsIncomeSource } from '@/lib/account-savings'
import { getIncomeAccountsForCycle } from '@/lib/income-account-view'

export function IncomeSourceManager() {
  const incomeSources = useFinanceStore((state) => state.incomeSources)
  const salaries = useFinanceStore((state) => state.salaries)
  const monthlyPlanningHistory = useFinanceStore((state) => state.monthlyPlanningHistory)
  const addIncomeSource = useFinanceStore((state) => state.addIncomeSource)
  const updateIncomeSource = useFinanceStore((state) => state.updateIncomeSource)
  const removeIncomeSource = useFinanceStore((state) => state.removeIncomeSource)
  const addSalary = useFinanceStore((state) => state.addSalary)
  const updateSalary = useFinanceStore((state) => state.updateSalary)
  const addIncomeAccountFunds = useFinanceStore((state) => state.addIncomeAccountFunds)
  const currencies = usePreferencesStore((state) => state.currencies)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)
  const currentIncomes = getIncomeAccountsForCycle(salaries, incomeSources, monthlyPlanningHistory).map((account) => account.salary)
  const salaryHistory = normalizeSalaryHistory(salaries)
  const visibleSources = incomeSources.filter((source) => {
    if (isSavingsIncomeSource(source)) return false
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
  const [addMoneyOpen, setAddMoneyOpen] = useState(false)
  const [addMoneySalaryId, setAddMoneySalaryId] = useState('')
  const [addMoneyAmount, setAddMoneyAmount] = useState('')
  const [addMoneyError, setAddMoneyError] = useState<string | null>(null)
  const [isAddingMoney, setIsAddingMoney] = useState(false)

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
    const displayedAmount = convertUsdToInput(accountIncome?.amount ?? 0, getCurrencyByCode(accountCurrencyCode))
    setAmount(displayedAmount)
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

    const parsedAmount = !editId && amount.trim() === ''
      ? 0
      : Number(amount.trim().replace(',', '.'))
    if ((editId && amount.trim() === '') || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
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

    const existingIncome = editId
      ? currentIncomes.find((entry) => entry.sourceId === editId)
        ?? salaryHistory.find((entry) => entry.sourceId === editId)
      : undefined

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
        month: existingIncome?.month ?? getMonthKey(),
        currencyCode,
        kind: (recurring ? 'recurring' : 'one-off') as 'recurring' | 'one-off',
        balanceMode: recurring && balanceMode === 'zero' ? 'zero' as const : 'fixed' as const,
      }

      if (editId) {
        const source = incomeSources.find((entry) => entry.id === editId)
        if (!source) throw new Error('No se pudo encontrar la cuenta de ingreso.')
        await updateIncomeSource(editId, sourceData)
        // Editing the salary changes its original income amount only. Keep the
        // current balance and transfer adjustments untouched.
        const incomeData = { ...initialIncome, balance: existingIncome?.balance ?? amountUsd, sourceId: source.id, sourceName: trimmed }
        if (existingIncome) await updateSalary(existingIncome.id, incomeData)
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

  function openAddMoney(salaryId: string) {
    setAddMoneySalaryId(salaryId)
    setAddMoneyAmount('')
    setAddMoneyError(null)
    setAddMoneyOpen(true)
  }

  async function handleAddMoney() {
    const salary = salaries.find((entry) => entry.id === addMoneySalaryId)
    const source = salary?.sourceId ? incomeSources.find((entry) => entry.id === salary.sourceId) : undefined
    const currency = getCurrencyByCode(source?.currencyCode ?? salary?.currencyCode ?? activeCurrencyCode)
    const parsedAmount = Number(addMoneyAmount.trim().replace(',', '.'))
    if (!salary || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setAddMoneyError('Escribe un monto mayor que cero.')
      return
    }

    setIsAddingMoney(true)
    try {
      await addIncomeAccountFunds({ salaryId: salary.id, amountUsd: convertToUsd(parsedAmount, currency) })
      toast.success(`Se agregaron ${formatMoneyWithCode(convertToUsd(parsedAmount, currency), currency)} al saldo.`)
      setAddMoneyOpen(false)
      setAddMoneyAmount('')
    } catch (error) {
      setAddMoneyError(error instanceof Error ? error.message : 'No se pudo agregar el dinero.')
    } finally {
      setIsAddingMoney(false)
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
            const accountIncome = currentIncome?.amount ?? latestIncome?.amount ?? 0
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
                    <p className="text-xs text-muted-gray">Saldo restante</p>
                    <p className="mt-1 text-xs text-medium-gray">Ingreso inicial: {formatMoneyWithCode(accountIncome, accountCurrency)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {currentIncome ? (
                      <Button size="sm" variant="outline" onClick={() => openAddMoney(currentIncome.id)}>
                        <Plus className="size-4" aria-hidden="true" />
                        Agregar más dinero
                      </Button>
                    ) : null}
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
                      ? source.balanceMode === 'zero' ? 'Mensual · sin ingreso automático' : 'Mensual · ingreso automático'
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
              {editId
                ? 'Edita el monto original del salario; el saldo restante y las transferencias no se modifican.'
                : 'Define el nombre, el ingreso inicial y la moneda de la cuenta.'}
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
                <Label htmlFor="income-account-amount" className="text-medium-gray">{editId ? 'Monto del salario' : 'Ingreso inicial'}</Label>
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
              {editId
                ? 'Este cambio no suma dinero al saldo. Usa “Agregar más dinero” para aumentar el saldo disponible.'
                : 'Déjalo vacío o escribe 0 para iniciar sin dinero. Después podrás asignarle o transferirle dinero.'}
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
                <Label className="text-medium-gray">Ingreso del próximo mes</Label>
                <Select value={balanceMode} onValueChange={(value) => setBalanceMode(value === 'zero' ? 'zero' : 'fixed')}>
                  <SelectTrigger><SelectValue>{balanceMode === 'zero' ? 'Sin ingreso automático' : 'Repetir ingreso mensual'}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Repetir ingreso mensual</SelectItem>
                    <SelectItem value="zero">Sin ingreso automático</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-gray">
                  {balanceMode === 'fixed'
                    ? 'Conserva el saldo restante y suma el ingreso mensual automáticamente.'
                    : 'Conserva el saldo restante; suma dinero cuando registres un ingreso o una transferencia.'}
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

      <Dialog open={addMoneyOpen} onOpenChange={(next) => { if (!isAddingMoney) setAddMoneyOpen(next) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar más dinero</DialogTitle>
            <DialogDescription>El monto se sumará al saldo disponible sin cambiar el salario inicial.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="income-add-money-amount">Monto ({getCurrencyByCode(
              incomeSources.find((source) => source.id === salaries.find((salary) => salary.id === addMoneySalaryId)?.sourceId)?.currencyCode
                ?? salaries.find((salary) => salary.id === addMoneySalaryId)?.currencyCode
                ?? activeCurrencyCode,
            ).code})</Label>
            <Input
              id="income-add-money-amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={addMoneyAmount}
              onChange={(event) => { setAddMoneyAmount(event.target.value); setAddMoneyError(null) }}
              placeholder="0"
            />
            {addMoneyError ? <p className="text-sm text-error">{addMoneyError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isAddingMoney} onClick={() => setAddMoneyOpen(false)}>Cancelar</Button>
            <Button loading={isAddingMoney} onClick={() => void handleAddMoney()}>Agregar dinero</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
