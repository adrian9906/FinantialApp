import { getPlannedExpenseTotal, getPlannedWantTotal, getSalaryPlanningBase, type AllocationFormula, type BootstrapPayload, type Transaction } from '@plata/shared'
import { isVoiceExpenseCategory, isVoiceWantCategory } from './voice-parser.ts'
import { reconcileIncomeAccountCharge } from './income-account.ts'
import { validatePlannedMovement } from './planned-movement-validation.ts'

export function prepareVoiceBatch(snapshot: BootstrapPayload, inputs: Transaction[], formulaFor: (accountId: string) => AllocationFormula) {
  let salaries = snapshot.salaries
  const transactions = [...snapshot.transactions]
  const created: Transaction[] = []
  const seen = new Set(transactions.map((entry) => entry.id))
  for (const input of inputs) {
    if (seen.has(input.id)) {
      const previous = transactions.find((entry) => entry.id === input.id)
      if (previous && ['amount', 'type', 'description', 'date', 'incomeSourceId'].some((key) => previous[key as keyof Transaction] !== input[key as keyof Transaction])) throw new Error('Ese borrador ya se guardó con otros datos. Revisa el movimiento en Plata.')
      continue
    }
    if (!input.id.startsWith('voice-') || !input.incomeSourceId || !['expense', 'want'].includes(input.type)) throw new Error('El borrador no es un gasto o gusto válido.')
    const source = snapshot.incomeSources.find((entry) => entry.id === input.incomeSourceId && !entry.archived)
    const salary = salaries.find((entry) => entry.sourceId === input.incomeSourceId && entry.month === input.date.slice(0, 7))
    if (!source || !salary) throw new Error('No existe esa cuenta para el mes del movimiento.')
    const date = new Date(input.date + 'T12:00:00')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(date.getTime()) || date.getDate() !== Number(input.date.slice(8, 10))) throw new Error('La fecha no es válida.')
    const category = input.description?.split('::')[0] ?? ''
    if (!(input.type === 'expense' ? isVoiceExpenseCategory(category) : isVoiceWantCategory(category))) throw new Error('Selecciona una categoría válida.')
    const formula = formulaFor(source.id)
    const percentage = input.type === 'expense' ? formula.expenses : formula.wants
    if (percentage === 0) throw new Error('Esa sección está desactivada para esta cuenta.')
    const period = transactions.filter((entry) => entry.incomeSourceId === source.id)
    const plannedTotal = input.type === 'expense' ? getPlannedExpenseTotal(period) : getPlannedWantTotal(period)
    const error = validatePlannedMovement({ amount: input.amount, plannedTotal, budget: getSalaryPlanningBase(salary) * percentage / 100, balance: Number(salary.balance ?? salary.amount) })
    if (error) throw new Error(error)
    const transaction = { ...input, incomeSourceName: source.name, isCash: source.isCash !== false }
    salaries = reconcileIncomeAccountCharge(salaries, undefined, transaction)
    transactions.unshift(transaction)
    created.push(transaction)
    seen.add(transaction.id)
  }
  return { transactions, salaries, created }
}

export async function persistPreparedVoiceBatch(prepared: ReturnType<typeof prepareVoiceBatch>, persist: () => Promise<void>, commit: () => void, sessionCurrent: () => boolean) {
  await persist()
  if (!sessionCurrent()) throw new Error('La sesión cambió. Abre Plata para comprobar el guardado.')
  commit()
  return prepared.created
}
