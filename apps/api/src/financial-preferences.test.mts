import assert from 'node:assert/strict'
import { defaultFormula } from '@plata/shared'
import { mergeCurrencyPreferences, normalizeAccountSavingsFormulas } from './api.ts'

const usd = { code: 'USD', name: 'USD', country: '', locale: 'en-US', exchangeRate: 1 }
const cup = { code: 'CUP', name: 'Peso cubano', country: 'Cuba', locale: 'es-CU', exchangeRate: 350 }
const formula = { expenses: 37.5, wants: 0, savings: 62.5, rolloverSavings: false }
const current = { currencies: [usd, cup], activeCurrencyCode: 'CUP', accountSavingsFormulas: { account1: formula }, formula }
const discovered = mergeCurrencyPreferences(current, { discoveredCurrencies: [{ ...cup, exchangeRate: 1 }] })
assert.deepEqual(discovered.accountSavingsFormulas, current.accountSavingsFormulas)
assert.deepEqual(discovered.formula, formula)
assert.equal(discovered.currencies.find((entry) => entry.code === 'CUP')?.exchangeRate, 350, 'registrar CUP automáticamente no cambia su tasa remota')
const fromFreshPhone = mergeCurrencyPreferences(current, { currencies: [usd], accountSavingsFormulas: {} })
assert.deepEqual(fromFreshPhone.accountSavingsFormulas, current.accountSavingsFormulas)
assert.equal(fromFreshPhone.currencies.find((entry) => entry.code === 'CUP')?.exchangeRate, 350)
const global = mergeCurrencyPreferences(current, { formula: defaultFormula })
assert.deepEqual(global.formula, defaultFormula)
assert.deepEqual(global.accountSavingsFormulas, current.accountSavingsFormulas)
const account = mergeCurrencyPreferences(current, { accountSavingsFormulas: { account2: defaultFormula } })
assert.deepEqual(account.accountSavingsFormulas, { account1: formula, account2: defaultFormula })
assert.equal(mergeCurrencyPreferences(current, { currencies: [{ ...cup, exchangeRate: 400 }] }).currencies.find((entry) => entry.code === 'CUP')?.exchangeRate, 400, 'una edición explícita sí cambia la tasa')
assert.deepEqual(mergeCurrencyPreferences(current, { resetAccountFormulas: true }).accountSavingsFormulas, {})
assert.equal(mergeCurrencyPreferences(current, { removedCurrencyCodes: ['CUP'] }).activeCurrencyCode, 'USD')
assert.ok(mergeCurrencyPreferences(current, { removedCurrencyCodes: ['USD'] }).currencies.some((entry) => entry.code === 'USD'))
assert.throws(() => mergeCurrencyPreferences(current, { formula: { ...formula, expenses: 99 } }))
assert.throws(() => mergeCurrencyPreferences(current, { formula: { ...formula, expenses: Infinity } }))
const longId = 'source-' + 'a'.repeat(100)
assert.ok(longId in normalizeAccountSavingsFormulas({ [longId]: formula }), 'no truncar claves válidas de cuenta')
assert.deepEqual(current.formula, formula, 'las preferencias anteriores no se mutan')
console.log('Preferencias API: fórmula global, cambios parciales, tasa CUP remota, varias cuentas, reset e IDs largos correctos')
