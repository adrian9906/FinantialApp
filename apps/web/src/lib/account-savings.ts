import { getWishlistReservedAmount, isWishlistPurchased, normalizeFormula, type AllocationFormula, type BootstrapPayload, type IncomeSource, type Salary, type WishlistItem } from '@plata/shared'

import type { IncomeAccountView } from '@/lib/income-account-view'

/** Complete distribution for each income account. Numeric entries are legacy savings-only values. */
export type AccountSavingsFormulas = Record<string, AllocationFormula | number>

export const SAVINGS_ACCOUNT_MARKER = 'savings'

export function getAccountSavingsRate(formulas: AccountSavingsFormulas, sourceId: string) {
  const entry = formulas[sourceId]
  const rate = Number(typeof entry === 'object' && entry ? entry.savings : entry)
  if (!Number.isFinite(rate)) return 0
  return Math.min(100, Math.max(0, Math.round(rate)))
}

export function getAccountAllocationFormula(
  formulas: AccountSavingsFormulas,
  sourceId: string | undefined,
  fallback: AllocationFormula,
) {
  const normalizedFallback = normalizeFormula(fallback)
  const fallbackTotal = normalizedFallback.savings + normalizedFallback.expenses + normalizedFallback.wants
  const legacySpendingTotal = normalizedFallback.expenses + normalizedFallback.wants
  let accountFallback = normalizedFallback
  if (fallbackTotal > 100 && Math.abs(legacySpendingTotal - 100) < 0.01) {
    const expenses = Math.round(
      normalizedFallback.expenses * ((100 - normalizedFallback.savings) / 100) * 10,
    ) / 10
    accountFallback = normalizeFormula({
      savings: normalizedFallback.savings,
      expenses,
      wants: 100 - normalizedFallback.savings - expenses,
      rolloverSavings: normalizedFallback.rolloverSavings,
    })
  }

  if (!sourceId) return accountFallback
  const entry = formulas[sourceId]
  if (typeof entry === 'object' && entry) return normalizeFormula(entry)
  if (typeof entry !== 'number') return accountFallback

  // Migrate the former savings-only setting without losing the user's choice:
  // the remainder keeps the same expenses/wants proportion as the old formula.
  const savings = Math.min(100, Math.max(0, entry))
  const remainder = 100 - savings
  const spendingTotal = Math.max(0, accountFallback.expenses + accountFallback.wants)
  const expenses = spendingTotal > 0 ? remainder * (accountFallback.expenses / spendingTotal) : remainder

  return normalizeFormula({
    savings,
    expenses,
    wants: remainder - expenses,
    rolloverSavings: accountFallback.rolloverSavings,
  })
}

export function isSavingsIncomeSource(source: IncomeSource) {
  return source.name.trim().toLocaleLowerCase('es').startsWith('ahorro ')
}

/**
 * Repairs the representation used by older builds, which counted an internal
 * savings balance as income and reduced the original account's monthly income.
 */
export function normalizeLegacySavingsAccounts(snapshot: BootstrapPayload): BootstrapPayload {
  const sourceById = new Map(snapshot.incomeSources.map((source) => [source.id, source]))
  const salaries = snapshot.salaries.map((salary) => ({ ...salary }))
  let changed = false

  for (const savingsSalary of salaries) {
    if (savingsSalary.amount <= 0 || !savingsSalary.sourceId) continue
    const savingsSource = sourceById.get(savingsSalary.sourceId)
    if (!savingsSource || !isSavingsIncomeSource(savingsSource)) continue

    const currencyCode = (savingsSalary.currencyCode ?? savingsSource.currencyCode ?? 'USD').trim().toUpperCase()
    const isCash = savingsSource.isCash !== false
    const candidates = salaries.filter((candidate) => {
      if (candidate.id === savingsSalary.id || candidate.month !== savingsSalary.month || !candidate.sourceId) return false
      const source = sourceById.get(candidate.sourceId)
      if (!source || isSavingsIncomeSource(source)) return false
      return (candidate.currencyCode ?? source.currencyCode ?? 'USD').trim().toUpperCase() === currencyCode
        && (source.isCash !== false) === isCash
    })

    // Without a single origin account, redistributing historical money would
    // be guesswork. New transfers always keep enough information correctly.
    if (candidates.length !== 1) continue

    const sourceSalary = candidates[0]
    const minimumOriginalAmount = Number(sourceSalary.balance ?? sourceSalary.amount) + savingsSalary.amount
    if (sourceSalary.amount < minimumOriginalAmount) {
      sourceSalary.amount += savingsSalary.amount
    }
    sourceSalary.balance = Math.max(Number(sourceSalary.balance ?? 0), sourceSalary.amount)
    savingsSalary.amount = 0
    changed = true
  }

  return changed ? { ...snapshot, salaries } : snapshot
}

