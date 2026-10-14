import assert from 'node:assert/strict'
import type { LocalNotificationSchema, ScheduleOptions, PendingResult } from '@capacitor/local-notifications'
import { accountHealthNotificationId, cancelAccountHealthNotifications, notifyAccountHealth, scheduleAccountHealthReview } from './account-health-notifications'
import type { AccountHealth } from './account-health'
const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) }, configurable: true })
const alert: AccountHealth = { accountId: 'usd', accountName: 'Salario', currencyCode: 'USD', level: 'critical', balance: 5, commitments: 20, forecast: 10, margin: -25, hasHistory: true, asOf: '2026-10-14', month: '2026-10' }
let pending = [{ id: accountHealthNotificationId('old-user', 'usd'), extra: { accountHealth: true } }, { id: 1700000033, extra: { sync: true } }, { id: 10, extra: {} }] as unknown as PendingResult['notifications']
let cancelled: number[] = []
let scheduled: LocalNotificationSchema[] = []
let allowed: 'granted' | 'denied' = 'granted'
const services = { native: () => true, platform: () => 'android', permission: async () => allowed, notifications: {
  getPending: async () => ({ notifications: pending }),
  cancel: async ({ notifications }: { notifications: { id: number }[] }) => { cancelled.push(...notifications.map(n => n.id)); pending = pending.filter(n => !cancelled.includes(n.id)) },
  createChannel: async () => {},
  schedule: async ({ notifications }: ScheduleOptions) => { scheduled = notifications; return { notifications: notifications.map(({ id }) => ({ id })) } },
} }
await scheduleAccountHealthReview('user:one', [alert, { ...alert, accountId: 'cup', level: 'success' }], new Date(2026, 9, 14), () => true, services)
assert.equal(cancelled.length, 1, 'solo cancela avisos de esta función, no los de sincronización')
assert.equal(scheduled[0].iconColor, '#DC2626')
assert.equal(scheduled[1].iconColor, '#16A34A')
assert.equal(scheduled[0].schedule?.at?.getDate(), 25)
assert.equal(scheduled[0].schedule?.at?.getHours(), 9)
assert.ok(scheduled[0].body.includes('Calculado el 2026-10-14'), 'los avisos cerrados no fingen tener datos en vivo')
assert.equal(scheduled[0].extra.profile, 'user:one')
await scheduleAccountHealthReview('user:one', [alert], new Date(2026, 9, 26), () => true, services)
assert.equal(scheduled[0].schedule?.at?.getMonth(), 10)
assert.equal(scheduled[0].iconColor, '#64748B', 'no recomienda gastar el próximo mes usando saldo del anterior')
const previous = scheduled
await scheduleAccountHealthReview('user:one', [alert], new Date(2026, 9, 14), () => false, services)
assert.equal(scheduled, previous, 'no programa notificaciones si el usuario cambió')
allowed = 'denied'
await scheduleAccountHealthReview('user:one', [alert], new Date(2026, 9, 14), () => true, services)
assert.equal(scheduled, previous, 'respeta el permiso del sistema')
await cancelAccountHealthNotifications(services)
let deliveries = 0
const deliver = async () => { deliveries++; return true }
await notifyAccountHealth('user:one', [alert], () => true, deliver)
await notifyAccountHealth('user:one', [alert], () => true, deliver)
assert.equal(deliveries, 1, 'no repite el mismo aviso al recargar')
await notifyAccountHealth('user:one', [{ ...alert, level: 'success' }], () => true, deliver)
assert.equal(deliveries, 2, 'avisa si mejora el estado')
await notifyAccountHealth('user:two', [alert], () => true, deliver)
assert.equal(deliveries, 3, 'la deduplicación es independiente por usuario')
console.log('PASS: colores, programación, datos fechados, permisos, cambio de usuario y avisos sin spam.')
