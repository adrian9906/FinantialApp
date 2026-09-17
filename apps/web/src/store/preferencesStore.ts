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
import type { AccountSavingsFormulas } from '@/lib/account-savings'
import { requestJson } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

interface PreferencesStore {
  appearance: AppAppearance
  theme: AppTheme
  background: AppBackground
  typography: AppTypographyPreset | string
  iconPack: AppIconPack
  customFonts: CustomTypographyOption[]
  formula: AllocationFormula
  financialPreferencesUserId: string | null
  /** Savings percentage per income account, keyed by income source id. */
  accountSavingsFormulas: AccountSavingsFormulas
  currencies: CurrencyPreference[]
  activeCurrencyCode: string
  /** Globally selected income account. Every financial view scopes itself to it. */
  activeIncomeSourceId: string
  dashboardWidgetsByProfile: Record<string, DashboardWidgetId[]>
  categoryRulesByProfile: Record<string, CategorizationRule[]>
  systemNotificationsEnabled: boolean
  connectionNotificationsEnabled: boolean
  syncNotificationsEnabled: boolean
  setAppearance: (appearance: AppAppearance) => void
  setTheme: (theme: AppTheme) => void
  setBackground: (background: AppBackground) => void
  setTypography: (typography: AppTypographyPreset | string) => void
  setIconPack: (iconPack: AppIconPack) => void
  saveCustomFont: (font: CustomTypographyOption) => void
  removeCustomFont: (id: string) => void
  setFormula: (formula: AllocationFormula) => void
  setAccountFormula: (sourceId: string, formula: AllocationFormula) => void
  setActiveCurrency: (code: string) => void
  setActiveIncomeSource: (sourceId: string) => void
  saveCurrency: (currency: CurrencyPreference) => void
  registerCurrency: (currency: CurrencyPreference) => void
  removeCurrency: (code: string) => void
  hydrateCurrencyPreferences: (userId: string) => Promise<void>
  syncCurrencyPreferences: () => Promise<void>
  toggleDashboardWidget: (profileId: string, widgetId: DashboardWidgetId) => void
  moveDashboardWidget: (profileId: string, widgetId: DashboardWidgetId, direction: -1 | 1) => void
  saveCategoryRule: (profileId: string, rule: CategorizationRule) => void
  removeCategoryRule: (profileId: string, ruleId: string) => void
  resetAutomationPreferences: (profileId: string) => void
  setSystemNotificationsEnabled: (enabled: boolean) => void
  setConnectionNotificationsEnabled: (enabled: boolean) => void
  setSyncNotificationsEnabled: (enabled: boolean) => void
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

interface CurrencyPreferencesResponse {
  exists: boolean
  currencies: CurrencyPreference[]
  activeCurrencyCode: string
  activeIncomeSourceId: string
  accountSavingsFormulas?: AccountSavingsFormulas
  formula?: AllocationFormula | null
}

interface FinancialPreferencesPatch {
  currencies?: CurrencyPreference[]
  discoveredCurrencies?: CurrencyPreference[]
  activeCurrencyCode?: string
  activeIncomeSourceId?: string
  accountSavingsFormulas?: AccountSavingsFormulas
  formula?: AllocationFormula
  removedCurrencyCodes?: string[]
  resetAccountFormulas?: boolean
}

let currencySyncInFlight: Promise<void> | null = null
let preferencesLoadInFlight: { userId: string; promise: Promise<void> } | null = null
let loadedPreferencesUserId: string | null = null

function getCurrencyPendingKey(userId: string) {
  return `plata-currency-preferences-pending:${userId}`
}

function readPendingPatch(userId: string): FinancialPreferencesPatch {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(`plata-financial-preferences-pending:${userId}`)
  if (raw) {
    try { return JSON.parse(raw) as FinancialPreferencesPatch } catch { return {} }
  }
  const state = usePreferencesStore.getState()
  if (window.localStorage.getItem(getCurrencyPendingKey(userId)) === '1'
    && (!state.financialPreferencesUserId || state.financialPreferencesUserId === userId)) {
    return { currencies: state.currencies, activeCurrencyCode: state.activeCurrencyCode, accountSavingsFormulas: state.accountSavingsFormulas }
  }
  return {}
}

function writePendingPatch(userId: string, patch: FinancialPreferencesPatch) {
  if (typeof window === 'undefined') return
  const key = `plata-financial-preferences-pending:${userId}`
  if (Object.keys(patch).length) window.localStorage.setItem(key, JSON.stringify(patch))
  else window.localStorage.removeItem(key)
  window.localStorage.removeItem(getCurrencyPendingKey(userId))
}

function mergePendingPatch(previous: FinancialPreferencesPatch, next: FinancialPreferencesPatch): FinancialPreferencesPatch {
  const result = { ...previous, ...next }
  if (previous.discoveredCurrencies || next.discoveredCurrencies) {
    result.discoveredCurrencies = [...new Map([...(previous.discoveredCurrencies ?? []), ...(next.discoveredCurrencies ?? [])].map((currency) => [currency.code, currency])).values()]
  }
  if (previous.currencies || next.currencies) {
    const entries = new Map([...(previous.currencies ?? []), ...(next.currencies ?? [])].map((currency) => [currency.code, currency]))
    for (const code of next.removedCurrencyCodes ?? []) entries.delete(code)
    result.currencies = [...entries.values()]
  }
  if (previous.removedCurrencyCodes || next.removedCurrencyCodes) {
    const removed = new Set([...(previous.removedCurrencyCodes ?? []), ...(next.removedCurrencyCodes ?? [])])
    for (const currency of next.currencies ?? []) removed.delete(currency.code)
    result.removedCurrencyCodes = [...removed]
  }
  if (previous.accountSavingsFormulas || next.accountSavingsFormulas) {
    result.accountSavingsFormulas = { ...(next.resetAccountFormulas ? {} : previous.accountSavingsFormulas), ...next.accountSavingsFormulas }
  }
  return result
}

function applyRemotePreferences(userId: string, remote: CurrencyPreferencesResponse) {
  if (getAuthenticatedUserId() !== userId) return
  const pending = readPendingPatch(userId)
  const currenciesByCode = new Map(remote.currencies.map((currency) => [currency.code, currency]))
  for (const currency of pending.discoveredCurrencies ?? []) {
    if (!currenciesByCode.has(currency.code)) currenciesByCode.set(currency.code, currency)
  }
  for (const currency of pending.currencies ?? []) currenciesByCode.set(currency.code, currency)
  for (const code of pending.removedCurrencyCodes ?? []) currenciesByCode.delete(code)
  const currencies = normalizeCurrencies([...currenciesByCode.values()])
  const requestedActiveCode = pending.activeCurrencyCode ?? remote.activeCurrencyCode
  const values = {
    currencies,
    activeCurrencyCode: currencies.some((currency) => currency.code === requestedActiveCode) ? requestedActiveCode : 'USD',
    activeIncomeSourceId: pending.activeIncomeSourceId ?? remote.activeIncomeSourceId ?? '',
    accountSavingsFormulas: { ...(pending.resetAccountFormulas ? {} : remote.accountSavingsFormulas), ...pending.accountSavingsFormulas },
    formula: normalizeFormula(pending.formula ?? remote.formula ?? usePreferencesStore.getState().formula),
    financialPreferencesUserId: userId,
  }
  usePreferencesStore.setState(values)
  window.localStorage.setItem(`plata-financial-preferences:${userId}`, JSON.stringify(values))
}

async function loadFinancialPreferences(userId: string, refresh = false): Promise<void> {
  if (preferencesLoadInFlight?.userId === userId) return preferencesLoadInFlight.promise
  if (!refresh && loadedPreferencesUserId === userId) return
  if (preferencesLoadInFlight) await preferencesLoadInFlight.promise.catch(() => {})
  if (getAuthenticatedUserId() !== userId) return
  const state = usePreferencesStore.getState()
  if (state.financialPreferencesUserId && state.financialPreferencesUserId !== userId) {
    let cached: Partial<PreferencesStore> = {}
    try { cached = JSON.parse(window.localStorage.getItem(`plata-financial-preferences:${userId}`) ?? '{}') } catch { /* use defaults */ }
    usePreferencesStore.setState({ currencies: [USD_CURRENCY], activeCurrencyCode: 'USD', accountSavingsFormulas: {}, formula: defaultFormula, activeIncomeSourceId: '', ...cached, financialPreferencesUserId: userId })
  }
  const promise = (async () => {
    const remote = await requestJson<CurrencyPreferencesResponse>('/preferences/currencies')
    if (getAuthenticatedUserId() !== userId) return
    // An explicit null means this upgraded profile has no global formula yet.
    // Preserve this device's legacy formula once, then share it through the DB.
    if (remote.formula === null && !readPendingPatch(userId).formula) {
      writePendingPatch(userId, mergePendingPatch(readPendingPatch(userId), { formula: usePreferencesStore.getState().formula }))
    }
    applyRemotePreferences(userId, remote)
    loadedPreferencesUserId = userId
  })().finally(() => { if (preferencesLoadInFlight?.promise === promise) preferencesLoadInFlight = null })
  preferencesLoadInFlight = { userId, promise }
  return promise
}

function getAuthenticatedUserId() {
  const { authMode, user } = useAuthStore.getState()
  return authMode === 'authenticated' ? user?.id ?? null : null
}

function syncCurrencyPreferencesToServer() {
  if (currencySyncInFlight) return currencySyncInFlight
  const userId = getAuthenticatedUserId()
  if (!userId) return Promise.resolve()
  currencySyncInFlight = (async () => {
    await loadFinancialPreferences(userId)
    while (getAuthenticatedUserId() === userId) {
      const patch = readPendingPatch(userId)
      if (!Object.keys(patch).length) break
      const sent = JSON.stringify(patch)
      const remote = await requestJson<CurrencyPreferencesResponse>('/preferences/currencies', {
        method: 'PUT',
        body: sent,
      })
      if (getAuthenticatedUserId() !== userId) return
      if (JSON.stringify(readPendingPatch(userId)) === sent) writePendingPatch(userId, {})
      applyRemotePreferences(userId, remote)
    }
  })().finally(() => {
    currencySyncInFlight = null
    const nextUserId = getAuthenticatedUserId()
    if (nextUserId && nextUserId !== userId && Object.keys(readPendingPatch(nextUserId)).length) {
      void syncCurrencyPreferencesToServer().catch(() => {})
    }
  })

  return currencySyncInFlight
}

function scheduleCurrencySync(patch: FinancialPreferencesPatch) {
  const userId = getAuthenticatedUserId()
  if (!userId) return
  writePendingPatch(userId, mergePendingPatch(readPendingPatch(userId), patch))
  queueMicrotask(() => {
    void syncCurrencyPreferencesToServer().catch(() => {})
  })
}

const defaultState = {
  appearance: 'dark' as AppAppearance,
  theme: 'obsidian' as AppTheme,
  background: 'grid' as AppBackground,
  typography: 'inter' as AppTypographyPreset,
  iconPack: 'lucide' as AppIconPack,
  customFonts: [] as CustomTypographyOption[],
  formula: defaultFormula,
  financialPreferencesUserId: null,
  accountSavingsFormulas: {} as AccountSavingsFormulas,
  currencies: [USD_CURRENCY],
  activeCurrencyCode: 'USD',
  activeIncomeSourceId: '',
  dashboardWidgetsByProfile: {},
  categoryRulesByProfile: {},
  systemNotificationsEnabled: false,
  connectionNotificationsEnabled: true,
  syncNotificationsEnabled: true,
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
      setFormula: (formula) => {
        const normalized = normalizeFormula(formula)
        set({ formula: normalized })
        scheduleCurrencySync({ formula: normalized })
      },
      setAccountFormula: (sourceId, formula) => {
        set((state) => ({
          accountSavingsFormulas: {
            ...state.accountSavingsFormulas,
            [sourceId]: normalizeFormula(formula),
          },
        }))
        scheduleCurrencySync({ accountSavingsFormulas: { [sourceId]: normalizeFormula(formula) } })
      },
      setActiveCurrency: (code) => {
        set((state) => {
          const normalizedCode = code.trim().toUpperCase()
          return {
            activeCurrencyCode: state.currencies.some((currency) => currency.code === normalizedCode) ? normalizedCode : 'USD',
          }
        })
        scheduleCurrencySync({ activeCurrencyCode: code.trim().toUpperCase() })
      },
      setActiveIncomeSource: (activeIncomeSourceId) => {
        set({ activeIncomeSourceId })
        scheduleCurrencySync({ activeIncomeSourceId })
      },
      saveCurrency: (currency) => {
        set((state) => {
          const normalized = normalizeCurrencyPreference(currency)
          const exists = state.currencies.some((entry) => entry.code === normalized.code)
          return {
            currencies: exists
              ? state.currencies.map((entry) => entry.code === normalized.code ? normalized : entry)
              : [...state.currencies, normalized],
          }
        })
        scheduleCurrencySync({ currencies: [normalizeCurrencyPreference(currency)] })
      },
      registerCurrency: (currency) => {
        const normalized = normalizeCurrencyPreference(currency)
        set((state) => ({ currencies: state.currencies.some((entry) => entry.code === normalized.code) ? state.currencies : [...state.currencies, normalized] }))
        scheduleCurrencySync({ discoveredCurrencies: [normalized] })
      },
      removeCurrency: (code) => {
        const normalizedCode = code.trim().toUpperCase()
        if (normalizedCode === 'USD') return
        set((state) => ({
          currencies: state.currencies.filter((currency) => currency.code !== normalizedCode),
          activeCurrencyCode: state.activeCurrencyCode === normalizedCode ? 'USD' : state.activeCurrencyCode,
        }))
        scheduleCurrencySync({ removedCurrencyCodes: [normalizedCode] })
      },
      hydrateCurrencyPreferences: async (userId) => {
        await loadFinancialPreferences(userId, true)
        await syncCurrencyPreferencesToServer()
      },
      syncCurrencyPreferences: async () => {
        await syncCurrencyPreferencesToServer()
      },
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
      setSystemNotificationsEnabled: (enabled) => set({ systemNotificationsEnabled: enabled }),
      setConnectionNotificationsEnabled: (enabled) => set({ connectionNotificationsEnabled: enabled }),
      setSyncNotificationsEnabled: (enabled) => set({ syncNotificationsEnabled: enabled }),
      resetPreferences: () => {
        set(defaultState)
        scheduleCurrencySync({ formula: defaultFormula, resetAccountFormulas: true })
      },
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
          accountSavingsFormulas: saved.accountSavingsFormulas ?? current.accountSavingsFormulas,
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