/**
 * The amount a single application moves, based on the account's planning base.
 * Capped by the live balance so a partly spent account never goes negative.
 */
export function getAccountSavingsAmount(account: IncomeAccountView, rate: number) {
  const normalizedRate = Math.min(100, Math.max(0, rate))
  if (normalizedRate <= 0) return 0

  const base = account.salary.amount
  const balance = Number(account.salary.balance ?? account.salary.amount)
  if (!Number.isFinite(base) || !Number.isFinite(balance)) return 0

  return Math.max(0, Math.min(balance, base * (normalizedRate / 100)))
}

export function getSavingsAccountName(currencyCode: string, isCash: boolean) {
  void isCash
  return `Ahorro ${currencyCode.trim().toUpperCase()}`
}

/**
 * Savings are pooled by denomination into exactly one internal account. Cash
 * and transfer income in USD both fund Ahorro USD; CUP funds Ahorro CUP.
 */
export function findSavingsAccount(
  sources: IncomeSource[],
  currencyCode: string,
  isCash: boolean,
): IncomeSource | undefined {
  void isCash
  const normalizedCode = currencyCode.trim().toUpperCase()

  return sources.find((source) => !source.archived
    && isSavingsIncomeSource(source)
    && (source.currencyCode ?? 'USD').trim().toUpperCase() === normalizedCode
  )
}

export function findSavingsAccounts(sources: IncomeSource[], currencyCode: string): IncomeSource[] {
  const normalizedCode = currencyCode.trim().toUpperCase()
  return sources.filter((source) => !source.archived
    && isSavingsIncomeSource(source)
    && (source.currencyCode ?? 'USD').trim().toUpperCase() === normalizedCode)
}

/** Creates the two internal savings ledgers requested by the product model. */
export function ensureSavingsCurrencyAccounts(
  snapshot: BootstrapPayload,
  ownerKey: string,
  month: string,
): BootstrapPayload {
  const incomeSources = snapshot.incomeSources.map((source) => ({ ...source }))
  const salaries = snapshot.salaries.map((salary) => ({ ...salary }))
  let changed = false

  for (const currencyCode of ['USD', 'CUP']) {
    let source = findSavingsAccount(incomeSources, currencyCode, true)
    const canonicalName = getSavingsAccountName(currencyCode, true)

    if (!source) {
      source = {
        id: `savings-${ownerKey}-${currencyCode.toLowerCase()}`,
        name: canonicalName,
        currencyCode,
        recurring: true,
        balanceMode: 'fixed',
        isCash: true,
      }
      incomeSources.push(source)
      changed = true
    } else if (source.name !== canonicalName || source.isCash !== true) {
      Object.assign(source, { name: canonicalName, isCash: true, recurring: true, balanceMode: 'fixed' })
      changed = true
    }

    const entries = salaries.filter((salary) => salary.sourceId === source!.id)
    let current = entries.find((salary) => salary.month === month)
    if (!current) {
      const latest = [...entries].sort((left, right) => right.month.localeCompare(left.month))[0]
      current = {
        id: `${source.id}-${month}`,
        amount: 0,
        balance: Number(latest?.balance ?? 0),
        savingsLedgerMigrated: latest?.savingsLedgerMigrated,
        month,
        currencyCode,
        sourceId: source.id,
        sourceName: canonicalName,
        kind: 'recurring',
        balanceMode: 'fixed',
      }
      salaries.unshift(current)
      changed = true
    } else if (current.amount !== 0 || current.sourceName !== canonicalName) {
      current.amount = 0
      current.sourceName = canonicalName
      changed = true
    }
  }

  return changed ? { ...snapshot, incomeSources, salaries } : snapshot
}

