export interface CurrencyCatalogEntry {
  code: string
  name: string
  country: string
  locale: string
  exchangeRate: number
}

export const USD_CURRENCY_ENTRY: CurrencyCatalogEntry = {
  code: 'USD',
  name: 'Dólar estadounidense',
  country: 'Estados Unidos',
  locale: 'en-US',
  exchangeRate: 1,
}

export const CURRENCY_CATALOG: CurrencyCatalogEntry[] = [
  USD_CURRENCY_ENTRY,
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
