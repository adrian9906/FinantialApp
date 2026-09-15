interface ExchangeCurrency {
  exchangeRate: number
}

export function parseCurrencyAmount(input: string): number | null {
  const value = input.trim().replace(',', '.')
  if (!/^\d+(?:\.\d*)?$/.test(value)) return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

export function calculateCurrencyAmount(amount: number, from: ExchangeCurrency, to: ExchangeCurrency): number | null {
  if (!Number.isFinite(amount) || amount < 0
    || !Number.isFinite(from.exchangeRate) || from.exchangeRate <= 0
    || !Number.isFinite(to.exchangeRate) || to.exchangeRate <= 0) return null
  const result = amount / from.exchangeRate * to.exchangeRate
  return Number.isFinite(result) ? result : null
}
