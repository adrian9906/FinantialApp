import assert from 'node:assert/strict'
import { createEmptyBootstrapPayload, normalizeBootstrapPayload } from '@plata/shared'
import { getIncomeAccountsForMonth } from './income-account-view.ts'

const salary = { id: 'salary1', sourceId: 'source1', month: '2026-09', amount: 10, balance: 7, currencyCode: 'USD' }
const source = { id: 'source1', name: 'Transferencia', recurring: true, currencyCode: 'CUP' }
const normalized = normalizeBootstrapPayload({ ...createEmptyBootstrapPayload(), salaries: [salary], incomeSources: [source] })
assert.equal(normalized.salaries[0].currencyCode, 'CUP')
assert.equal(normalized.salaries[0].amount, salary.amount, 'corregir moneda no convierte ni cambia el importe USD interno')
assert.equal(normalized.salaries[0].balance, salary.balance)
assert.equal(salary.currencyCode, 'USD', 'no mutar el registro de entrada')
const accounts = getIncomeAccountsForMonth([salary], [source], '2026-09', 'CUP')
assert.equal(accounts.length, 1)
assert.equal(accounts[0].salary.currencyCode, 'CUP')
assert.equal(getIncomeAccountsForMonth([salary], [source], '2026-09', 'USD').length, 0)
assert.equal(normalizeBootstrapPayload({ salaries: [{ ...salary, sourceId: undefined }] }).salaries[0].currencyCode, 'USD')
console.log('Cuenta CUP con salario legado USD: moneda canónica, visibilidad por CUP y saldo sin conversiones extra correctos')