/** Recover pre-ledger savings once, without counting recorded balances twice. */
export function migrateLegacySavingsLedger(snapshot: BootstrapPayload, month: string): BootstrapPayload {
  const sourceById = new Map(snapshot.incomeSources.map((source) => [source.id, source]))
  let salaries = snapshot.salaries

  for (const currencyCode of ['USD', 'CUP']) {
    const sources = findSavingsAccounts(snapshot.incomeSources, currencyCode)
    const currentEntries = sources.flatMap((source) => {
      const entry = salaries.filter((salary) => salary.sourceId === source.id && salary.month <= month)
        .sort((left, right) => right.month.localeCompare(left.month))[0]
      return entry ? [entry] : []
    })
    if (!currentEntries.length || currentEntries.some((entry) => entry.savingsLedgerMigrated)) continue

    const ledgerStart = getSavingsLedgerStart(snapshot.salaries, sources)

    const recordedSavings = snapshot.transactions.reduce((total, transaction) => {
      if (transaction.type !== 'saving' || transaction.date < ledgerStart) return total
      const source = sourceById.get(transaction.incomeSourceId ?? '')
      const code = (source?.currencyCode ?? 'USD').trim().toUpperCase()
      return code === currencyCode ? total + transaction.amount : total
    }, 0)
    const existingBalance = currentEntries.reduce((total, entry) => total + Number(entry.balance ?? entry.amount), 0)
    // An empty device cache can load before the remote transactions arrive.
    // Do not declare that empty placeholder migrated and skip recovery later.
    if (existingBalance === 0 && !snapshot.transactions.some((transaction) => transaction.type === 'saving' && transaction.date >= ledgerStart
      && (sourceById.get(transaction.incomeSourceId ?? '')?.currencyCode ?? 'USD').trim().toUpperCase() === currencyCode)) continue
    const missingBalance = Math.max(0, recordedSavings - existingBalance)
    const entryIds = new Set(currentEntries.map((entry) => entry.id))
    salaries = salaries.map((salary) => entryIds.has(salary.id)
      ? {
          ...salary,
          savingsLedgerMigrated: true,
          balance: Number(salary.balance ?? salary.amount) + (salary.id === currentEntries[0].id ? missingBalance : 0),
        }
      : salary)
  }

  return salaries === snapshot.salaries ? snapshot : { ...snapshot, salaries }
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
  salaries?: Salary[],
  month?: string,
): AccountSavingsPlan | null {
  const rate = getAccountSavingsRate(formulas, account.source.id)
  const goalUsd = getAccountSavingsAmount(account, rate)
  if (rate <= 0 || goalUsd <= 0) return null

  const currencyCode = (account.salary.currencyCode ?? account.source.currencyCode ?? 'USD').trim().toUpperCase()
  const isCash = account.source.isCash !== false
  const existing = findSavingsAccount(sources, currencyCode, isCash)

  // Applying a savings rate to a savings account itself would loop the money.
  if (existing?.id === account.source.id) return null
  const savedUsd = existing && salaries && month
    ? getSavingsAccountBalances(salaries, sources, currencyCode, month)
    : 0
  const amountUsd = Math.max(0, goalUsd - savedUsd)
  if (amountUsd <= 0) return null

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
  salaries?: Salary[],
  month?: string,
): AccountSavingsPlan[] {
  return accounts
    .map((account) => getAccountSavingsPlan(account, formulas, sources, salaries, month))
    .filter((plan): plan is AccountSavingsPlan => plan !== null)
}

/** How much of an account's savings rate is already sitting in its savings account. */
export function getSavingsAccountBalance(salaries: Salary[], savingsSourceId: string, month: string) {
  const entry = salaries
    .filter((salary) => salary.sourceId === savingsSourceId && salary.month <= month)
    .sort((left, right) => right.month.localeCompare(left.month))[0]
  if (!entry) return 0
  return Number(entry.balance ?? entry.amount) || 0
}

