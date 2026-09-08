import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AppIcon } from '@/components/icons/AppIcon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  getSystemNotificationPermission,
  requestSystemNotificationPermission,
  showSystemNotification,
  type SystemNotificationPermission,
} from '@/lib/system-notifications'
import { usePreferencesStore } from '@/store/preferencesStore'

const permissionLabels: Record<SystemNotificationPermission, string> = {
  granted: 'Permitidas',
  denied: 'Bloqueadas',
  prompt: 'Sin solicitar',
  unsupported: 'No disponibles',
}

export function NotificationSettings() {
  const enabled = usePreferencesStore((state) => state.systemNotificationsEnabled)
  const connectionEnabled = usePreferencesStore((state) => state.connectionNotificationsEnabled)
  const syncEnabled = usePreferencesStore((state) => state.syncNotificationsEnabled)
  const setEnabled = usePreferencesStore((state) => state.setSystemNotificationsEnabled)
  const setConnectionEnabled = usePreferencesStore((state) => state.setConnectionNotificationsEnabled)
  const setSyncEnabled = usePreferencesStore((state) => state.setSyncNotificationsEnabled)
  const [permission, setPermission] = useState<SystemNotificationPermission>('prompt')
  const [isRequesting, setIsRequesting] = useState(false)

  useEffect(() => {
    void getSystemNotificationPermission().then(setPermission).catch(() => setPermission('unsupported'))
  }, [])

  async function handleEnabledChange(nextEnabled: boolean) {
    if (!nextEnabled) {
      setEnabled(false)
      return
    }

    setIsRequesting(true)
    try {
      const nextPermission = await requestSystemNotificationPermission()
      setPermission(nextPermission)
      if (nextPermission !== 'granted') {
        setEnabled(false)
        toast.error(nextPermission === 'denied'
          ? 'Las notificaciones están bloqueadas en los ajustes del sistema o del navegador.'
          : 'Este dispositivo no permite notificaciones del sistema.')
        return
      }
      setEnabled(true)
      toast.success('Notificaciones del sistema activadas.')
    } catch {
      setEnabled(false)
      toast.error('No se pudo solicitar el permiso de notificaciones.')
    } finally {
      setIsRequesting(false)
    }
  }

  async function handleTest() {
    const shown = await showSystemNotification({
      title: 'Plata App',
      body: 'Las notificaciones están configuradas correctamente.',
      tag: 'plata-test',
      force: true,
    }).catch(() => false)

    if (!shown) toast.error('No se pudo mostrar la notificación de prueba.')
  }

  return (
    <Card className="border-graphite bg-surface shadow-vault">
      <CardHeader className="border-b border-graphite">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-xl text-on-surface">
              <AppIcon name="bell" className="size-5" />
              Notificaciones del sistema
            </CardTitle>
            <CardDescription>
              Recibe avisos en Windows y en la barra de notificaciones del teléfono aunque estés viendo otra pantalla.
            </CardDescription>
          </div>
          <Badge variant="secondary">{permissionLabels[permission]}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-graphite p-4">
          <Label htmlFor="system-notifications" className="flex min-w-0 flex-col gap-1">
            <span>Permitir notificaciones</span>
            <span className="text-xs font-normal text-muted-foreground">Activa o desactiva todos los avisos externos.</span>
          </Label>
          <Switch
            id="system-notifications"
            checked={enabled}
            disabled={isRequesting || permission === 'unsupported'}
            onCheckedChange={handleEnabledChange}
            aria-label="Permitir notificaciones del sistema"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-graphite p-4">
            <Label htmlFor="connection-notifications" className="flex min-w-0 flex-col gap-1">
              <span>Conexión</span>
              <span className="text-xs font-normal text-muted-foreground">Internet perdido y conexión recuperada.</span>
            </Label>
            <Switch
              id="connection-notifications"
              checked={connectionEnabled}
              disabled={!enabled}
              onCheckedChange={setConnectionEnabled}
              aria-label="Notificaciones de conexión"
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-graphite p-4">
            <Label htmlFor="sync-notifications" className="flex min-w-0 flex-col gap-1">
              <span>Sincronización</span>
              <span className="text-xs font-normal text-muted-foreground">Sincronización completada o interrumpida.</span>
            </Label>
            <Switch
              id="sync-notifications"
              checked={syncEnabled}
              disabled={!enabled}
              onCheckedChange={setSyncEnabled}
              aria-label="Notificaciones de sincronización"
            />
          </div>
        </div>

        <div>
          <Button variant="outline" size="sm" disabled={!enabled || permission !== 'granted'} onClick={handleTest}>
            Enviar notificación de prueba
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
