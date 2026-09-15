import assert from 'node:assert/strict'
import { calculateCurrencyAmount, parseCurrencyAmount } from './currency-calculator.ts'

const usd = { exchangeRate: 1 }
const cup = { exchangeRate: 670 }
const eur = { exchangeRate: 0.92 }
assert.equal(calculateCurrencyAmount(10, usd, cup), 6700)
assert.equal(calculateCurrencyAmount(6700, cup, usd), 10)
assert.ok(Math.abs(calculateCurrencyAmount(6700, cup, eur)! - 9.2) < 1e-12)
assert.equal(calculateCurrencyAmount(20, eur, eur), 20)
assert.equal(calculateCurrencyAmount(0, usd, cup), 0)
assert.equal(calculateCurrencyAmount(10, { exchangeRate: 0 }, usd), null)
assert.equal(calculateCurrencyAmount(10, usd, { exchangeRate: Infinity }), null)
assert.equal(calculateCurrencyAmount(Number.MAX_VALUE, usd, cup), null)
assert.equal(calculateCurrencyAmount(-1, usd, cup), null)
assert.equal(parseCurrencyAmount('12,50'), 12.5)
assert.equal(parseCurrencyAmount('0'), 0)
for (const input of ['', '-2', '1e3', '1,2,3', 'abc', 'Infinity']) assert.equal(parseCurrencyAmount(input), null)
console.log('Currency calculator tests passed')
