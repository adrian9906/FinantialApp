import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useNavigate } from 'react-router-dom'
import { useAccountHealth } from '@/lib/useAccountHealth'
import { cancelAccountHealthNotifications, notifyAccountHealth, scheduleAccountHealthReview } from '@/lib/account-health-notifications'
import { useAuthStore } from '@/store/authStore'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'

let notificationWork = Promise.resolve()
export function AccountHealthBridge() {
  const { alerts, now, inLastWeek } = useAccountHealth()
  const enabled = usePreferencesStore(state => state.systemNotificationsEnabled && state.accountHealthNotificationsEnabled)
  const authMode = useAuthStore(state => state.authMode)
  const userId = useAuthStore(state => state.user?.id)
  const hasLoaded = useFinanceStore(state => state.hasLoaded)
  const loadedKey = useFinanceStore(state => state.loadedKey)
  const profile = authMode === 'authenticated' && userId ? `user:${userId}` : authMode === 'guest' ? 'guest' : undefined
  const navigate = useNavigate()
  useEffect(() => {
    let active = true
    const isCurrent = () => active && useAuthStore.getState().authMode === authMode && useAuthStore.getState().user?.id === userId
    const timer = window.setTimeout(() => {
      notificationWork = notificationWork.catch(() => {}).then(async () => {
        if (!isCurrent()) return
        if (!enabled || !profile) { await cancelAccountHealthNotifications(); return }
        if (!hasLoaded || loadedKey !== profile) { await cancelAccountHealthNotifications(); return }
        await scheduleAccountHealthReview(profile, alerts, now, isCurrent)
        if (inLastWeek && isCurrent()) await notifyAccountHealth(profile, alerts, isCurrent)
      }).catch(() => {})
    }, 500)
    return () => { active = false; clearTimeout(timer) }
  }, [alerts, now, inLastWeek, enabled, profile, authMode, userId, hasLoaded, loadedKey])
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let active = true
    const handle = LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
      const data = notification.extra
      if (!active || !data?.accountHealth || data.profile !== profile) return
      if (useFinanceStore.getState().incomeSources.some(source => source.id === data.accountId && !source.archived)) usePreferencesStore.getState().setActiveIncomeSource(data.accountId)
      navigate('/')
    })
    return () => { active = false; void handle.then(listener => listener.remove()) }
  }, [navigate, profile])
  return null
}
