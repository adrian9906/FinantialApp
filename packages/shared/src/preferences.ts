export type AppTheme = 'obsidian' | 'midnight' | 'ember'
export type AppBackground = 'grid' | 'nebula' | 'carbon' | 'aurora'
export type AppAppearance = 'dark' | 'light'

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
    label: '50 / 25 / 25',
    description: 'Balance clasico para necesidades, gustos y ahorro.',
    formula: { expenses: 50, wants: 25, savings: 25, rolloverSavings: true },
  },
  {
    id: 'focused-growth',
    label: '60 / 15 / 25',
    description: 'Da mas espacio a gastos fijos y mantiene ahorro estable.',
    formula: { expenses: 60, wants: 15, savings: 25, rolloverSavings: true },
  },
  {
    id: 'save-first',
    label: '45 / 20 / 35',
    description: 'Prioriza ahorro agresivo sin dejar fuera el disfrute.',
    formula: { expenses: 45, wants: 20, savings: 35, rolloverSavings: false },
  },
]

export function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function normalizeFormula(formula: AllocationFormula): AllocationFormula {
  return {
    expenses: clampPercentage(formula.expenses),
    wants: clampPercentage(formula.wants),
    savings: clampPercentage(formula.savings),
    rolloverSavings: Boolean(formula.rolloverSavings),
  }
}

export function getFormulaTotal(formula: Pick<AllocationFormula, 'expenses' | 'wants' | 'savings'>) {
  return formula.expenses + formula.wants + formula.savings
}

export function formatFormulaLabel(formula: Pick<AllocationFormula, 'expenses' | 'wants' | 'savings'>) {
  return `${formula.expenses}/${formula.wants}/${formula.savings}`
}
