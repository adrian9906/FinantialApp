import { Coins } from 'lucide-react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePreferencesStore } from '@/store/preferencesStore'

function rateLabel(rate: number) {
  return rate.toLocaleString('es-ES', { maximumFractionDigits: 6 })
}

export function CurrencySwitcher() {
  const currencies = usePreferencesStore((state) => state.currencies)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)
  const setActiveCurrency = usePreferencesStore((state) => state.setActiveCurrency)
  const active = currencies.find((currency) => currency.code === activeCurrencyCode) ?? currencies[0]

  return (
    <Select value={activeCurrencyCode} onValueChange={(value) => setActiveCurrency(value ?? 'USD')}>
      <SelectTrigger
        aria-label="Moneda de visualización"
        className="h-11 w-[150px] shrink-0 border-graphite bg-surface/90 text-on-surface shadow-vault-sm sm:w-[190px]"
      >
        <Coins className="mr-2 size-4 shrink-0 text-primary" />
        <SelectValue>
          <span className="truncate font-semibold">{active?.code ?? 'USD'}</span>
          <span className="ml-1 hidden truncate text-xs font-normal text-muted-gray sm:inline">
            {active?.code === 'USD' ? '· Base' : `· ×${rateLabel(active?.exchangeRate ?? 1)}`}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="border-graphite bg-surface text-on-surface">
        {currencies.map((currency) => (
          <SelectItem key={currency.code} value={currency.code}>
            <span className="font-semibold">{currency.code}</span>
            <span className="ml-2 text-xs text-muted-gray">
              {currency.code === 'USD' ? 'Moneda base' : `${currency.country} · 1 USD = ${rateLabel(currency.exchangeRate)}`}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
