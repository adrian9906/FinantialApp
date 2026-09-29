import assert from 'node:assert/strict'

import type { IncomeSource, Salary } from '@plata/shared'

import { resetIncomeCycle } from './reset-income-cycle.ts'

const sources: IncomeSource[] = [
  { id: 'salary', name: 'Salario USD', recurring: true, balanceMode: 'fixed', currencyCode: 'USD' },
  { id: 'cup', name: 'Transferencia CUP', recurring: true, balanceMode: 'zero', currencyCode: 'CUP' },
  { id: 'temporary', name: 'Bonus', recurring: false, balanceMode: 'fixed', currencyCode: 'USD' },
  { id: 'savings', name: 'Ahorro USD', recurring: true, balanceMode: 'fixed', currencyCode: 'USD' },
]

const salaries: Salary[] = [
  { id: 'salary-current', sourceId: 'salary', sourceName: 'Salario USD', kind: 'recurring', month: '2026-09', amount: 400, balance: 300, transferAdjustment: -100 },
  { id: 'cup-current', sourceId: 'cup', sourceName: 'Transferencia CUP', kind: 'recurring', balanceMode: 'zero', month: '2026-09', amount: 0, balance: 100, transferAdjustment: 100 },
  { id: 'temporary-current', sourceId: 'temporary', sourceName: 'Bonus', kind: 'one-off', month: '2026-09', amount: 50, balance: 20 },
  { id: 'savings-current', sourceId: 'savings', sourceName: 'Ahorro USD', kind: 'recurring', month: '2026-09', amount: 0, balance: 75, transferAdjustment: 75 },
  { id: 'salary-history', sourceId: 'salary', sourceName: 'Salario USD', kind: 'recurring', month: '2026-08', amount: 400, balance: 125, transferAdjustment: -275 },
]

const reset = resetIncomeCycle(salaries, sources, '2026-09')

assert.equal(reset.salaries.find((entry) => entry.id === 'salary-current')?.balance, 400, 'el salario recupera su monto original')
assert.equal(reset.salaries.find((entry) => entry.id === 'salary-current')?.transferAdjustment, 0, 'la transferencia deja de alterar el salario')
assert.equal(reset.salaries.find((entry) => entry.id === 'cup-current')?.balance, 0, 'una cuenta mensual sin ingreso automático vuelve a cero')
assert.ok(!reset.salaries.some((entry) => entry.sourceId === 'temporary'), 'el ingreso de una sola vez desaparece')
assert.ok(!reset.incomeSources.some((entry) => entry.id === 'temporary'), 'la cuenta temporal desaparece')
assert.equal(reset.salaries.find((entry) => entry.id === 'savings-current')?.balance, 75, 'los ahorros reales no se borran')
assert.equal(reset.salaries.find((entry) => entry.id === 'salary-history')?.balance, 125, 'el historial de meses anteriores no cambia')

console.log('Reset de ingresos: restaura saldos, elimina temporales y conserva ahorros e historial')
