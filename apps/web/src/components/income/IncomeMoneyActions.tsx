import { useMemo, useState } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { convertFromUsd, convertToUsd, formatMoneyInput, formatMoneyWithCode, getCurrencyByCode } from '@/lib/currency'
import { useFinanceStore } from '@/store/financeStore'
import { getIncomesForMonth, getMonthKey } from '@plata/shared'

export function IncomeMoneyActions() {
  const salaries = useFinanceStore((state) => state.salaries)
  const transferIncomeMoney = useFinanceStore((state) => state.transferIncomeMoney)
  const month = getMonthKey()
  const currentIncomes = useMemo(() => getIncomesForMonth(salaries, month), [salaries, month])
  const sourceIncomes = currentIncomes.filter((income) => Number(income.balance ?? income.amount) > 0)

  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [sourceSalaryId, setSourceSalaryId] = useState('')
  const [destinationSourceId, setDestinationSourceId] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const sourceSalary = currentIncomes.find((income) => income.id === sourceSalaryId)
  const destinationSalary = currentIncomes.find((income) => income.sourceId === destinationSourceId)
  const destinationIncomes = currentIncomes.filter((income) => income.sourceId !== sourceSalary?.sourceId)
  const sourceCurrency = getCurrencyByCode(sourceSalary?.currencyCode)
  const targetCurrency = getCurrencyByCode(destinationSalary?.currencyCode)
  const nativeAmount = Number(amount.replace(',', '.')) || 0
  const amountUsd = convertToUsd(nativeAmount, sourceCurrency)
  const convertedAmount = convertFromUsd(amountUsd, targetCurrency)

  function reset() {
    setAmount('')
    setSourceSalaryId('')
    setDestinationSourceId('')
  }

  async function handleTransfer() {
    if (!sourceSalary || !destinationSalary || amountUsd <= 0 || isSaving) return
    setIsSaving(true)
    try {
      await transferIncomeMoney({
        sourceSalaryId: sourceSalary.id,
        amountUsd,
        month,
        destination: {
          sourceId: destinationSalary.sourceId,
          currencyCode: targetCurrency.code,
        },
      })
      toast.success(`Transferencia completada: ${formatMoneyInput(convertedAmount, targetCurrency)}.`)
      setOpen(false)
      reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo transferir el dinero.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Card className="border-graphite bg-surface p-5 shadow-vault">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-on-surface">Transferencias entre cuentas</h3>
          <p className="text-xs text-muted-gray">Mueve dinero entre cuentas USD, CUP o de la misma moneda.</p>
        </div>
        <Button
          className="w-full"
          variant="outline"
          disabled={sourceIncomes.length === 0 || currentIncomes.length < 2}
          onClick={() => { reset(); setOpen(true) }}
        >
          <ArrowRightLeft className="size-4" />
          Transferir dinero
        </Button>
        {currentIncomes.length < 2 ? (
          <p className="mt-2 text-xs text-muted-gray">Crea al menos dos cuentas para poder transferir.</p>
        ) : null}
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!isSaving) setOpen(nextOpen) }}>
        <DialogContent className="border-graphite bg-surface sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transferir entre cuentas</DialogTitle>
            <DialogDescription>Si las monedas son diferentes, se aplicará la tasa configurada en Ajustes.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Cuenta de origen</Label>
              <Select value={sourceSalaryId} onValueChange={(value) => { setSourceSalaryId(value ?? ''); setDestinationSourceId(''); setAmount('') }}>
                <SelectTrigger className="border-graphite bg-abyss">
                  <SelectValue>{sourceSalary ? `${sourceSalary.sourceName ?? 'Ingreso'} · ${formatMoneyWithCode(Number(sourceSalary.balance ?? sourceSalary.amount), sourceCurrency)}` : 'Seleccionar cuenta'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sourceIncomes.map((income) => (
                    <SelectItem key={income.id} value={income.id}>
                      {income.sourceName ?? 'Ingreso'} · {formatMoneyWithCode(Number(income.balance ?? income.amount), getCurrencyByCode(income.currencyCode))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Cuenta de destino</Label>
              <Select value={destinationSourceId} disabled={!sourceSalary} onValueChange={(value) => setDestinationSourceId(value ?? '')}>
                <SelectTrigger className="border-graphite bg-abyss">
                  <SelectValue>{destinationSalary ? `${destinationSalary.sourceName ?? 'Ingreso'} · ${destinationSalary.currencyCode ?? 'USD'}` : 'Seleccionar cuenta'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {destinationIncomes.map((income) => (
                    <SelectItem key={income.id} value={income.sourceId ?? income.id}>
                      {income.sourceName ?? 'Ingreso'} · {income.currencyCode ?? 'USD'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transfer-amount">Monto a transferir ({sourceCurrency.code})</Label>
              <Input
                id="transfer-amount"
                type="number"
                min="0"
                max={sourceSalary ? convertFromUsd(Number(sourceSalary.balance ?? sourceSalary.amount), sourceCurrency) : undefined}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="border-graphite bg-abyss"
              />
              {sourceSalary ? (
                <p className="text-xs text-muted-gray">Disponible: {formatMoneyWithCode(Number(sourceSalary.balance ?? sourceSalary.amount), sourceCurrency)}</p>
              ) : null}
            </div>

            {sourceSalary && destinationSalary && amountUsd > 0 ? (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-semibold tabular-nums text-on-surface">
                <span>{formatMoneyInput(nativeAmount, sourceCurrency)}</span>
                <ArrowRightLeft className="size-4 text-primary" aria-hidden="true" />
                <span>{formatMoneyInput(convertedAmount, targetCurrency)}</span>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="ghost" disabled={isSaving} onClick={() => setOpen(false)}>Cancelar</Button>
            <Button loading={isSaving} disabled={!sourceSalary || !destinationSalary || amountUsd <= 0} onClick={() => void handleTransfer()}>Transferir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
