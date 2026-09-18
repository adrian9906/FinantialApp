import { z } from 'zod'
import { isValidHostedImageUrl, MAX_ATTACHMENTS_PER_TRANSACTION, MAX_PLACE_LENGTH, syncCollections, type SyncOperation } from '@plata/shared'

const id = z.string().min(1).max(200)
const text = z.string().max(10000)
const amount = z.number().finite().nonnegative()
const date = z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Fecha inválida')
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const payment = z.object({ amount, date, createdAt: date.optional() })
const place = z.string().max(MAX_PLACE_LENGTH)
const attachment = z.string().refine(isValidHostedImageUrl, 'Las fotos deben ser URL HTTPS alojadas de forma segura.')
const attachments = z.array(attachment).max(MAX_ATTACHMENTS_PER_TRANSACTION)
const account = { incomeSourceId: id.optional(), incomeSourceName: text.optional() }
const currencyCode = z.string().min(1).max(32)
const balanceMode = z.enum(['fixed', 'zero'])
const planning = z.object({ amount, itemName: text, category: text, status: z.enum(['pending', 'checked']), date, unnecessary: z.boolean().optional(), ...account })
const hostedImageUrl = z.string().url().max(2_000).refine((value) => /^https:\/\//i.test(value), 'La imagen debe usar una URL HTTPS.')
const schemas = {
  salaries: z.object({ id, amount, month, balance: z.number().finite().optional(), transferAdjustment: z.number().finite().optional(), currencyCode: currencyCode.optional(), balanceMode: balanceMode.optional(), sourceId: id.optional(), sourceName: text.optional(), kind: z.enum(['recurring', 'one-off']).optional() }),
  incomeSources: z.object({ id, name: text, recurring: z.boolean(), archived: z.boolean().optional(), currencyCode: currencyCode.optional(), balanceMode: balanceMode.optional(), isCash: z.boolean().optional() }),
  transactions: z.object({ id, amount, type: z.enum(['expense', 'want', 'saving']), description: text.optional(), date, createdAt: date.optional(), place: place.optional(), attachments: attachments.optional(), isCash: z.boolean().optional(), ...account }),
  debts: z.object({ id, direction: z.enum(['payable', 'receivable']).optional(), counterparty: text.optional(), amount, history: text, startDate: date, endDate: date, interest: amount.optional(), paidAmount: amount, remainingAmount: amount, progress: z.number().finite(), isSettled: z.boolean(), payments: z.array(payment).max(10000).optional(), ...account }),
  wishlist: z.object({ id, name: text, price: amount, priority: z.enum(['low', 'medium', 'high']), savedAmount: amount, externalContribution: amount.optional(), isPurchased: z.boolean().optional(), purchasedAt: date.optional(), image: z.preprocess((value) => value === '' || value === null ? undefined : value, hostedImageUrl.optional()), sourceStore: text.optional(), sourceUrl: text.optional(), sourceCurrency: text.optional(), ...account }),
  monthlyPlanningHistory: z.object({ id, month, label: text, createdAt: date, expenses: z.array(planning), wants: z.array(planning), savingTransactionIds: z.array(id).optional() }),
  events: z.object({ id, name: text, date, amount, isNotification: z.boolean(), ...account }),
  projections: z.object({ id, targetSalary: amount, ...account }),
  savingsGoals: z.object({ id, name: text, category: z.enum(['emergency', 'travel', 'rent', 'phone', 'custom']), targetAmount: amount, currentAmount: amount, monthlyContribution: amount, ...account }),
  reminders: z.object({ id, title: text, description: text, date, completed: z.boolean() }),
  subscriptions: z.object({ id, name: text, amount, billingDay: z.number().int().min(1).max(31), status: z.enum(['active', 'cancelled']), startedAt: date, cancelledAt: date.optional(), ...account }),
}
export function parseSyncOperation(value: unknown): SyncOperation {
  const operation = z.object({ id, collection: z.enum(syncCollections), entityId: id, baseVersion: z.string().max(500).nullable(), value: z.unknown() }).parse(value)
  const record = operation.value === null ? null : schemas[operation.collection].parse(operation.value)
  if (record && record.id !== operation.entityId) throw new Error('El identificador del registro no coincide.')
  return { ...operation, value: record }
}

/** Field paths only; never return rejected values or personal data. */
export function getSyncValidationFields(error: unknown): string[] {
  return error instanceof z.ZodError
    ? [...new Set(error.issues.map((issue) => issue.path.join('.')))]
    : []
}

// Older API releases stripped these fields before hashing the receipt. A
// retry across the upgrade must become a reviewable conflict, not a 500 or an
// acknowledgement that silently discards account/balance information.
export function getLegacySyncOperation(operation: SyncOperation): SyncOperation {
  if (!operation.value) return operation
  const value = { ...operation.value } as Record<string, unknown>
  if (operation.collection === 'salaries') {
    delete value.balance; delete value.transferAdjustment; delete value.currencyCode; delete value.balanceMode
  } else if (operation.collection === 'incomeSources') {
    delete value.currencyCode; delete value.balanceMode; delete value.isCash
  } else {
    delete value.incomeSourceId; delete value.incomeSourceName
  }
  if (operation.collection === 'monthlyPlanningHistory') {
    for (const list of ['expenses', 'wants']) {
      value[list] = (value[list] as Array<Record<string, unknown>>).map((item) => {
        const copy = { ...item }
        delete copy.incomeSourceId; delete copy.incomeSourceName
        return copy
      })
    }
  }
  return { ...operation, value: value as unknown as SyncOperation['value'] }
}
