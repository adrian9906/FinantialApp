import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  type AllocationFormula,
  type AppAppearance,
  type AppBackground,
  type AppIconPack,
  type AppTheme,
  type AppTypographyPreset,
  type CategorizationRule,
  type DashboardWidgetId,
  defaultFormula,
  defaultDashboardWidgets,
  formulaPresets,
  formatFormulaLabel,
  getFormulaTotal,
  normalizeFormula,
} from '@plata/shared'
import type { CustomTypographyOption } from '@/lib/typography'

interface PreferencesStore {
  appearance: AppAppearance
  theme: AppTheme
  background: AppBackground
  typography: AppTypographyPreset | string
  iconPack: AppIconPack
  customFonts: CustomTypographyOption[]
  formula: AllocationFormula
  currencies: CurrencyPreference[]
  activeCurrencyCode: string
  dashboardWidgetsByProfile: Record<string, DashboardWidgetId[]>
  categoryRulesByProfile: Record<string, CategorizationRule[]>
  setAppearance: (appearance: AppAppearance) => void
  setTheme: (theme: AppTheme) => void
  setBackground: (background: AppBackground) => void
  setTypography: (typography: AppTypographyPreset | string) => void
  setIconPack: (iconPack: AppIconPack) => void
  saveCustomFont: (font: CustomTypographyOption) => void
  removeCustomFont: (id: string) => void
  setFormula: (formula: AllocationFormula) => void
  setActiveCurrency: (code: string) => void
  saveCurrency: (currency: CurrencyPreference) => void
  removeCurrency: (code: string) => void
  toggleDashboardWidget: (profileId: string, widgetId: DashboardWidgetId) => void
  moveDashboardWidget: (profileId: string, widgetId: DashboardWidgetId, direction: -1 | 1) => void
  saveCategoryRule: (profileId: string, rule: CategorizationRule) => void
  removeCategoryRule: (profileId: string, ruleId: string) => void
  resetAutomationPreferences: (profileId: string) => void
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

export function normalizeCurrencyPreference(currency: CurrencyPreference): CurrencyPreference {
  const code = currency.code.trim().toUpperCase()

  if (code === 'USD') return USD_CURRENCY

  return {
    ...currency,
    code,
    exchangeRate: Math.max(0.000001, Number(currency.exchangeRate) || 1),
  }
}

function normalizeCurrencies(currencies: CurrencyPreference[]) {
  const uniqueCurrencies = new Map<string, CurrencyPreference>()

  currencies.forEach((currency) => {
    const normalized = normalizeCurrencyPreference(currency)
    if (normalized.code !== 'USD' && !uniqueCurrencies.has(normalized.code)) {
      uniqueCurrencies.set(normalized.code, normalized)
    }
  })

  return [USD_CURRENCY, ...uniqueCurrencies.values()]
}

const defaultState = {
  appearance: 'dark' as AppAppearance,
  theme: 'obsidian' as AppTheme,
  background: 'grid' as AppBackground,
  typography: 'inter' as AppTypographyPreset,
  iconPack: 'lucide' as AppIconPack,
  customFonts: [] as CustomTypographyOption[],
  formula: defaultFormula,
  currencies: [USD_CURRENCY],
  activeCurrencyCode: 'USD',
  dashboardWidgetsByProfile: {},
  categoryRulesByProfile: {},
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      ...defaultState,
      setAppearance: (appearance) => set({ appearance }),
      setTheme: (theme) => set({ theme }),
      setBackground: (background) => set({ background }),
      setTypography: (typography) => set({ typography }),
      setIconPack: (iconPack) => set({ iconPack }),
      saveCustomFont: (font) => set((state) => {
        const exists = state.customFonts.some((entry) => entry.id === font.id)
        const customFonts = exists
          ? state.customFonts.map((entry) => entry.id === font.id ? font : entry)
          : [font, ...state.customFonts]

        return {
          customFonts,
          typography: font.id,
        }
      }),
      removeCustomFont: (id) => set((state) => {
        const customFonts = state.customFonts.filter((font) => font.id !== id)
        return {
          customFonts,
          typography: state.typography === id ? 'inter' : state.typography,
        }
      }),
      setFormula: (formula) => set({ formula: normalizeFormula(formula) }),
      setActiveCurrency: (code) => set((state) => {
        const normalizedCode = code.trim().toUpperCase()
        return {
          activeCurrencyCode: state.currencies.some((currency) => currency.code === normalizedCode) ? normalizedCode : 'USD',
        }
      }),
      saveCurrency: (currency) => set((state) => {
        const normalized = normalizeCurrencyPreference(currency)
        const exists = state.currencies.some((entry) => entry.code === normalized.code)
        return {
          currencies: exists
            ? state.currencies.map((entry) => entry.code === normalized.code ? normalized : entry)
            : [...state.currencies, normalized],
        }
      }),
      removeCurrency: (code) => set((state) => {
        const normalizedCode = code.trim().toUpperCase()
        if (normalizedCode === 'USD') return state
        return {
          currencies: state.currencies.filter((currency) => currency.code !== normalizedCode),
          activeCurrencyCode: state.activeCurrencyCode === normalizedCode ? 'USD' : state.activeCurrencyCode,
        }
      }),
      toggleDashboardWidget: (profileId, widgetId) => set((state) => {
        const current = state.dashboardWidgetsByProfile[profileId] ?? defaultDashboardWidgets
        const next = current.includes(widgetId)
          ? current.filter((id) => id !== widgetId)
          : [...current, widgetId]
        return { dashboardWidgetsByProfile: { ...state.dashboardWidgetsByProfile, [profileId]: next } }
      }),
      moveDashboardWidget: (profileId, widgetId, direction) => set((state) => {
        const current = [...(state.dashboardWidgetsByProfile[profileId] ?? defaultDashboardWidgets)]
        const index = current.indexOf(widgetId)
        const nextIndex = index + direction
        if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return state
        ;[current[index], current[nextIndex]] = [current[nextIndex], current[index]]
        return { dashboardWidgetsByProfile: { ...state.dashboardWidgetsByProfile, [profileId]: current } }
      }),
      saveCategoryRule: (profileId, rule) => set((state) => {
        const current = state.categoryRulesByProfile[profileId] ?? []
        const next = [rule, ...current.filter((entry) => entry.id !== rule.id && entry.pattern.toLocaleLowerCase('es') !== rule.pattern.toLocaleLowerCase('es'))]
        return { categoryRulesByProfile: { ...state.categoryRulesByProfile, [profileId]: next } }
      }),
      removeCategoryRule: (profileId, ruleId) => set((state) => ({
        categoryRulesByProfile: {
          ...state.categoryRulesByProfile,
          [profileId]: (state.categoryRulesByProfile[profileId] ?? []).filter((rule) => rule.id !== ruleId),
        },
      })),
      resetAutomationPreferences: (profileId) => set((state) => ({
        dashboardWidgetsByProfile: { ...state.dashboardWidgetsByProfile, [profileId]: [...defaultDashboardWidgets] },
        categoryRulesByProfile: { ...state.categoryRulesByProfile, [profileId]: [] },
      })),
      resetPreferences: () => set(defaultState),
    }),
    {
      name: 'plata-preferences',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const saved = persisted as Partial<PreferencesStore>
        const currencies = saved.currencies?.length
          ? normalizeCurrencies(saved.currencies)
          : current.currencies
        return {
          ...current,
          ...saved,
          currencies,
          customFonts: saved.customFonts ?? current.customFonts,
          typography: (() => {
            const nextTypography = saved.typography ?? current.typography
            const hasPreset = ['inter', 'space-grotesk', 'manrope', 'ibm-plex-sans', 'playfair-display'].includes(nextTypography)
            const hasCustom = (saved.customFonts ?? current.customFonts).some((font) => font.id === nextTypography)
            return hasPreset || hasCustom ? nextTypography : 'inter'
          })(),
          activeCurrencyCode: currencies.some((currency) => currency.code === saved.activeCurrencyCode?.trim().toUpperCase())
            ? saved.activeCurrencyCode?.trim().toUpperCase() ?? 'USD'
            : 'USD',
        }
      },
    }
  )
)

export type { AllocationFormula, AppAppearance, AppBackground, AppIconPack, AppTheme, AppTypographyPreset }
export { defaultFormula, formulaPresets, formatFormulaLabel, getFormulaTotal }
