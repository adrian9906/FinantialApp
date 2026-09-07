import { useEffect, useState } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { resetSyncProgress, type SyncProgress } from '@/lib/sync-engine'

const ACTIVE_STAGES = new Set(['preparing', 'uploading', 'downloading'])
const SETTLED_VISIBLE_MS = 1800

/**
 * Reports the real state of the queue. "Sincronización completada" appears only
 * once every operation is acknowledged and no conflict is left open.
 */
export function SyncProgressDialog({ progress }: { progress: SyncProgress }) {
  // A background poll with nothing queued should not interrupt the user, so the
  // dialog only opens for a run that actually had operations to push.
  const isActive = ACTIVE_STAGES.has(progress.stage) && progress.total > 0
  const isSettled = (progress.stage === 'done' || progress.stage === 'failed') && progress.total > 0
  // Keyed by run id: dismissing one run never hides the next one.
  const [dismissedRun, setDismissedRun] = useState(0)

  useEffect(() => {
    if (isActive) return
    if (!isSettled) return

    const timeout = window.setTimeout(() => {
      setDismissedRun(progress.runId)
      resetSyncProgress()
    }, SETTLED_VISIBLE_MS)

    return () => window.clearTimeout(timeout)
  }, [isActive, isSettled, progress.runId])

  const open = (isActive || isSettled) && dismissedRun !== progress.runId
  if (!open) return null

  const value = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : null

  const title = progress.stage === 'done'
    ? 'Sincronización completada'
    : progress.stage === 'failed'
      ? 'Sincronización interrumpida'
      : 'Sincronizando tus datos...'

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{progress.message}</DialogDescription>
        </DialogHeader>

        <Progress value={value} />

        {progress.stage !== 'done' && progress.pending > 0 ? (
          <p className="text-xs text-muted-foreground">
            {progress.pending} {progress.pending === 1 ? 'cambio pendiente' : 'cambios pendientes'} guardados en este dispositivo.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
