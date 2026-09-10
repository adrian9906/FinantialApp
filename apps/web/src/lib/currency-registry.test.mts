import assert from 'node:assert/strict'

import { USD_CURRENCY_ENTRY } from './currency-catalog.ts'
import { getMissingCurrencyPreference, type CurrencyLike } from './currency-registry.ts'

const onlyUsd: CurrencyLike[] = [USD_CURRENCY_ENTRY]

// Una cuenta en CUP debe registrar CUP como preferencia: es lo unico que se
// persiste en la base de datos, y sin eso otro navegador la resolvia como USD.
const missing = getMissingCurrencyPreference('CUP', onlyUsd)
assert.equal(missing?.code, 'CUP')
assert.equal(missing?.exchangeRate, 670, 'usa la tasa del catalogo, no 1')
console.log('PASS 1: la moneda de la cuenta se registra como preferencia')

// Si el usuario ya definio su propia tasa, no se toca.
const custom: CurrencyLike[] = [USD_CURRENCY_ENTRY, { ...missing!, exchangeRate: 400 }]
assert.equal(getMissingCurrencyPreference('CUP', custom), null, 'no se sobreescribe la tasa del usuario')
assert.equal(getMissingCurrencyPreference('cup', custom), null, 'la comparacion ignora mayusculas')
console.log('PASS 2: respeta la tasa existente sin duplicar')

// USD es implicita y los valores vacios no deben alterar nada.
assert.equal(getMissingCurrencyPreference('USD', onlyUsd), null)
assert.equal(getMissingCurrencyPreference('', onlyUsd), null)
assert.equal(getMissingCurrencyPreference(undefined, onlyUsd), null)
console.log('PASS 3: USD y valores vacios no alteran las preferencias')

// Una moneda fuera del catalogo se registra con tasa 1 en vez de perderse.
const unknown = getMissingCurrencyPreference('xyz', onlyUsd)
assert.equal(unknown?.code, 'XYZ')
assert.equal(unknown?.exchangeRate, 1)
console.log('PASS 4: una moneda desconocida se conserva con tasa 1')

console.log('Monedas de cuentas de ingreso correctas.')
