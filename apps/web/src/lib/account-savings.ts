import type { IncomeSource, Salary } from '@plata/shared'

import type { IncomeAccountView } from '@/lib/income-account-view'

/** Percentage of an account's income that is moved to savings, keyed by source id. */
export type AccountSavingsFormulas = Record<string, number>

export const SAVINGS_ACCOUNT_MARKER = 'savings'

export function getAccountSavingsRate(formulas: AccountSavingsFormulas, sourceId: string) {
  const rate = Number(formulas[sourceId])
  if (!Number.isFinite(rate)) return 0
  return Math.min(100, Math.max(0, Math.round(rate)))
}

/**
 * The amount a single application moves, based on the account's planning base.
 * Capped by the live balance so a partly spent account never goes negative.
 */
export function getAccountSavingsAmount(account: IncomeAccountView, rate: number) {
  const normalizedRate = Math.min(100, Math.max(0, rate))
  if (normalizedRate <= 0) return 0

  const base = Number(account.salary.amount)
  const balance = Number(account.salary.balance ?? account.salary.amount)
  if (!Number.isFinite(base) || !Number.isFinite(balance)) return 0

  return Math.max(0, Math.min(balance, base * (normalizedRate / 100)))
}

export function getSavingsAccountName(currencyCode: string, isCash: boolean) {
  return `Ahorro ${currencyCode.trim().toUpperCase()} ${isCash ? 'Efectivo' : 'Transferencia'}`
}

/**
 * Savings keep the denomination and payment rail of the account they came from,
 * so each combination owns its own savings account instead of pooling into one.
 */
export function findSavingsAccount(
  sources: IncomeSource[],
  currencyCode: string,
  isCash: boolean,
): IncomeSource | undefined {
  const normalizedCode = currencyCode.trim().toUpperCase()
  const name = getSavingsAccountName(normalizedCode, isCash).toLowerCase()

  return sources.find((source) => !source.archived
    && source.name.trim().toLowerCase() === name
    && (source.currencyCode ?? 'USD').trim().toUpperCase() === normalizedCode
    && (source.isCash !== false) === isCash)
}

export interface AccountSavingsPlan {
  sourceId: string
  sourceName: string
  currencyCode: string
  isCash: boolean
  rate: number
  amountUsd: number
  salaryId: string
  savingsAccountName: string
  existingSavingsSourceId?: string
}

/** Null when the account has no rate set or nothing left to move. */
export function getAccountSavingsPlan(
  account: IncomeAccountView,
  formulas: AccountSavingsFormulas,
  sources: IncomeSource[],
): AccountSavingsPlan | null {
  const rate = getAccountSavingsRate(formulas, account.source.id)
  const amountUsd = getAccountSavingsAmount(account, rate)
  if (rate <= 0 || amountUsd <= 0) return null

  const currencyCode = (account.salary.currencyCode ?? account.source.currencyCode ?? 'USD').trim().toUpperCase()
  const isCash = account.source.isCash !== false
  const existing = findSavingsAccount(sources, currencyCode, isCash)

  // Applying a savings rate to a savings account itself would loop the money.
  if (existing?.id === account.source.id) return null

  return {
    sourceId: account.source.id,
    sourceName: account.source.name,
    currencyCode,
    isCash,
    rate,
    amountUsd,
    salaryId: account.salary.id,
    savingsAccountName: getSavingsAccountName(currencyCode, isCash),
    existingSavingsSourceId: existing?.id,
  }
}

export function getAccountSavingsPlans(
  accounts: IncomeAccountView[],
  formulas: AccountSavingsFormulas,
  sources: IncomeSource[],
): AccountSavingsPlan[] {
  return accounts
    .map((account) => getAccountSavingsPlan(account, formulas, sources))
    .filter((plan): plan is AccountSavingsPlan => plan !== null)
}

/** How much of an account's savings rate is already sitting in its savings account. */
export function getSavingsAccountBalance(salaries: Salary[], savingsSourceId: string, month: string) {
  const entry = salaries.find((salary) => salary.sourceId === savingsSourceId && salary.month === month)
  if (!entry) return 0
  return Number(entry.balance ?? entry.amount) || 0
}

export interface AccountSavingsGoal {
  sourceId: string
  sourceName: string
  currencyCode: string
  isCash: boolean
  rate: number
  /** Goal for this account this cycle, in USD. */
  goalUsd: number
  /** Already sitting in this account's savings account, in USD. */
  savedUsd: number
  remainingUsd: number
  progress: number
  isComplete: boolean
  savingsAccountName: string
}

/**
 * Savings goals are per account: an account with 0% has no goal and must not
 * appear, and each account's progress is measured against its own savings
 * account so two currencies are never added together.
 */
export function getAccountSavingsGoals(
  accounts: IncomeAccountView[],
  formulas: AccountSavingsFormulas,
  sources: IncomeSource[],
  salaries: Salary[],
  month: string,
): AccountSavingsGoal[] {
  return accounts.flatMap((account) => {
    const rate = getAccountSavingsRate(formulas, account.source.id)
    if (rate <= 0) return []

    const currencyCode = (account.salary.currencyCode ?? account.source.currencyCode ?? 'USD').trim().toUpperCase()
    const isCash = account.source.isCash !== false
    const savingsAccount = findSavingsAccount(sources, currencyCode, isCash)

    // The account's own savings account is not a source of new savings.
    if (savingsAccount?.id === account.source.id) return []

    const goalUsd = Math.max(0, Number(account.salary.amount) * (rate / 100))
    const savedUsd = savingsAccount
      ? getSavingsAccountBalance(salaries, savingsAccount.id, month)
      : 0
    const progress = goalUsd > 0 ? Math.min(100, Math.round((savedUsd / goalUsd) * 100)) : 0

    return [{
      sourceId: account.source.id,
      sourceName: account.source.name,
      currencyCode,
      isCash,
      rate,
      goalUsd,
      savedUsd,
      remainingUsd: Math.max(0, goalUsd - savedUsd),
      progress,
      isComplete: savedUsd + 1e-9 >= goalUsd,
      savingsAccountName: getSavingsAccountName(currencyCode, isCash),
    }]
  })
}
