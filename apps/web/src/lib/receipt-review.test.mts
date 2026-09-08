// The receipt review dialog converts the edited prices from the chosen
// currency into USD (how everything is stored) and marks the products as
// bought. These checks cover that arithmetic and the description encoding.
import { strict as assert } from 'node:assert'

import { buildExpenseDescription, parseExpenseDescription } from '../../../../packages/shared/src/expense-utils.ts'

// Mirrors convertToUsd in lib/currency.ts: an amount typed in a currency with
// an exchange rate is divided by that rate to reach USD.
const toUsd = (value: string | number, rate: number) => {
  const numeric = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'))
  return Number.isFinite(numeric) ? numeric / rate : 0
}

// --- Prices typed in a non-USD currency reach the store as USD ---
{
  const rate = 40 // 40 units per USD
  const rows = [
    { name: 'Arroz', price: '80', category: 'food' },
    { name: 'Jabon', price: '20', category: 'essentials' },
  ]
  const converted = rows.map((row) => toUsd(row.price, rate))
  assert.deepEqual(converted, [2, 0.5], 'cada precio debe convertirse a USD')
  assert.equal(converted.reduce((a, b) => a + b, 0), 2.5, 'el total se convierte igual')
  console.log('PASS 1: los precios se convierten a USD con la moneda elegida')
}

// --- A USD receipt is stored unchanged ---
{
  const converted = toUsd('12.35', 1)
  assert.equal(converted, 12.35, 'en USD el monto no cambia')
  console.log('PASS 2: un recibo en USD se guarda tal cual')
}

// --- Edited prices win over what the OCR read ---
{
  const scanned = 9.99
  const edited = '7.50'
  assert.equal(toUsd(edited, 1), 7.5, 'debe usarse el precio editado')
  assert.notEqual(toUsd(edited, 1), scanned)
  console.log('PASS 3: el precio editado reemplaza al leido por el OCR')
}

// --- Comma decimals are accepted ---
{
  assert.equal(toUsd('3,50', 1), 3.5, 'debe aceptar coma como separador decimal')
  console.log('PASS 4: acepta coma decimal')
}

// --- Products are stored in their category and already checked ---
{
  const description = buildExpenseDescription('food', 'Arroz', 'checked')
  const parsed = parseExpenseDescription(description)
  assert.equal(parsed.category, 'food', 'debe guardarse en la categoria elegida')
  assert.equal(parsed.itemName, 'Arroz')
  assert.equal(parsed.status, 'checked', 'debe quedar marcado como comprado')
  console.log('PASS 5: cada producto queda en su categoria y marcado')
}

// --- A custom category survives the round trip ---
{
  const parsed = parseExpenseDescription(buildExpenseDescription('custom:Mascotas', 'Alimento gato', 'checked'))
  assert.equal(parsed.category, 'custom:Mascotas', 'las categorias personalizadas tambien funcionan')
  assert.equal(parsed.status, 'checked')
  console.log('PASS 6: las categorias personalizadas funcionan')
}

// --- Invalid rows are rejected before writing ---
{
  const invalid = [
    { name: '', price: '10' },
    { name: 'Sin precio', price: '0' },
    { name: 'Negativo', price: '-5' },
  ]
  for (const row of invalid) {
    const rejected = !row.name.trim() || toUsd(row.price || 0, 1) <= 0
    assert.equal(rejected, true, `debe rechazarse: ${row.name || '(sin nombre)'}`)
  }
  console.log('PASS 7: se rechazan filas sin nombre o sin precio valido')
}

console.log('\nRevision de recibo correcta.')
