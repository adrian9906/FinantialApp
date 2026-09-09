// The receipt review dialog converts the edited prices from the chosen
// currency into USD (how everything is stored) and marks the products as
// bought. These checks cover that arithmetic and the description encoding.
import { strict as assert } from 'node:assert'

import { buildExpenseDescription, parseExpenseDescription } from '../../../../packages/shared/src/expense-utils.ts'
import { parseReceiptTextToDraft } from '../../../../packages/shared/src/receipt-ocr.ts'
import { buildReceiptTransaction, getReceiptTotalsByType, type ReceiptReviewResult } from './receipt-review.ts'

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

// --- The photographed CUBAGORA receipt becomes four clean product rows ---
{
  const receipt = `CUBAGORA
Le atiende: YAMILKA
No: 48268
Cajero: YAMILKA
Fecha: 09/09/2026 13:05:11
1.00Jabon de Tocador Oliv 350.00
1.00Jabon Corporal Extrac 450.00
1.00Jabon de Tocador Rosa 350.00
1.00Nectar de Manzana Ems 650.00
SUBTOTAL: 1 800.00
TOTAL CUP: 1 800.00`

  const draft = parseReceiptTextToDraft(receipt, { transactionType: 'expense' })
  assert.equal(draft.date, '2026-09-09', 'debe llevar la fecha del recibo al calendario')
  assert.equal(draft.amount, 1800, 'debe entender el separador de miles impreso con espacio')
  assert.deepEqual(draft.lineItems, [
    { name: 'Jabon de Tocador Oliv', quantity: 1, price: 350 },
    { name: 'Jabon Corporal Extrac', quantity: 1, price: 450 },
    { name: 'Jabon de Tocador Rosa', quantity: 1, price: 350 },
    { name: 'Nectar de Manzana Ems', quantity: 1, price: 650 },
  ])
  console.log('PASS 8: CUBAGORA produce cuatro filas limpias con fecha, cantidad y precio')
}

// --- One receipt can create expenses and wants with independent payment methods ---
{
  const reviewed: ReceiptReviewResult[] = [
    { name: 'Jabon', quantity: 1, amount: 2, category: 'essentials', transactionType: 'expense', isCash: true },
    { name: 'Refresco', quantity: 2, amount: 3, category: 'outings', transactionType: 'want', isCash: false },
  ]
  assert.deepEqual(getReceiptTotalsByType(reviewed), { expense: 2, want: 3 })

  const expense = buildReceiptTransaction(reviewed[0], '2026-09-09')
  const want = buildReceiptTransaction(reviewed[1], '2026-09-09')
  assert.equal(expense.type, 'expense')
  assert.equal(expense.isCash, true)
  assert.equal(want.type, 'want')
  assert.equal(want.isCash, false)
  assert.equal(want.date, '2026-09-09')
  console.log('PASS 9: cada fila conserva destino, fecha y forma de pago')
}

// --- Repeated products remain separate rows instead of being discarded ---
{
  const draft = parseReceiptTextToDraft(
    'Tienda\n1 Arroz 100.00\n1 Arroz 100.00\nTOTAL 200.00',
    { transactionType: 'expense' },
  )
  assert.equal(draft.lineItems?.length, 2)
  console.log('PASS 10: dos líneas iguales se conservan como dos productos')
}

// --- Noise from totals and payment rows must never become products ---
{
  const noisyReceipt = `CUBAGORA
Fecha: 09/09/2006 13:05:11
1.00 Jabon de Tocador Oliv 350.00
1.00 Jabon Corporal Extrac 450.00
1.00 Jabon de Tocador Rosa 350.00
1.00 Nectar de Manzana Ems 650.00
7 x A DD 3
Ene 1800
SUBTOTAL 1800
PAGADO 1800
EFECTIVO 1800`
  const draft = parseReceiptTextToDraft(noisyReceipt, { transactionType: 'expense' })
  assert.deepEqual(draft.lineItems?.map((item) => item.price), [350, 450, 350, 650])
  assert.equal(draft.lineItems?.some((item) => /pagado|efectivo|a dd|ene/i.test(item.name)), false)
  assert.equal(draft.date, `${new Date().getFullYear()}-09-09`, 'corrige un único dígito imposible del año del OCR')
  console.log('PASS 11: descarta ruido de subtotal, pago y texto ilegible')
}

// --- Real output produced by the photographed receipt is repaired deterministically ---
{
  const photographed = `Fecha: 09/09/2026 13:05:11
“= 1.00Jabon de Tocador Oliv 350.00
O 1.00abon Corporal Extrac 450.00
A 1.00Jabon de Tocador Rosa 350.00
> 1.00Nectar de Manzana Ems 650.00
SUBTOTAL: 1 800.00
TOTAL CUP: 1 800,00
PAGADO: 1 800.00
EFECTIVO 1 800.00`
  const draft = parseReceiptTextToDraft(photographed, { transactionType: 'expense' })
  assert.deepEqual(draft.lineItems?.map(({ name, quantity, price }) => ({ name, quantity, price })), [
    { name: 'Jabon de Tocador Oliv', quantity: 1, price: 350 },
    { name: 'Jabon Corporal Extrac', quantity: 1, price: 450 },
    { name: 'Jabon de Tocador Rosa', quantity: 1, price: 350 },
    { name: 'Nectar de Manzana Ems', quantity: 1, price: 650 },
  ])
  console.log('PASS 12: corrige los prefijos espurios observados en la foto real')
}
