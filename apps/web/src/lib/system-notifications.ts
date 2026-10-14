import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export type SystemNotificationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

const ANDROID_CHANNEL_ID = 'plata-status'
let channelReady = false
let notificationSequence = 0

function normalizePermission(value: string): SystemNotificationPermission {
  if (value === 'granted') return 'granted'
  if (value === 'denied') return 'denied'
  return 'prompt'
}

async function ensureAndroidChannel() {
  if (Capacitor.getPlatform() !== 'android' || channelReady) return

  await LocalNotifications.createChannel({
    id: ANDROID_CHANNEL_ID,
    name: 'Estado de Plata App',
    description: 'Conexión y sincronización de tus datos financieros.',
    importance: 4,
    visibility: 1,
    vibration: true,
  })
  channelReady = true
}

export async function getSystemNotificationPermission(): Promise<SystemNotificationPermission> {
  if (Capacitor.isNativePlatform()) {
    const permission = await LocalNotifications.checkPermissions()
    return normalizePermission(permission.display)
  }

  if (typeof Notification === 'undefined') return 'unsupported'
  return normalizePermission(Notification.permission)
}

export async function requestSystemNotificationPermission(): Promise<SystemNotificationPermission> {
  if (Capacitor.isNativePlatform()) {
    const permission = await LocalNotifications.requestPermissions()
    if (permission.display === 'granted') await ensureAndroidChannel()
    return normalizePermission(permission.display)
  }

  if (typeof Notification === 'undefined') return 'unsupported'
  return normalizePermission(await Notification.requestPermission())
}

export async function showSystemNotification({
  title,
  body,
  tag,
  force = false,
  level,
  extra,
}: {
  title: string
  body: string
  tag: string
  force?: boolean
  level?: 'critical' | 'warning' | 'success'
  extra?: Record<string, unknown>
}) {
  if (await getSystemNotificationPermission() !== 'granted') return false

  if (Capacitor.isNativePlatform()) {
    await ensureAndroidChannel()
    if (level && Capacitor.getPlatform() === 'android') await LocalNotifications.createChannel({ id: 'plata-account-health', name: 'Revisión de tus cuentas', description: 'Avisos de saldo y margen de la última semana del mes.', importance: 4, visibility: 0, vibration: true })
    notificationSequence = (notificationSequence + 1) % 1000
    await LocalNotifications.schedule({
      notifications: [{
        id: (Date.now() % 2_000_000_000) + notificationSequence,
        title,
        body,
        channelId: level ? 'plata-account-health' : ANDROID_CHANNEL_ID,
        ...(extra ? { extra } : {}),
        ...(level ? { iconColor: level === 'critical' ? '#DC2626' : level === 'success' ? '#16A34A' : '#D97706', smallIcon: 'ic_stat_account_health' } : {}),
      }],
    })
    return true
  }

  if (!force && document.visibilityState === 'visible' && document.hasFocus()) return false

  const options: NotificationOptions = {
    body,
    tag,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.showNotification(title, options)
        return true
      }
    } catch {
      // Fall back to the browser API when the PWA worker is unavailable.
    }
  }

  new Notification(title, options)
  return true
}
