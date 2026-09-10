import { ArrowLeftRight, Banknote, WalletCards } from 'lucide-react'

import type { IncomeAccountView } from '@/lib/income-account-view'
import { formatMoneyWithCode, getCurrencyByCode } from '@/lib/currency'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface IncomeAccountSelectProps {
  accounts: IncomeAccountView[]
  value: string
  onValueChange: (value: string) => void
  label?: string
  disabled?: boolean
}

export function IncomeAccountSelect({ accounts, value, onValueChange, label = 'Ingreso desde donde se descuenta', disabled }: IncomeAccountSelectProps) {
  const selected = accounts.find((account) => account.source.id === value)

  return (
    <div className="space-y-2">
      <Label className="text-medium-gray">{label}</Label>
      <Select value={value} onValueChange={(next) => { if (next) onValueChange(next) }} disabled={disabled || accounts.length === 0}>
        <SelectTrigger className="h-auto min-h-11 w-full border-graphite bg-abyss px-3 py-2 text-on-surface">
          <SelectValue>
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                <WalletCards className="size-4 shrink-0 text-primary" />
                <span className="truncate font-medium">{selected.source.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-gray">
                  {formatMoneyWithCode(Number(selected.salary.balance ?? selected.salary.amount), getCurrencyByCode(selected.salary.currencyCode))}
                </span>
              </span>
            ) : 'Selecciona un ingreso'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="border-graphite bg-surface">
          <SelectGroup>
            <SelectLabel>Cuentas de ingreso de este mes</SelectLabel>
            {accounts.map((account) => {
              const currency = getCurrencyByCode(account.salary.currencyCode)
              const PaymentIcon = account.source.isCash === false ? ArrowLeftRight : Banknote
              return (
                <SelectItem key={account.source.id} value={account.source.id}>
                  <PaymentIcon className="size-4 text-muted-gray" />
                  <span className="min-w-0 flex-1 truncate">{account.source.name}</span>
                  <span className="text-xs text-muted-gray">
                    {formatMoneyWithCode(Number(account.salary.balance ?? account.salary.amount), currency)}
                  </span>
                </SelectItem>
              )
            })}
          </SelectGroup>
        </SelectContent>
      </Select>
      {selected ? (
        <p className="text-xs text-muted-gray">
          {selected.source.isCash === false ? 'Transferencia' : 'Efectivo'} · Moneda {selected.salary.currencyCode ?? 'USD'}
        </p>
      ) : (
        <p className="text-xs text-warning">Crea primero un ingreso para este mes.</p>
      )}
    </div>
  )
}
