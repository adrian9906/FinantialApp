import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  type AllocationFormula,
  type AppAppearance,
  type AppBackground,
  type AppTheme,
  type CategorizationRule,
  type DashboardWidgetId,
  defaultDashboardWidgets,
  defaultFormula,
  formulaPresets,
  formatFormulaLabel,
  getFormulaTotal,
  normalizeFormula,
} from '@plata/shared'

import { kvStateStorage } from '../lib/storage'

interface PreferencesStore {
  appearance: AppAppearance
  theme: AppTheme
  background: AppBackground
  formula: AllocationFormula
  dashboardWidgetsByProfile: Record<string, DashboardWidgetId[]>
  categoryRulesByProfile: Record<string, CategorizationRule[]>
  setAppearance: (appearance: AppAppearance) => void
  setTheme: (theme: AppTheme) => void
  setBackground: (background: AppBackground) => void
  setFormula: (formula: AllocationFormula) => void
  toggleDashboardWidget: (profileId: string, widgetId: DashboardWidgetId) => void
  moveDashboardWidget: (profileId: string, widgetId: DashboardWidgetId, direction: -1 | 1) => void
  saveCategoryRule: (profileId: string, rule: CategorizationRule) => void
  removeCategoryRule: (profileId: string, ruleId: string) => void
  resetAutomationPreferences: (profileId: string) => void
  resetPreferences: () => void
}

const defaultState = {
  appearance: 'dark' as AppAppearance,
  theme: 'obsidian' as AppTheme,
  background: 'grid' as AppBackground,
  formula: defaultFormula,
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
      setFormula: (formula) => set({ formula: normalizeFormula(formula) }),
      toggleDashboardWidget: (profileId, widgetId) => set((state) => {
        const current = state.dashboardWidgetsByProfile[profileId] ?? defaultDashboardWidgets
        return {
          dashboardWidgetsByProfile: {
            ...state.dashboardWidgetsByProfile,
            [profileId]: current.includes(widgetId) ? current.filter((id) => id !== widgetId) : [...current, widgetId],
          },
        }
      }),
      moveDashboardWidget: (profileId, widgetId, direction) => set((state) => {
        const current = [...(state.dashboardWidgetsByProfile[profileId] ?? defaultDashboardWidgets)]
        const index = current.indexOf(widgetId)
        const nextIndex = index + direction
        if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return state
        ;[current[index], current[nextIndex]] = [current[nextIndex], current[index]]
        return { dashboardWidgetsByProfile: { ...state.dashboardWidgetsByProfile, [profileId]: current } }
      }),
      saveCategoryRule: (profileId, rule) => set((state) => ({
        categoryRulesByProfile: {
          ...state.categoryRulesByProfile,
          [profileId]: [rule, ...(state.categoryRulesByProfile[profileId] ?? []).filter((entry) => entry.id !== rule.id && entry.pattern.toLocaleLowerCase('es') !== rule.pattern.toLocaleLowerCase('es'))],
        },
      })),
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
      name: 'plata-mobile-preferences',
      storage: createJSONStorage(() => kvStateStorage),
    },
  ),
)

export type { AllocationFormula, AppAppearance, AppBackground, AppTheme }
export { defaultFormula, formulaPresets, formatFormulaLabel, getFormulaTotal }
