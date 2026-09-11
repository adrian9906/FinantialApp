export type AppTheme = 'obsidian' | 'midnight' | 'ember'
export type AppBackground = 'grid' | 'nebula' | 'carbon' | 'aurora'
export type AppAppearance = 'dark' | 'light'
export type AppIconPack = 'lucide' | 'tabler' | 'material-symbols'
export type AppTypographyPreset = 'inter' | 'space-grotesk' | 'manrope' | 'ibm-plex-sans' | 'playfair-display'

export interface AllocationFormula {
  expenses: number
  wants: number
  savings: number
  rolloverSavings: boolean
}

export const defaultFormula: AllocationFormula = {
  expenses: 65,
  wants: 35,
  savings: 25,
  rolloverSavings: true,
}

export const formulaPresets: Array<{
  id: string
  label: string
  description: string
  formula: AllocationFormula
}> = [
    {
      id: 'balanced',
      label: 'Ahorro 25% · 65/35',
      description: 'Aparta un cuarto y reparte el resto entre gastos y gustos.',
      formula: { expenses: 65, wants: 35, savings: 25, rolloverSavings: true },
    },
    {
      id: 'focused-growth',
      label: 'Ahorro 25% · 80/20',
      description: 'Da más espacio a gastos fijos y mantiene ahorro estable.',
      formula: { expenses: 80, wants: 20, savings: 25, rolloverSavings: true },
    },
    {
      id: 'save-first',
      label: 'Ahorro 50% · 100/0',
      description: 'Aparta la mitad y destina todo lo demás a gastos.',
      formula: { expenses: 100, wants: 0, savings: 50, rolloverSavings: false },
    },
  ]

/**
 * One decimal is allowed because whole percentages cannot express every split:
 * 62.5% of 400 is exactly 250, while 62% and 63% both miss it.
 */
export function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10))
}

export function normalizeFormula(formula: AllocationFormula): AllocationFormula {
  return {
    expenses: clampPercentage(formula.expenses),
    wants: clampPercentage(formula.wants),
    savings: clampPercentage(formula.savings),
    rolloverSavings: Boolean(formula.rolloverSavings),
  }
}

/**
 * Savings is taken off the income first; expenses and wants then split whatever
 * is left. So only those two have to add up to 100%, and either may be 0% to
 * hand the whole remainder to the other.
 */
export function getFormulaTotal(formula: Pick<AllocationFormula, 'expenses' | 'wants'>) {
  return formula.expenses + formula.wants
}

export interface FormulaBudgets {
  savings: number
  spendable: number
  expenses: number
  wants: number
}

export function getFormulaBudgets(
  income: number,
  formula: Pick<AllocationFormula, 'expenses' | 'wants' | 'savings'>,
): FormulaBudgets {
  const base = Number.isFinite(income) && income > 0 ? income : 0
  const savings = base * (clampPercentage(formula.savings) / 100)
  const spendable = Math.max(0, base - savings)

  return {
    savings,
    spendable,
    expenses: spendable * (clampPercentage(formula.expenses) / 100),
    wants: spendable * (clampPercentage(formula.wants) / 100),
  }
}

export function formatFormulaLabel(formula: Pick<AllocationFormula, 'expenses' | 'wants' | 'savings'>) {
  return `${formula.savings}% · ${formula.expenses}/${formula.wants}`
}
