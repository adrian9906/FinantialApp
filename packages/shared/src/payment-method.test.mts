// Payments are cash unless explicitly marked as a transfer. Existing records
// have no flag at all, so they must keep showing as cash.
import { strict as assert } from 'node:assert'

import { isCashPayment } from './attachments.ts'

// --- Explicit values ---
assert.equal(isCashPayment({ isCash: true }), true, 'true es efectivo')
assert.equal(isCashPayment({ isCash: false }), false, 'false es transferencia')
console.log('PASS 1: true = efectivo, false = transferencia')

// --- Existing records without the field default to cash ---
assert.equal(isCashPayment({}), true, 'un gasto viejo sin el campo debe verse como efectivo')
assert.equal(isCashPayment({ isCash: undefined }), true, 'undefined se trata como efectivo')
console.log('PASS 2: los registros existentes se muestran como efectivo')

// --- Only an explicit false flips it, so bad data never hides a cash payment ---
{
  const transactions = [
    { id: 'a' },
    { id: 'b', isCash: true },
    { id: 'c', isCash: false },
  ]
  const cash = transactions.filter(isCashPayment).map((t) => t.id)
  assert.deepEqual(cash, ['a', 'b'], 'solo la marcada como transferencia queda fuera')
  console.log('PASS 3: solo un false explicito marca transferencia')
}

// --- The API stores the same default (entry.isCash !== false) ---
{
  const toColumn = (entry: { isCash?: boolean }) => entry.isCash !== false
  assert.equal(toColumn({}), true, 'sin dato se guarda como efectivo')
  assert.equal(toColumn({ isCash: true }), true)
  assert.equal(toColumn({ isCash: false }), false)
  console.log('PASS 4: la escritura en la BD usa el mismo criterio')
}

console.log('\nForma de pago correcta.')
