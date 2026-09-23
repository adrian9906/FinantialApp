import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'

import { resetSyncProgress, type SyncProgress } from '@/lib/sync-engine'

const ACTIVE_STAGES = new Set(['preparing', 'uploading', 'downloading'])
const SUCCESS_VISIBLE_MS = 1400
const FAILURE_VISIBLE_MS = 4000

/**
 * A non-blocking status strip for startup and reconnection syncs. It never
 * captures taps or covers the current screen with a modal backdrop.
 */
export function SyncProgressDialog({ progress }: { progress: SyncProgress }) {
  const isActive = progress.visible && ACTIVE_STAGES.has(progress.stage)
  const isSettled = progress.visible
    && (progress.stage === 'done' || progress.stage === 'failed')
  // Keyed by run id: dismissing one run never hides the next one.
  const [dismissedRun, setDismissedRun] = useState(0)

  useEffect(() => {
    if (isActive) return
    if (!isSettled) return

    const timeout = window.setTimeout(() => {
      setDismissedRun(progress.runId)
      resetSyncProgress()
    }, progress.stage === 'failed' ? FAILURE_VISIBLE_MS : SUCCESS_VISIBLE_MS)

    return () => window.clearTimeout(timeout)
  }, [isActive, isSettled, progress.runId, progress.stage])

  const open = (isActive || isSettled) && dismissedRun !== progress.runId
  if (!open) return null

  const value = progress.total > 0
    ? Math.min(100, Math.max(4, Math.round((progress.completed / progress.total) * 100)))
    : null
  const isIndeterminate = isActive && value === null
  const barWidth = progress.stage === 'done'
    ? 100
    : progress.stage === 'failed' && value === null
      ? 100
      : value

  const title = progress.stage === 'done'
    ? 'Datos actualizados'
    : progress.stage === 'failed'
      ? 'Sincronización pendiente'
      : progress.stage === 'downloading'
        ? 'Actualizando datos…'
        : 'Sincronizando…'

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[70] flex justify-center px-3">
      <div
        className="w-fit min-w-44 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-full border border-graphite/80 bg-surface/92 text-on-surface shadow-vault backdrop-blur-xl"
        role="status"
        aria-live="polite"
        aria-busy={isActive}
      >
        <div className="flex h-8 items-center gap-2 px-3">
          {progress.stage === 'done' ? (
            <CircleCheck className="size-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
          ) : progress.stage === 'failed' ? (
            <CircleAlert className="size-3.5 shrink-0 text-amber-400" aria-hidden="true" />
          ) : (
            <LoaderCircle className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
          )}
          <span className="truncate text-[11px] font-medium tracking-wide">{title}</span>
          {isActive && progress.total > 0 ? (
            <span className="ml-auto text-[10px] tabular-nums text-muted-gray">{value}%</span>
          ) : null}
        </div>
        <div className="h-0.5 overflow-hidden bg-graphite/70" aria-hidden="true">
          <div
            className={isIndeterminate
              ? 'plata-sync-indeterminate h-full bg-primary'
              : `h-full transition-[width] duration-300 ${progress.stage === 'failed' ? 'bg-amber-400' : progress.stage === 'done' ? 'bg-emerald-400' : 'bg-primary'}`}
            style={isIndeterminate ? undefined : { width: `${barWidth ?? 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}
