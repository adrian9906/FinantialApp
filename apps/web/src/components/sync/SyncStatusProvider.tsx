import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { getSyncProgress, subscribeToSyncProgress, type SyncProgress } from '@/lib/sync-engine'
import { isOnline } from '@/lib/offline'
import { useAuthStore } from '@/store/authStore'
import { useFinanceStore } from '@/store/financeStore'
import { SyncProgressDialog } from '@/components/sync/SyncProgressDialog'
import { SyncConflictDialog } from '@/components/sync/SyncConflictDialog'

const OFFLINE_TOAST_ID = 'plata-offline'
const ONLINE_TOAST_ID = 'plata-online'
const PERIODIC_SYNC_MS = 5 * 60 * 1000

export function SyncStatusProvider() {
  const authMode = useAuthStore((state) => state.authMode)
  const syncPendingChanges = useFinanceStore((state) => state.syncPendingChanges)
  const [progress, setProgress] = useState<SyncProgress>(getSyncProgress)
  const wasOffline = useRef(!isOnline())
  // Set when the link drops and cleared only once a sync has actually run, so
  // the toast handler cannot clear it before the sync effect reads it.
  const needsVisibleSync = useRef(!isOnline())

  useEffect(() => subscribeToSyncProgress(setProgress), [])

  // Connectivity notices are shown for every mode: even a guest needs to know
  // that what they type is being kept on the device.
  useEffect(() => {
    function handleOffline() {
      wasOffline.current = true
      needsVisibleSync.current = true
      toast.warning('Te quedaste sin internet. Todo lo que registres ahora se guardará en este dispositivo.', {
        id: OFFLINE_TOAST_ID,
        duration: 6000,
      })
    }

    function handleOnline() {
      if (wasOffline.current) {
        toast.success('Vuelves a tener internet.', { id: ONLINE_TOAST_ID, duration: 4000 })
      }
      wasOffline.current = false
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  // Sync on reconnect, on returning to the app, and periodically while open.
  // Only the run that follows an actual disconnection is shown to the user;
  // everything else uploads silently in the background.
  useEffect(() => {
    if (authMode !== 'authenticated') return

    const run = (reason: 'silent' | 'reconnect' = 'silent') => {
      if (!isOnline()) return
      if (reason === 'reconnect') needsVisibleSync.current = false
      void syncPendingChanges(reason).catch(() => {})
    }

    function handleReconnect() {
      run(needsVisibleSync.current ? 'reconnect' : 'silent')
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') handleReconnect()
    }

    window.addEventListener('online', handleReconnect)
    window.addEventListener('focus', handleReconnect)
    document.addEventListener('visibilitychange', handleVisibility)
    const interval = window.setInterval(() => run('silent'), PERIODIC_SYNC_MS)

    // The app may be opening with a queue left from an offline session.
    run(needsVisibleSync.current ? 'reconnect' : 'silent')

    return () => {
      window.removeEventListener('online', handleReconnect)
      window.removeEventListener('focus', handleReconnect)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(interval)
    }
  }, [authMode, syncPendingChanges])

  if (authMode !== 'authenticated') return null

  return (
    <>
      <SyncProgressDialog progress={progress} />
      <SyncConflictDialog />
    </>
  )
}
