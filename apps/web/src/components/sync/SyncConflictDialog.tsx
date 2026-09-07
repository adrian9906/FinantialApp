import { useCallback, useEffect, useState } from 'react'
import type { SyncConflict, SyncValue } from '@plata/shared'
import { getSyncValue, syncCollections } from '@plata/shared'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { resolveConflict, subscribeToSyncProgress } from '@/lib/sync-engine'
import { readSyncDocument } from '@/lib/sync-store'
import { useAuthStore } from '@/store/authStore'
import { useFinanceStore } from '@/store/financeStore'

const COLLECTION_LABELS: Record<string, string> = {
  salaries: 'Ingreso',
  transactions: 'Movimiento',
  debts: 'Deuda',
  wishlist: 'Lista de deseos',
  monthlyPlanningHistory: 'Planificación mensual',
  events: 'Evento',
  projections: 'Proyección',
  savingsGoals: 'Meta de ahorro',
  reminders: 'Recordatorio',
  subscriptions: 'Suscripción',
}

function describe(value: SyncValue | null) {
  if (!value) return 'Eliminado'

  const record = value as unknown as Record<string, unknown>
  const name = record.name ?? record.title ?? record.description ?? record.history ?? record.month
  const amount = typeof record.amount === 'number'
    ? record.amount.toLocaleString('es-AR', { maximumFractionDigits: 2 })
    : null

  return [name ? String(name) : null, amount ? `$${amount}` : null].filter(Boolean).join(' · ') || 'Sin detalle'
}

export function SyncConflictDialog() {
  const user = useAuthStore((state) => state.user)
  const syncPendingChanges = useFinanceStore((state) => state.syncPendingChanges)
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [local, setLocal] = useState<Record<string, SyncValue | null>>({})
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setConflicts([])
      return
    }

    const document = await readSyncDocument(user.id)
    setConflicts(document.conflicts)

    // The device version is read from the local snapshot so the user compares
    // both actual values rather than a raw revision string.
    const entries: Record<string, SyncValue | null> = {}
    for (const conflict of document.conflicts) {
      const [collection, id] = conflict.key.split('/')
      if (!syncCollections.includes(collection as never)) continue
      entries[conflict.key] = getSyncValue(document.snapshot, collection as never, id)
    }
    setLocal(entries)
  }, [user])

  useEffect(() => {
    let active = true
    const reload = () => {
      if (active) void refresh()
    }

    const unsubscribe = subscribeToSyncProgress(reload)
    // Read the stored conflicts once on mount, after the first paint, so a
    // queue left over from a previous session still surfaces.
    const timeout = window.setTimeout(reload, 0)

    return () => {
      active = false
      window.clearTimeout(timeout)
      unsubscribe()
    }
  }, [refresh])

  const conflict = conflicts[0]
  if (!conflict || !user) return null

  const [collection] = conflict.key.split('/')

  async function choose(choice: 'local' | 'remote') {
    if (!user) return
    setBusy(true)
    try {
      await resolveConflict(user.id, conflict.key, choice)
      await refresh()
      void syncPendingChanges().catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dos versiones de un mismo dato</DialogTitle>
          <DialogDescription>
            {COLLECTION_LABELS[collection] ?? 'Registro'}: este dato cambió en otro dispositivo
            y también aquí. Ninguna versión se borró. Elige cuál conservar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="rounded-lg border border-graphite p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">En este dispositivo</p>
            <p className="text-sm">{describe(local[conflict.key] ?? null)}</p>
          </div>
          <div className="rounded-lg border border-graphite p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">En el servidor</p>
            <p className="text-sm">{describe(conflict.remote)}</p>
          </div>
        </div>

        {conflicts.length > 1 ? (
          <p className="text-xs text-muted-foreground">
            Quedan {conflicts.length - 1} conflictos más por revisar.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => void choose('remote')}>
            Usar la del servidor
          </Button>
          <Button disabled={busy} onClick={() => void choose('local')}>
            Usar la de este dispositivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
