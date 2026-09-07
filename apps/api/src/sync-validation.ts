import { z } from 'zod'
import { syncCollections, type SyncOperation } from '@plata/shared'

const id = z.string().min(1).max(200)
const text = z.string().max(10000)
const amount = z.number().finite().nonnegative()
const date = z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Fecha inválida')
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const payment = z.object({ amount, date, createdAt: date.optional() })
const planning = z.object({ amount, itemName: text, category: text, status: z.enum(['pending', 'checked']), date, unnecessary: z.boolean().optional() })
const schemas = {
  salaries: z.object({ id, amount, month, sourceId: id.optional(), sourceName: text.optional(), kind: z.enum(['recurring', 'one-off']).optional() }),
  incomeSources: z.object({ id, name: text, recurring: z.boolean(), archived: z.boolean().optional() }),
  transactions: z.object({ id, amount, type: z.enum(['expense', 'want', 'saving']), description: text.optional(), date, createdAt: date.optional() }),
  debts: z.object({ id, direction: z.enum(['payable', 'receivable']).optional(), counterparty: text.optional(), amount, history: text, startDate: date, endDate: date, interest: amount.optional(), paidAmount: amount, remainingAmount: amount, progress: z.number().finite(), isSettled: z.boolean(), payments: z.array(payment).max(10000).optional() }),
  wishlist: z.object({ id, name: text, price: amount, priority: z.enum(['low', 'medium', 'high']), savedAmount: amount, externalContribution: amount.optional(), isPurchased: z.boolean().optional(), purchasedAt: date.optional(), image: z.string().max(4_000_000).optional(), sourceStore: text.optional(), sourceUrl: text.optional(), sourceCurrency: text.optional() }),
  monthlyPlanningHistory: z.object({ id, month, label: text, createdAt: date, expenses: z.array(planning), wants: z.array(planning), savingTransactionIds: z.array(id).optional() }),
  events: z.object({ id, name: text, date, amount, isNotification: z.boolean() }),
  projections: z.object({ id, targetSalary: amount }),
  savingsGoals: z.object({ id, name: text, category: z.enum(['emergency', 'travel', 'rent', 'phone', 'custom']), targetAmount: amount, currentAmount: amount, monthlyContribution: amount }),
  reminders: z.object({ id, title: text, description: text, date, completed: z.boolean() }),
  subscriptions: z.object({ id, name: text, amount, billingDay: z.number().int().min(1).max(31), status: z.enum(['active', 'cancelled']), startedAt: date, cancelledAt: date.optional() }),
}
export function parseSyncOperation(value: unknown): SyncOperation {
  const operation = z.object({ id, collection: z.enum(syncCollections), entityId: id, baseVersion: z.string().max(500).nullable(), value: z.unknown() }).parse(value)
  const record = operation.value === null ? null : schemas[operation.collection].parse(operation.value)
  if (record && record.id !== operation.entityId) throw new Error('El identificador del registro no coincide.')
  return { ...operation, value: record }
}
