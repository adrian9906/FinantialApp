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

import { kvStateStorage } from '../lib/storage'

interface PreferencesStore {
  appearance: AppAppearance
  theme: AppTheme
  background: AppBackground
  formula: AllocationFormula
  setAppearance: (appearance: AppAppearance) => void
  setTheme: (theme: AppTheme) => void
  setBackground: (background: AppBackground) => void
  setFormula: (formula: AllocationFormula) => void
  resetPreferences: () => void
}

const defaultState = {
  appearance: 'dark' as AppAppearance,
  theme: 'obsidian' as AppTheme,
  background: 'grid' as AppBackground,
  formula: defaultFormula,
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      ...defaultState,
      setAppearance: (appearance) => set({ appearance }),
      setTheme: (theme) => set({ theme }),
      setBackground: (background) => set({ background }),
      setFormula: (formula) => set({ formula: normalizeFormula(formula) }),
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
