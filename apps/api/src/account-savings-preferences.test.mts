import assert from 'node:assert/strict'

// Se prueba la funcion real del API, no una copia, para que no se separen.
import { normalizeAccountSavingsFormulas } from './api.ts'

assert.deepEqual(normalizeAccountSavingsFormulas({ salary: 50, cup: 10 }), { salary: 50, cup: 10 })
assert.deepEqual(
  normalizeAccountSavingsFormulas({
    salary: { savings: 62.5, expenses: 37.5, wants: 0, rolloverSavings: false },
  }),
  { salary: { savings: 62.5, expenses: 37.5, wants: 0, rolloverSavings: false } },
  'conserva la fórmula completa de cada cuenta',
)
console.log('PASS 1: se conservan los porcentajes validos')

assert.deepEqual(normalizeAccountSavingsFormulas({ salary: 150 }), { salary: 100 }, 'se limita a 100')
assert.deepEqual(normalizeAccountSavingsFormulas({ salary: 33.4 }), { salary: 33 }, 'se redondea')
console.log('PASS 2: se limita a 100 y se redondea')

// Un 0 significa "sin formula": no debe ocupar espacio en la BD.
assert.deepEqual(normalizeAccountSavingsFormulas({ salary: 0, cup: -5 }), {})
assert.deepEqual(normalizeAccountSavingsFormulas({ salary: 'abc' }), {})
assert.deepEqual(normalizeAccountSavingsFormulas({ salary: null }), {})
console.log('PASS 3: se descartan ceros, negativos y valores no numericos')

// Entradas corruptas no deben romper la carga de preferencias.
assert.deepEqual(normalizeAccountSavingsFormulas(null), {})
assert.deepEqual(normalizeAccountSavingsFormulas(undefined), {})
assert.deepEqual(normalizeAccountSavingsFormulas([1, 2]), {}, 'un array no es un mapa de cuentas')
assert.deepEqual(normalizeAccountSavingsFormulas('texto'), {})
console.log('PASS 4: entradas invalidas devuelven un mapa vacio')

// No se acepta una carga ilimitada de claves.
const many: Record<string, number> = {}
for (let index = 0; index < 300; index += 1) many[`cuenta-${index}`] = 10
assert.equal(Object.keys(normalizeAccountSavingsFormulas(many)).length, 200)
console.log('PASS 5: se limita la cantidad de cuentas guardadas')

console.log('Normalizacion del ahorro por cuenta correcta.')
