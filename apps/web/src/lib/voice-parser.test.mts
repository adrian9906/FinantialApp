import { strict as assert } from 'node:assert'
import { normalizeSpokenNumbers, parseVoiceMovements, type VoiceParseContext } from './voice-parser.ts'

const context: VoiceParseContext = { today: '2026-09-15', accountId: 'a', currencyCode: 'USD', accounts: [{ id: 'a', name: 'Salario', currencyCode: 'USD' }, { id: 'b', name: 'Efectivo', currencyCode: 'CUP' }], currencyCodes: ['USD', 'CUP', 'EUR'], rules: [] }
assert.equal(normalizeSpokenNumbers('treinta y cinco'), '35')
assert.equal(normalizeSpokenNumbers('veinte con cincuenta'), '20.50')
assert.equal(normalizeSpokenNumbers('novecientos noventa y nueve mil novecientos noventa y nueve'), '999999')
assert.equal(normalizeSpokenNumbers('un gasto de cinco dólares en pan'), 'gasto de 5 dolares en pan')
assert.equal(normalizeSpokenNumbers('un café por dos dólares'), 'un cafe por 2 dolares')
const mixed = parseVoiceMovements('Un gasto de cinco dólares en pan y un gusto de veinte dólares en cine', context)
assert.equal(mixed.length, 2)
assert.deepEqual(mixed.map(({ itemName, amount, type, category, status }) => ({ itemName, amount, type, category, status })), [
  { itemName: 'Pan', amount: '5', type: 'expense', category: 'food', status: 'pending' },
  { itemName: 'Cine', amount: '20', type: 'want', category: 'outings', status: 'pending' },
])
assert.notEqual(mixed[0].id, mixed[1].id)
const decimal = parseVoiceMovements('gasto de veinte con cincuenta en transporte pagado ayer', context)[0]
assert.equal(decimal.amount, '20.50')
assert.equal(decimal.date, '2026-09-14')
assert.equal(decimal.status, 'checked')
assert.equal(decimal.category, 'essentials')
assert.equal(parseVoiceMovements('pan y leche cinco', context).length, 1)
assert.equal(parseVoiceMovements('pan cinco, cine veinte', context).length, 2)
assert.equal(parseVoiceMovements('pan 5,50', context)[0].amount, '5.50')
assert.equal(parseVoiceMovements('pan cinco anteayer', { ...context, today: '2026-03-01' })[0].date, '2026-02-27')
assert.equal(parseVoiceMovements('pan cinco el doce de septiembre de dos mil veintiseis', context)[0].date, '2026-09-12')
assert.equal(parseVoiceMovements('pan cinco el 12/09/2026', context)[0].amount, '5')
assert.equal(parseVoiceMovements('pan cinco cuenta efectivo', context)[0].incomeSourceId, 'b')
assert.equal(parseVoiceMovements('pan cinco cuenta desconocida', context)[0].incomeSourceId, '')
assert.equal(parseVoiceMovements('pan cinco pesos', context)[0].currencyCode, '')
assert.equal(parseVoiceMovements('pan cinco euros', context)[0].currencyCode, 'EUR')
assert.equal(parseVoiceMovements('algo cinco', context)[0].type, '')
assert.equal(parseVoiceMovements('pan cinco veinte', context)[0].amount, '')
assert.equal(parseVoiceMovements('pan 5 20', context)[0].amount, '')
assert.equal(parseVoiceMovements('pan sin precio', context)[0].amount, '')
assert.equal(parseVoiceMovements('', context).length, 0)
console.log('Voice parser: multiple drafts, Spanish numbers, decimals, dates, categories and ambiguity passed')
