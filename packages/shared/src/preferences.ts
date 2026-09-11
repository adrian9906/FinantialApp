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
  expenses: 50,
  wants: 25,
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
      label: '25% ahorro · 50% gastos · 25% gustos',
      description: 'Una distribución equilibrada de toda la cuenta.',
      formula: { expenses: 50, wants: 25, savings: 25, rolloverSavings: true },
    },
    {
      id: 'focused-growth',
      label: '25% ahorro · 60% gastos · 15% gustos',
      description: 'Da más espacio a gastos fijos y mantiene ahorro estable.',
      formula: { expenses: 60, wants: 15, savings: 25, rolloverSavings: true },
    },
    {
      id: 'save-first',
      label: '50% ahorro · 50% gastos · 0% gustos',
      description: 'Aparta la mitad de la cuenta y destina el resto a gastos.',
      formula: { expenses: 50, wants: 0, savings: 50, rolloverSavings: false },
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
 * The three envelopes divide the complete balance of one income account.
 */
export function getFormulaTotal(formula: Pick<AllocationFormula, 'expenses' | 'wants' | 'savings'>) {
  return formula.expenses + formula.wants + formula.savings
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
  const expenses = base * (clampPercentage(formula.expenses) / 100)
  const wants = base * (clampPercentage(formula.wants) / 100)

  return {
    savings,
    spendable: expenses + wants,
    expenses,
    wants,
  }
}

export function formatFormulaLabel(formula: Pick<AllocationFormula, 'expenses' | 'wants' | 'savings'>) {
  return `${formula.savings}% ahorro · ${formula.expenses}% gastos · ${formula.wants}% gustos`
}
