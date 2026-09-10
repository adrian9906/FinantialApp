import type { IncomeAccountView } from '@/lib/income-account-view'

export type ReceiptPaymentMethod = 'cash' | 'transfer'

export function getAccountPaymentMethod(account: IncomeAccountView): ReceiptPaymentMethod {
  return account.source.isCash === false ? 'transfer' : 'cash'
}

export function getAccountCurrencyCode(account: IncomeAccountView) {
  return (account.salary.currencyCode ?? account.source.currencyCode ?? 'USD').trim().toUpperCase()
}

/**
 * A receipt is charged to a single account, so the currency and the payment
 * method chosen in the dialog decide which accounts can receive it. An account
 * marked as transfer cannot take a cash purchase and the other way around.
 */
export function getEligibleReceiptAccounts(
  accounts: IncomeAccountView[],
  currencyCode: string,
  paymentMethod: ReceiptPaymentMethod,
): IncomeAccountView[] {
  const normalizedCode = currencyCode.trim().toUpperCase()

  return accounts.filter((account) => getAccountCurrencyCode(account) === normalizedCode
    && getAccountPaymentMethod(account) === paymentMethod)
}

/**
 * Keeps the user's pick while it stays valid, otherwise falls back to the only
 * sensible default. Returns an empty string when no account matches, which is
 * what the dialog uses to block saving and ask for a new account.
 */
export function resolveReceiptAccountId(
  eligibleAccounts: IncomeAccountView[],
  preferredId: string,
): string {
  if (eligibleAccounts.some((account) => account.source.id === preferredId)) return preferredId
  return eligibleAccounts[0]?.source.id ?? ''
}

/** Currencies that have at least one account, so the picker cannot offer a dead end. */
export function getReceiptCurrencyCodes(accounts: IncomeAccountView[]): string[] {
  return [...new Set(accounts.map(getAccountCurrencyCode))].sort()
}

export function getMissingReceiptAccountMessage(currencyCode: string, paymentMethod: ReceiptPaymentMethod) {
  const method = paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'
  return `No tienes ninguna cuenta en ${currencyCode.trim().toUpperCase()} con forma de pago ${method}. Crea esa cuenta para poder guardar este recibo.`
}
