import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'

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
  // Only a catch-up after losing connection is worth interrupting for: routine
  // uploads while online stay silent, as does a poll with nothing queued.
  const isActive = progress.visible && ACTIVE_STAGES.has(progress.stage) && progress.total > 0
  const isSettled = progress.visible
    && (progress.stage === 'done' || progress.stage === 'failed')
    && progress.total > 0
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
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-sm"
        // The spinner is decorative, so progress updates are announced here
        // instead for anyone using a screen reader.
        aria-live="polite"
        aria-busy={progress.stage !== 'done' && progress.stage !== 'failed'}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {/* The spinner keeps signalling activity while the percentage sits
                still waiting on a slow response; it swaps to a result icon so
                the outcome is readable at a glance. */}
            {progress.stage === 'done' ? (
              <CircleCheck className="size-4 shrink-0 text-emerald-500" aria-hidden="true" />
            ) : progress.stage === 'failed' ? (
              <CircleAlert className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
            ) : (
              <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            )}
            {title}
          </DialogTitle>
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