export function getSavingsAccountBalances(
  salaries: Salary[],
  sources: IncomeSource[],
  currencyCode: string,
  month: string,
) {
  return findSavingsAccounts(sources, currencyCode).reduce(
    (total, source) => total + getSavingsAccountBalance(salaries, source.id, month),
    0,
  )
}

/** Undo the former migration's identifiable CUP credit from pre-account USD history. */
export function repairMisassignedLegacyCupSavings(snapshot: BootstrapPayload): BootstrapPayload {
  const sources = findSavingsAccounts(snapshot.incomeSources, 'CUP')
    .filter((source) => source.id.startsWith('savings-'))
  const firstIncome = snapshot.incomeSources.find((source) => !source.archived && !isSavingsIncomeSource(source))
  if (!sources.length || firstIncome?.currencyCode !== 'CUP') return snapshot
  const ledgerStart = getSavingsLedgerStart(snapshot.salaries, sources)
  if (!ledgerStart) return snapshot
  const sourceById = new Map(snapshot.incomeSources.map((source) => [source.id, source]))
  const hasRealCupSaving = snapshot.transactions.some((entry) => entry.type === 'saving'
    && entry.date >= ledgerStart && sourceById.get(entry.incomeSourceId ?? '')?.currencyCode === 'CUP')
  if (hasRealCupSaving) return snapshot
  const legacyCredit = snapshot.transactions.reduce((sum, entry) => entry.type === 'saving'
    && entry.date < ledgerStart && (!entry.incomeSourceId || entry.incomeSourceId === firstIncome.id)
    ? sum + entry.amount : sum, 0)
  if (legacyCredit <= 0) return snapshot
  const ids = new Set<string>()
  for (const source of sources) {
    const entries = snapshot.salaries.filter((entry) => entry.sourceId === source.id)
      .sort((left, right) => left.month.localeCompare(right.month))
    const latest = entries.at(-1)
    if (entries[0]?.balance === 0 && latest?.savingsLedgerMigrated
      && Number(latest.transferAdjustment ?? 0) === 0 && Math.abs(Number(latest.balance) - legacyCredit) < 0.01) {
      ids.add(latest.id)
    }
  }
  return ids.size ? { ...snapshot, salaries: snapshot.salaries.map((entry) => ids.has(entry.id)
    ? { ...entry, balance: 0 } : entry) } : snapshot
}

/** The first stored balance is an opening balance, already net of older purchases. */
function getSavingsLedgerStart(salaries: Salary[], sources: IncomeSource[]) {
  const ids = new Set(sources.map((source) => source.id))
  const firstMonth = salaries.filter((salary) => ids.has(salary.sourceId ?? ''))
    .map((salary) => salary.month).sort()[0]
  return firstMonth ? `${firstMonth}-01` : ''
}

/** Shared spendable balance for Savings, Wishlist and the monthly overview. */
export function getAvailableSavingsByCurrency(
  salaries: Salary[],
  sources: IncomeSource[],
  wishlist: WishlistItem[],
  currencyCode: string,
  month: string,
) {
  const normalizedCode = currencyCode.trim().toUpperCase()
  const balance = Math.max(0, getSavingsAccountBalances(salaries, sources, normalizedCode, month))
  const ledgerStart = getSavingsLedgerStart(salaries, findSavingsAccounts(sources, normalizedCode))
  const purchasedReserved = wishlist
    .filter((item) => (item.sourceCurrency ?? 'USD').trim().toUpperCase() === normalizedCode && isWishlistPurchased(item)
      && (!ledgerStart || !item.purchasedAt || item.purchasedAt.slice(0, 10) >= ledgerStart))
    .reduce((sum, item) => sum + getWishlistReservedAmount(item), 0)
  return { balance, purchasedReserved, free: Math.max(0, balance - purchasedReserved) }
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

    const goalUsd = account.salary.amount * (rate / 100)
    const savedUsd = savingsAccount
      ? getSavingsAccountBalances(salaries, sources, currencyCode, month)
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
