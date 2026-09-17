import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { readSyncDocument } from '@/lib/sync-store'
import { useAuthStore } from '@/store/authStore'

export function OfflineBackupCard() {
  const userId = useAuthStore((state) => state.user?.id)
  const [exporting, setExporting] = useState(false)

  async function exportBackup() {
    if (!userId || exporting) return
    setExporting(true)
    try {
      const syncDocument = await readSyncDocument(userId)
      const preferences = window.localStorage.getItem(`plata-financial-preferences:${userId}`)
      const pendingPreferences = window.localStorage.getItem(`plata-financial-preferences-pending:${userId}`)
      const backup = {
        format: 'plata-recovery-v1',
        exportedAt: new Date().toISOString(),
        document: syncDocument,
        preferences: preferences ? JSON.parse(preferences) : null,
        pendingPreferences: pendingPreferences ? JSON.parse(pendingPreferences) : null,
      }
      const file = new File([JSON.stringify(backup, null, 2)], `plata-respaldo-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: 'Respaldo local de Plata' })
      } else {
        const url = URL.createObjectURL(file)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
      toast.success('Respaldo local preparado. Guárdalo antes de reinstalar la app.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      toast.error('No se pudo exportar la copia local. Inténtalo de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  if (!userId) return null
  return (
    <Card className="border-graphite bg-surface p-6 shadow-vault">
      <h3 className="text-lg font-semibold text-on-surface">Respaldo local</h3>
      <p className="mt-2 text-sm text-muted-gray">
        Guarda una copia de los movimientos y cambios pendientes de este dispositivo para poder recuperar gastos que aún no llegaron al servidor.
        El archivo contiene información financiera privada; consérvalo en un lugar seguro.
      </p>
      <Button className="mt-4" variant="outline" loading={exporting} onClick={() => void exportBackup()}>
        Exportar copia local
      </Button>
    </Card>
  )
}
