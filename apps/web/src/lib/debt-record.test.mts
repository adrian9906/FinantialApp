import assert from 'node:assert/strict'
import { createDebtRecord, filterDebtsByAccount, getDebtAccountOptions, getDebtCurrencyCode } from './debt-record.ts'

const input = { amount: 100, history: 'Préstamo', startDate: '2026-10-08', endDate: '2026-12-01', incomeSourceId: 'salary-usd', incomeSourceName: 'Salario USD' }
const payable = createDebtRecord({ ...input, initialPayment: 20 }, 'payable', '2026-10-09', '2026-10-09T00:00:00Z')
assert.equal(payable.incomeSourceId, 'salary-usd')
assert.equal(payable.incomeSourceName, 'Salario USD')
assert.equal(payable.paidAmount, 20)
assert.equal(payable.remainingAmount, 80)
assert.equal(payable.payments?.length, 1)
const receivable = createDebtRecord({ ...input, direction: 'receivable', incomeSourceId: 'transfer-cup' }, 'receivable', '2026-10-09', '2026-10-09T00:00:00Z')
assert.equal(receivable.incomeSourceId, 'transfer-cup')
assert.equal(receivable.direction, 'receivable')
const legacy = createDebtRecord({ ...input, incomeSourceId: undefined, incomeSourceName: undefined }, 'legacy', '2026-10-09', '2026-10-09T00:00:00Z')
const archived = { ...payable, id: 'archived', incomeSourceId: 'old-account', isSettled: true }
const records = [payable, receivable, legacy, archived]
assert.equal(filterDebtsByAccount(records).length, 4)
assert.deepEqual(filterDebtsByAccount(records, 'salary-usd').map((debt) => debt.id), ['payable'])
assert.deepEqual(filterDebtsByAccount(records, '').map((debt) => debt.id), ['legacy'])
assert.deepEqual(filterDebtsByAccount(records, 'old-account').map((debt) => debt.id), ['archived'])
assert.equal(JSON.parse(JSON.stringify(payable)).incomeSourceId, 'salary-usd')
const accounts = getDebtAccountOptions([
  { id: 'salary-usd', name: 'Salario USD', currencyCode: 'USD', recurring: true },
  { id: 'transfer-cup', name: 'Transferencia', currencyCode: 'CUP', recurring: false },
  { id: 'salary-eur', name: 'Cuenta europea', currencyCode: 'EUR', recurring: true },
], [{ ...payable, incomeSourceName: 'Nombre antiguo' }, archived])
assert.equal(accounts.find((account) => account.id === 'salary-usd')?.name, 'Salario USD')
assert.equal(getDebtCurrencyCode(accounts, 'salary-usd'), 'USD')
assert.equal(getDebtCurrencyCode(accounts, 'transfer-cup'), 'CUP')
assert.equal(getDebtCurrencyCode(accounts, 'salary-eur'), 'EUR')
assert.equal(getDebtCurrencyCode(accounts), 'USD')
assert.equal(getDebtCurrencyCode(accounts, 'old-account'), 'USD')
console.log('Debt account creation, initial payments, and visibility regressions passed.')
