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
  useEffect(() => {
    if (authMode !== 'authenticated') return

    const run = () => {
      if (!isOnline()) return
      void syncPendingChanges().catch(() => {})
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') run()
    }

    window.addEventListener('online', run)
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', handleVisibility)
    const interval = window.setInterval(run, PERIODIC_SYNC_MS)

    run()

    return () => {
      window.removeEventListener('online', run)
      window.removeEventListener('focus', run)
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
