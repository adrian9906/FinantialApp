import { CURRENCY_CATALOG } from '@/lib/currency-catalog'

export interface CurrencyLike {
  code: string
  name: string
  country: string
  locale: string
  exchangeRate: number
}

/**
 * Decides which currency must be added to the user's preferences so an income
 * account keeps its denomination. Returns null when nothing has to change:
 * USD is implicit and an already-saved code keeps the rate the user chose.
 */
export function getMissingCurrencyPreference(
  code: string | undefined,
  currencies: CurrencyLike[],
): CurrencyLike | null {
  const normalizedCode = code?.trim().toUpperCase()
  if (!normalizedCode || normalizedCode === 'USD') return null
  if (currencies.some((currency) => currency.code.trim().toUpperCase() === normalizedCode)) return null

  return CURRENCY_CATALOG.find((currency) => currency.code === normalizedCode)
    ?? { code: normalizedCode, name: normalizedCode, country: '', locale: 'en-US', exchangeRate: 1 }
}
