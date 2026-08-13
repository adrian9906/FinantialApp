import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  type AllocationFormula,
  type AppAppearance,
  type AppBackground,
  type AppTheme,
  defaultFormula,
  formulaPresets,
  formatFormulaLabel,
  getFormulaTotal,
  normalizeFormula,
} from '@plata/shared'

interface PreferencesStore {
  appearance: AppAppearance
  theme: AppTheme
  background: AppBackground
  formula: AllocationFormula
  currencies: CurrencyPreference[]
  activeCurrencyCode: string
  setAppearance: (appearance: AppAppearance) => void
  setTheme: (theme: AppTheme) => void
  setBackground: (background: AppBackground) => void
  setFormula: (formula: AllocationFormula) => void
  setActiveCurrency: (code: string) => void
  saveCurrency: (currency: CurrencyPreference) => void
  removeCurrency: (code: string) => void
  resetPreferences: () => void
}

export interface CurrencyPreference {
  code: string
  name: string
  country: string
  locale: string
  exchangeRate: number
}

export const USD_CURRENCY: CurrencyPreference = {
  code: 'USD',
  name: 'Dólar estadounidense',
  country: 'Estados Unidos',
  locale: 'en-US',
  exchangeRate: 1,
}

const defaultState = {
  appearance: 'dark' as AppAppearance,
  theme: 'obsidian' as AppTheme,
  background: 'grid' as AppBackground,
  formula: defaultFormula,
  currencies: [USD_CURRENCY],
  activeCurrencyCode: 'USD',
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      ...defaultState,
      setAppearance: (appearance) => set({ appearance }),
      setTheme: (theme) => set({ theme }),
      setBackground: (background) => set({ background }),
      setFormula: (formula) => set({ formula: normalizeFormula(formula) }),
      setActiveCurrency: (code) => set((state) => ({
        activeCurrencyCode: state.currencies.some((currency) => currency.code === code) ? code : 'USD',
      })),
      saveCurrency: (currency) => set((state) => {
        const normalized = currency.code === 'USD'
          ? USD_CURRENCY
          : { ...currency, code: currency.code.toUpperCase(), exchangeRate: Math.max(0.000001, currency.exchangeRate) }
        const exists = state.currencies.some((entry) => entry.code === normalized.code)
        return {
          currencies: exists
            ? state.currencies.map((entry) => entry.code === normalized.code ? normalized : entry)
            : [...state.currencies, normalized],
        }
      }),
      removeCurrency: (code) => set((state) => {
        if (code === 'USD') return state
        return {
          currencies: state.currencies.filter((currency) => currency.code !== code),
          activeCurrencyCode: state.activeCurrencyCode === code ? 'USD' : state.activeCurrencyCode,
        }
      }),
      resetPreferences: () => set(defaultState),
    }),
    {
      name: 'plata-preferences',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const saved = persisted as Partial<PreferencesStore>
        const currencies = saved.currencies?.length
          ? [USD_CURRENCY, ...saved.currencies.filter((currency) => currency.code !== 'USD')]
          : current.currencies
        return {
          ...current,
          ...saved,
          currencies,
          activeCurrencyCode: currencies.some((currency) => currency.code === saved.activeCurrencyCode)
            ? saved.activeCurrencyCode ?? 'USD'
            : 'USD',
        }
      },
    }
  )
)

export type { AllocationFormula, AppAppearance, AppBackground, AppTheme }
export { defaultFormula, formulaPresets, formatFormulaLabel, getFormulaTotal }
