import { useMemo, useState } from 'react'
import { ArrowRightLeft, BadgeDollarSign, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { convertFromUsd, convertToUsd, formatMoneyInput, formatMoneyWithCode, getCurrencyByCode } from '@/lib/currency'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { getActiveIncomeSources, getIncomesForMonth, getMonthKey } from '@plata/shared'

const NEW_SOURCE = '__new__'

interface DestinationFieldsProps {
  destinationId: string
  setDestinationId: (value: string) => void
  newName: string
  setNewName: (value: string) => void
  currencyCode: string
  setCurrencyCode: (value: string) => void
  newRecurring: boolean
  setNewRecurring: (value: boolean) => void
  newBalanceMode: 'fixed' | 'zero'
  setNewBalanceMode: (value: 'fixed' | 'zero') => void
  newIsCash: boolean
  setNewIsCash: (value: boolean) => void
  excludedSourceId?: string
}

function DestinationFields(props: DestinationFieldsProps) {
  const { destinationId, setDestinationId, newName, setNewName, currencyCode, setCurrencyCode, newRecurring, setNewRecurring, newBalanceMode, setNewBalanceMode, newIsCash, setNewIsCash, excludedSourceId } = props
  const sources = useFinanceStore((state) => state.incomeSources)
  const salaries = useFinanceStore((state) => state.salaries)
  const currencies = usePreferencesStore((state) => state.currencies)
  const currentMonth = getMonthKey()
  const destinationSalary = salaries.find((salary) => salary.month === currentMonth && salary.sourceId === destinationId)
  const effectiveCurrency = destinationSalary?.currencyCode ?? currencyCode

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Ingreso de destino</Label>
        <Select value={destinationId} onValueChange={(value) => setDestinationId(value ?? '')}>
          <SelectTrigger className="bg-abyss border-graphite">
            <SelectValue>{destinationId === NEW_SOURCE ? 'Crear ingreso nuevo' : sources.find((source) => source.id === destinationId)?.name ?? 'Seleccionar ingreso'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {getActiveIncomeSources(sources).filter((source) => source.id !== excludedSourceId).map((source) => (
              <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
            ))}
            <SelectItem value={NEW_SOURCE}><Plus className="mr-2 inline size-4" />Crear ingreso nuevo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {destinationId === NEW_SOURCE ? (
        <div className="grid gap-4 rounded-xl border border-graphite bg-abyss p-3">
          <div className="grid gap-2">
            <Label htmlFor="new-income-name">Nombre del nuevo ingreso</Label>
            <Input id="new-income-name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Transferencia, negocio, efectivo..." />
          </div>
          <div className="grid gap-2">
            <Label>¿Cuándo existe?</Label>
            <Select value={newRecurring ? 'recurring' : 'one-off'} onValueChange={(value) => setNewRecurring(value === 'recurring')}>
              <SelectTrigger><SelectValue>{newRecurring ? 'Todos los meses' : 'Solo este mes'}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="recurring">Todos los meses</SelectItem><SelectItem value="one-off">Solo este mes</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Forma de pago</Label>
            <Select value={newIsCash ? 'cash' : 'transfer'} onValueChange={(value) => setNewIsCash(value !== 'transfer')}>
              <SelectTrigger><SelectValue>{newIsCash ? 'Efectivo' : 'Transferencia'}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="transfer">Transferencia</SelectItem></SelectContent>
            </Select>
          </div>
          {newRecurring ? (
            <div className="grid gap-2">
              <Label>¿Cómo inicia el próximo mes?</Label>
              <Select value={newBalanceMode} onValueChange={(value) => setNewBalanceMode(value === 'zero' ? 'zero' : 'fixed')}>
                <SelectTrigger><SelectValue>{newBalanceMode === 'zero' ? 'En cero' : 'Con el mismo saldo'}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="fixed">Con el mismo saldo</SelectItem><SelectItem value="zero">En cero</SelectItem></SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label>Moneda del ingreso</Label>
        <Select value={effectiveCurrency} disabled={Boolean(destinationSalary)} onValueChange={(value) => setCurrencyCode(value ?? 'USD')}>
          <SelectTrigger className="bg-abyss border-graphite"><SelectValue>{effectiveCurrency}</SelectValue></SelectTrigger>
          <SelectContent>{currencies.map((currency) => <SelectItem key={currency.code} value={currency.code}>{currency.code} · {currency.name}</SelectItem>)}</SelectContent>
        </Select>
        {destinationSalary ? <p className="text-xs text-muted-gray">Este ingreso ya trabaja en {effectiveCurrency}.</p> : null}
      </div>
    </div>
  )
}

export function IncomeMoneyActions() {
  const salaries = useFinanceStore((state) => state.salaries)
  const assignIncomeMoney = useFinanceStore((state) => state.assignIncomeMoney)
  const transferIncomeMoney = useFinanceStore((state) => state.transferIncomeMoney)
  const currencies = usePreferencesStore((state) => state.currencies)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)
  const month = getMonthKey()
  const currentIncomes = useMemo(() => getIncomesForMonth(salaries, month).filter((income) => Number(income.balance ?? income.amount) > 0), [salaries, month])

  const [assignOpen, setAssignOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [sourceCurrencyCode, setSourceCurrencyCode] = useState(activeCurrencyCode)
  const [sourceSalaryId, setSourceSalaryId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [newName, setNewName] = useState('')
  const [destinationCurrencyCode, setDestinationCurrencyCode] = useState(activeCurrencyCode)
  const [newRecurring, setNewRecurring] = useState(true)
  const [newBalanceMode, setNewBalanceMode] = useState<'fixed' | 'zero'>('fixed')
  const [newIsCash, setNewIsCash] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const sourceSalary = currentIncomes.find((income) => income.id === sourceSalaryId)
  const sourceCurrency = getCurrencyByCode(sourceSalary?.currencyCode ?? sourceCurrencyCode)
  const destinationSalary = salaries.find((salary) => salary.month === month && salary.sourceId === destinationId)
  const targetCurrency = getCurrencyByCode(destinationSalary?.currencyCode ?? destinationCurrencyCode)
  const nativeAmount = Number(amount.replace(',', '.')) || 0
  const amountUsd = convertToUsd(nativeAmount, sourceCurrency)
  const convertedAmount = convertFromUsd(amountUsd, targetCurrency)

  function reset() {
    setAmount('')
    setSourceSalaryId('')
    setDestinationId('')
    setNewName('')
    setSourceCurrencyCode(activeCurrencyCode)
    setDestinationCurrencyCode(activeCurrencyCode)
    setNewRecurring(true)
    setNewBalanceMode('fixed')
    setNewIsCash(true)
  }

  function destination() {
    return {
      ...(destinationId !== NEW_SOURCE ? { sourceId: destinationId } : { newSourceName: newName }),
      currencyCode: targetCurrency.code,
      recurring: newRecurring,
      balanceMode: newRecurring ? newBalanceMode : 'fixed' as const,
      isCash: newIsCash,
    }
  }

  async function handleAssign() {
    if (!destinationId || amountUsd <= 0 || isSaving) return
    setIsSaving(true)
    try {
      await assignIncomeMoney({ amountUsd, month, destination: destination() })
      toast.success(`Se asignaron ${formatMoneyWithCode(amountUsd, targetCurrency)} al ingreso.`)
      setAssignOpen(false)
      reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo asignar el dinero.')
    } finally { setIsSaving(false) }
  }

  async function handleTransfer() {
    if (!sourceSalaryId || !destinationId || amountUsd <= 0 || isSaving) return
    setIsSaving(true)
    try {
      await transferIncomeMoney({ sourceSalaryId, amountUsd, month, destination: destination() })
      toast.success(`Transferencia completada: ${formatMoneyInput(convertedAmount, targetCurrency)}.`)
      setTransferOpen(false)
      reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo transferir el dinero.')
    } finally { setIsSaving(false) }
  }

  const conversionPreview = amountUsd > 0 ? (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-semibold tabular-nums text-on-surface">
      <span>{formatMoneyInput(nativeAmount, sourceCurrency)}</span>
      <ArrowRightLeft className="size-4 text-primary" aria-hidden="true" />
      <span>{formatMoneyInput(convertedAmount, targetCurrency)}</span>
    </div>
  ) : null

  return (
    <>
      <Card className="border-graphite bg-surface p-5 shadow-vault">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-on-surface">Mover dinero</h3>
          <p className="text-xs text-muted-gray">Convierte con tus tasas guardadas o pásalo entre ingresos.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => { reset(); setAssignOpen(true) }}><BadgeDollarSign className="size-4" />Cambiar y asignar</Button>
          <Button variant="outline" disabled={currentIncomes.length === 0} onClick={() => { reset(); setTransferOpen(true) }}><ArrowRightLeft className="size-4" />Transferir entre ingresos</Button>
        </div>
      </Card>

      <Dialog open={assignOpen} onOpenChange={(open) => { if (!isSaving) setAssignOpen(open) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-lg">
          <DialogHeader><DialogTitle>Cambiar y asignar dinero</DialogTitle><DialogDescription>Indica lo que recibiste y el ingreso donde quedará guardado.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="assign-amount">Monto</Label><Input id="assign-amount" type="number" min="0" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="bg-abyss border-graphite" /></div>
            <div className="grid gap-2"><Label>Moneda que recibiste</Label><Select value={sourceCurrencyCode} onValueChange={(value) => setSourceCurrencyCode(value ?? 'USD')}><SelectTrigger className="bg-abyss border-graphite"><SelectValue>{sourceCurrencyCode}</SelectValue></SelectTrigger><SelectContent>{currencies.map((currency) => <SelectItem key={currency.code} value={currency.code}>{currency.code} · {currency.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DestinationFields destinationId={destinationId} setDestinationId={setDestinationId} newName={newName} setNewName={setNewName} currencyCode={destinationCurrencyCode} setCurrencyCode={setDestinationCurrencyCode} newRecurring={newRecurring} setNewRecurring={setNewRecurring} newBalanceMode={newBalanceMode} setNewBalanceMode={setNewBalanceMode} newIsCash={newIsCash} setNewIsCash={setNewIsCash} />
          {conversionPreview}
          <DialogFooter><Button variant="ghost" disabled={isSaving} onClick={() => setAssignOpen(false)}>Cancelar</Button><Button loading={isSaving} disabled={!destinationId || amountUsd <= 0} onClick={() => void handleAssign()}>Asignar dinero</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={(open) => { if (!isSaving) setTransferOpen(open) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-lg">
          <DialogHeader><DialogTitle>Transferir entre ingresos</DialogTitle><DialogDescription>El valor se convierte automáticamente cuando las monedas son diferentes.</DialogDescription></DialogHeader>
          <div className="grid gap-2"><Label>Desde</Label><Select value={sourceSalaryId} onValueChange={(value) => setSourceSalaryId(value ?? '')}><SelectTrigger className="bg-abyss border-graphite"><SelectValue>{sourceSalary ? `${sourceSalary.sourceName ?? 'Ingreso'} · ${formatMoneyWithCode(Number(sourceSalary.balance ?? sourceSalary.amount), sourceCurrency)}` : 'Seleccionar ingreso'}</SelectValue></SelectTrigger><SelectContent>{currentIncomes.map((income) => <SelectItem key={income.id} value={income.id}>{income.sourceName ?? 'Ingreso'} · {formatMoneyWithCode(Number(income.balance ?? income.amount), getCurrencyByCode(income.currencyCode))}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-2"><Label htmlFor="transfer-amount">Monto a transferir ({sourceCurrency.code})</Label><Input id="transfer-amount" type="number" min="0" max={sourceSalary ? convertFromUsd(Number(sourceSalary.balance ?? sourceSalary.amount), sourceCurrency) : undefined} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="bg-abyss border-graphite" />{sourceSalary ? <p className="text-xs text-muted-gray">Disponible: {formatMoneyWithCode(Number(sourceSalary.balance ?? sourceSalary.amount), sourceCurrency)}</p> : null}</div>
          <DestinationFields destinationId={destinationId} setDestinationId={setDestinationId} newName={newName} setNewName={setNewName} currencyCode={destinationCurrencyCode} setCurrencyCode={setDestinationCurrencyCode} newRecurring={newRecurring} setNewRecurring={setNewRecurring} newBalanceMode={newBalanceMode} setNewBalanceMode={setNewBalanceMode} newIsCash={newIsCash} setNewIsCash={setNewIsCash} excludedSourceId={sourceSalary?.sourceId} />
          {conversionPreview}
          <DialogFooter><Button variant="ghost" disabled={isSaving} onClick={() => setTransferOpen(false)}>Cancelar</Button><Button loading={isSaving} disabled={!sourceSalaryId || !destinationId || amountUsd <= 0} onClick={() => void handleTransfer()}>Transferir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
