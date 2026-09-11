import { WalletCards } from 'lucide-react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatMoneyWithCode, getCurrencyByCode } from '@/lib/currency'
import { useActiveIncomeAccount } from '@/lib/useActiveIncomeAccount'

export function AccountSwitcher() {
  const { accounts, activeAccount, activeIncomeSourceId, selectAccount } = useActiveIncomeAccount()

  return (
    <Select value={activeIncomeSourceId} onValueChange={(value) => value && selectAccount(value)} disabled={accounts.length === 0}>
      <SelectTrigger
        aria-label="Cuenta activa"
        className="h-11 w-full min-w-0 border-graphite bg-surface/90 text-on-surface shadow-vault-sm sm:w-[250px] sm:shrink-0"
      >
        <WalletCards className="mr-2 size-4 shrink-0 text-primary" />
        <SelectValue>
          {activeAccount ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-semibold">{activeAccount.source.name}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-gray">
                {formatMoneyWithCode(
                  Number(activeAccount.salary.balance ?? activeAccount.salary.amount),
                  getCurrencyByCode(activeAccount.salary.currencyCode),
                )}
              </span>
            </span>
          ) : 'Sin cuentas'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="border-graphite bg-surface text-on-surface">
        {accounts.map((account) => (
          <SelectItem key={account.source.id} value={account.source.id}>
            <span className="min-w-0 flex-1 truncate">{account.source.name}</span>
            <span className="text-xs text-muted-gray">
              {formatMoneyWithCode(
                Number(account.salary.balance ?? account.salary.amount),
                getCurrencyByCode(account.salary.currencyCode),
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
