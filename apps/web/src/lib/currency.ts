import { useMemo } from 'react'

import { type CurrencyPreference, USD_CURRENCY, usePreferencesStore } from '@/store/preferencesStore'

export const CURRENCY_CATALOG: CurrencyPreference[] = [
  USD_CURRENCY,
  { code: 'CUP', name: 'Peso cubano', country: 'Cuba', locale: 'es-CU', exchangeRate: 670 },
  { code: 'EUR', name: 'Euro', country: 'Unión Europea', locale: 'es-ES', exchangeRate: 0.92 },
  { code: 'MXN', name: 'Peso mexicano', country: 'México', locale: 'es-MX', exchangeRate: 18 },
  { code: 'DOP', name: 'Peso dominicano', country: 'República Dominicana', locale: 'es-DO', exchangeRate: 61 },
  { code: 'COP', name: 'Peso colombiano', country: 'Colombia', locale: 'es-CO', exchangeRate: 4100 },
  { code: 'ARS', name: 'Peso argentino', country: 'Argentina', locale: 'es-AR', exchangeRate: 1300 },
  { code: 'BRL', name: 'Real brasileño', country: 'Brasil', locale: 'pt-BR', exchangeRate: 5.4 },
  { code: 'CAD', name: 'Dólar canadiense', country: 'Canadá', locale: 'en-CA', exchangeRate: 1.38 },
  { code: 'GBP', name: 'Libra esterlina', country: 'Reino Unido', locale: 'en-GB', exchangeRate: 0.79 },
]

const formatterCache = new Map<string, Intl.NumberFormat>()
const decimalFormatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(currency: CurrencyPreference) {
  const key = `${currency.locale}:${currency.code}`
  const cached = formatterCache.get(key)
  if (cached) return cached

  const formatter = new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    currencyDisplay: currency.code === 'USD' ? 'narrowSymbol' : 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  formatterCache.set(key, formatter)
  return formatter
}

export function getActiveCurrency() {
  const { currencies, activeCurrencyCode } = usePreferencesStore.getState()
  return currencies.find((currency) => currency.code === activeCurrencyCode) ?? USD_CURRENCY
}

export function convertFromUsd(value: number, currency = getActiveCurrency()) {
  return value * currency.exchangeRate
}

export function formatMoney(value: number, currency = getActiveCurrency()) {
  const converted = convertFromUsd(Number.isFinite(value) ? value : 0, currency)
  return getFormatter(currency).format(converted)
}

export function formatMoneyWithCode(value: number, currency = getActiveCurrency()) {
  const key = `${currency.locale}:decimal`
  let formatter = decimalFormatterCache.get(key)

  if (!formatter) {
    formatter = new Intl.NumberFormat(currency.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
    decimalFormatterCache.set(key, formatter)
  }

  const converted = convertFromUsd(Number.isFinite(value) ? value : 0, currency)
  return `${formatter.format(converted)} ${currency.code}`
}

export function useMoney() {
  const currencies = usePreferencesStore((state) => state.currencies)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)
  const currency = currencies.find((entry) => entry.code === activeCurrencyCode) ?? USD_CURRENCY

  return useMemo(() => (value: number) => formatMoney(value, currency), [currency])
}

export function useMoneyWithCode() {
  const currencies = usePreferencesStore((state) => state.currencies)
  const activeCurrencyCode = usePreferencesStore((state) => state.activeCurrencyCode)
  const currency = currencies.find((entry) => entry.code === activeCurrencyCode) ?? USD_CURRENCY

  return useMemo(() => (value: number) => formatMoneyWithCode(value, currency), [currency])
}
