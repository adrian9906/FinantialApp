import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { accountHealthMessage, nextAccountReview, type AccountHealth } from './account-health'
import { formatMoneyWithCode, getCurrencyByCode } from './currency'
import { getSystemNotificationPermission, showSystemNotification } from './system-notifications'

interface NotificationServices {
  native: () => boolean
  platform: () => string
  permission: typeof getSystemNotificationPermission
  notifications: Pick<typeof LocalNotifications, 'getPending' | 'cancel' | 'createChannel' | 'schedule'>
}
const nativeServices: NotificationServices = { native: () => Capacitor.isNativePlatform(), platform: () => Capacitor.getPlatform(), permission: getSystemNotificationPermission, notifications: LocalNotifications }

const CHANNEL = 'plata-account-health'
const MIN_ID = 1_700_000_000
const MAX_ID = 1_799_999_999
export const isAccountHealthNotification = (id: number) => id >= MIN_ID && id <= MAX_ID
export function accountHealthNotificationId(profile: string, account: string) {
  let hash = 0
  for (const character of `${profile}/${account}`) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0
  return MIN_ID + hash % (MAX_ID - MIN_ID + 1)
}
export function healthDeliveryKey(profile: string, alert: AccountHealth) {
  return `${profile}/${alert.month}/${alert.accountId}/${alert.level}`
}
export const formatAccountHealthMoney = (amount: number, code: string) => formatMoneyWithCode(amount, getCurrencyByCode(code))

/** Only this feature's reserved IDs are cancelled; sync/calendar notifications stay intact. */
export async function cancelAccountHealthNotifications(services = nativeServices) {
  if (!services.native()) return
  const { notifications } = await services.notifications.getPending()
  const own = notifications.filter(notification => isAccountHealthNotification(notification.id) && notification.extra?.accountHealth === true)
  if (own.length) await services.notifications.cancel({ notifications: own.map(({ id }) => ({ id })) })
}

export async function scheduleAccountHealthReview(profile: string, alerts: AccountHealth[], now: Date, isCurrent: () => boolean, services = nativeServices) {
  if (!services.native() || !isCurrent()) return
  await cancelAccountHealthNotifications(services)
  if (!isCurrent() || await services.permission() !== 'granted') return
  if (services.platform() === 'android') await services.notifications.createChannel({ id: CHANNEL, name: 'Revisión de tus cuentas', description: 'Avisos de saldo y margen de la última semana del mes.', importance: 4, visibility: 0, vibration: true })
  const at = nextAccountReview(now)
  // Do not predict next month's balance from this month's money. Send a review
  // reminder instead. Same-month advice is labelled with its calculation date.
  const sameMonth = at.getMonth() === now.getMonth() && at.getFullYear() === now.getFullYear()
  const ids = new Set<number>()
  const notifications = alerts.map(alert => {
    let id = accountHealthNotificationId(profile, alert.accountId)
    while (ids.has(id)) id = id === MAX_ID ? MIN_ID : id + 1
    ids.add(id)
    const message = sameMonth ? accountHealthMessage(alert, formatAccountHealthMoney) : { title: `Revisa ${alert.accountName}`, body: 'Llegó la última semana del mes. Abre Plata App para comprobar si conviene recortar gastos o pasar dinero a ahorro.' }
    return { id, title: sameMonth ? message.title : `Revisión de fin de mes · ${alert.accountName}`, body: sameMonth ? `${message.body} Calculado el ${alert.asOf}; abre la app para actualizarlo.` : message.body, channelId: CHANNEL, smallIcon: 'ic_stat_account_health', iconColor: sameMonth ? alert.level === 'critical' ? '#DC2626' : alert.level === 'success' ? '#16A34A' : '#D97706' : '#64748B', schedule: { at }, extra: { accountHealth: true, profile, accountId: alert.accountId } }
  })
  if (notifications.length && isCurrent()) await services.notifications.schedule({ notifications })
}

export async function notifyAccountHealth(profile: string, alerts: AccountHealth[], isCurrent: () => boolean, deliver = showSystemNotification) {
  const storageKey = 'plata-account-health-delivered'
  let delivered: string[] = []
  try { delivered = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); if (!Array.isArray(delivered)) delivered = [] } catch { /* Continue without a corrupted cache. */ }
  for (const alert of alerts) {
    const key = healthDeliveryKey(profile, alert)
    if (!isCurrent() || delivered.includes(key)) continue
    const message = accountHealthMessage(alert, formatAccountHealthMoney)
    const shown = await deliver({ ...message, tag: key, force: true, level: alert.level, extra: { accountHealth: true, profile, accountId: alert.accountId } })
    if (shown && isCurrent()) {
      delivered = [...delivered, key].slice(-300)
      try { localStorage.setItem(storageKey, JSON.stringify(delivered)) } catch { /* Device storage can be unavailable. */ }
    }
  }
}
