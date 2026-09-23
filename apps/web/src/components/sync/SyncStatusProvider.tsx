import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { getSyncProgress, subscribeToSyncProgress, type SyncProgress, type SyncReason } from '@/lib/sync-engine'
import { isOnline } from '@/lib/offline'
import { useAuthStore } from '@/store/authStore'
import { useFinanceStore } from '@/store/financeStore'
import { SyncProgressDialog } from '@/components/sync/SyncProgressDialog'
import { SyncConflictDialog } from '@/components/sync/SyncConflictDialog'
import { showSystemNotification } from '@/lib/system-notifications'
import { usePreferencesStore } from '@/store/preferencesStore'

const OFFLINE_TOAST_ID = 'plata-offline'
const ONLINE_TOAST_ID = 'plata-online'

export function SyncStatusProvider() {
  const authMode = useAuthStore((state) => state.authMode)
  const userId = useAuthStore((state) => state.user?.id)
  const syncPendingChanges = useFinanceStore((state) => state.syncPendingChanges)
  const systemNotificationsEnabled = usePreferencesStore((state) => state.systemNotificationsEnabled)
  const connectionNotificationsEnabled = usePreferencesStore((state) => state.connectionNotificationsEnabled)
  const syncNotificationsEnabled = usePreferencesStore((state) => state.syncNotificationsEnabled)
  const [progress, setProgress] = useState<SyncProgress>(getSyncProgress)
  const wasOffline = useRef(!isOnline())
  const lastNotifiedSyncRun = useRef(0)

  useEffect(() => subscribeToSyncProgress(setProgress), [])

  // Connectivity notices are shown for every mode: even a guest needs to know
  // that what they type is being kept on the device.
  useEffect(() => {
    function handleOffline() {
      wasOffline.current = true
      toast.warning('Te quedaste sin internet. Todo lo que registres ahora se guardará en este dispositivo.', {
        id: OFFLINE_TOAST_ID,
        duration: 6000,
      })
      if (systemNotificationsEnabled && connectionNotificationsEnabled) {
        void showSystemNotification({
          title: 'Sin conexión',
          body: 'Todo lo que registres se guardará en este dispositivo hasta recuperar Internet.',
          tag: 'plata-connection',
        }).catch(() => {})
      }
    }

    function handleOnline() {
      if (wasOffline.current) {
        toast.success('Vuelves a tener internet.', { id: ONLINE_TOAST_ID, duration: 4000 })
        if (systemNotificationsEnabled && connectionNotificationsEnabled) {
          void showSystemNotification({
            title: 'Conexión recuperada',
            body: 'Plata App volverá a sincronizar tus cambios pendientes.',
            tag: 'plata-connection',
          }).catch(() => {})
        }
      }
      wasOffline.current = false
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [connectionNotificationsEnabled, systemNotificationsEnabled])

  useEffect(() => {
    if (!systemNotificationsEnabled || !syncNotificationsEnabled) return
    if (progress.total <= 0 || lastNotifiedSyncRun.current === progress.runId) return
    if (progress.stage !== 'done' && progress.stage !== 'failed') return

    lastNotifiedSyncRun.current = progress.runId
    void showSystemNotification({
      title: progress.stage === 'done' ? 'Sincronización completada' : 'Sincronización interrumpida',
      body: progress.message,
      tag: 'plata-sync',
    }).catch(() => {})
  }, [progress, syncNotificationsEnabled, systemNotificationsEnabled])

  // Startup and a real browser/network reconnection get the compact visible
  // indicator. Normal edits already upload through the finance store and stay
  // silent, so a stable connection never produces UI noise.
  useEffect(() => {
    if (authMode !== 'authenticated') return

    const run = (reason: SyncReason) => {
      if (!isOnline()) return
      void (async () => {
        if (userId) await usePreferencesStore.getState().hydrateCurrencyPreferences(userId).catch(() => {})
        if (useAuthStore.getState().authMode !== 'authenticated' || useAuthStore.getState().user?.id !== userId) return
        await syncPendingChanges(reason)
      })().catch(() => {})
    }

    function handleReconnect() {
      run('reconnect')
    }

    window.addEventListener('online', handleReconnect)

    // Every authenticated app start checks for local and remote changes.
    run('startup')

    return () => {
      window.removeEventListener('online', handleReconnect)
    }
  }, [authMode, syncPendingChanges, userId])

  if (authMode !== 'authenticated') return null

  return (
    <>
      <SyncProgressDialog progress={progress} />
      <SyncConflictDialog />
    </>
  )
}
