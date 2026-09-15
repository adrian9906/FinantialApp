import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeWidgets, supportsNativeWidgets } from '@/lib/native-widgets'
import { requestSystemNotificationPermission } from '@/lib/system-notifications'
import { useHomeWidgetSummary } from '@/lib/useHomeWidgetSummary'

export function MobileWidgetSettings() {
  const summary = useHomeWidgetSummary()
  const supported = supportsNativeWidgets()
  const [notificationEnabled, setNotificationEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (supported) void NativeWidgets.getStatus().then((status) => setNotificationEnabled(status.notificationEnabled)).catch(() => {})
  }, [supported])
  async function pin() {
    setBusy(true)
    try {
      await NativeWidgets.updateSummary(summary)
      const { requested } = await NativeWidgets.pinWidget()
      toast.info(requested ? 'Confirma con Android para añadir el widget.' : 'Mantén pulsada la pantalla de inicio, abre Widgets y busca Plata App.')
    } catch { toast.error('No se pudo añadir el widget.') }
    finally { setBusy(false) }
  }
  async function toggleNotification() {
    setBusy(true)
    try {
      if (!notificationEnabled && await requestSystemNotificationPermission() !== 'granted') {
        toast.error('Permite las notificaciones en los ajustes del teléfono.'); return
      }
      await NativeWidgets.updateSummary(summary)
      await NativeWidgets.setNotificationEnabled({ enabled: !notificationEnabled })
      setNotificationEnabled(!notificationEnabled)
    } catch { toast.error('No se pudieron cambiar los accesos en notificaciones.') }
    finally { setBusy(false) }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Widgets y accesos del móvil</CardTitle><CardDescription>Tu cuenta seleccionada, a un toque desde la pantalla de inicio.</CardDescription></CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-graphite bg-surface p-4">
          <p className="text-sm font-semibold text-on-surface">Plata App · {summary.accountName}</p>
          <div className="grid min-w-0 grid-cols-2 gap-3">
            <div><p className="text-xs text-muted-gray">Saldo disponible</p><p className="break-all text-lg font-semibold text-on-surface">{summary.hasAccount ? summary.balance : '—'}</p></div>
            <div><p className="text-xs text-muted-gray">Gastos de hoy</p><p className="break-all text-lg font-semibold text-on-surface">{summary.hasAccount ? summary.todayExpenses : '—'}</p></div>
          </div>
          <p className="text-xs text-muted-gray">Última actualización: {summary.updatedLabel}</p>
        </div>
        <p className="text-sm text-muted-gray">Se actualiza al usar o sincronizar la app. Los accesos abren el formulario para añadir un gasto.</p>
        {!supported && <p className="text-sm text-muted-gray">Disponible al instalar la APK Android que incluye esta función.</p>}
        <div className="flex flex-wrap gap-2">
          <Button className="h-auto min-h-10 w-full whitespace-normal py-2 sm:w-auto" onClick={() => { void pin() }} disabled={!supported || busy || !summary.hasAccount}>Añadir widget a inicio</Button>
          <Button className="h-auto min-h-10 w-full whitespace-normal py-2 sm:w-auto" variant="outline" onClick={() => { void toggleNotification() }} disabled={!supported || busy || (!notificationEnabled && !summary.hasAccount)} aria-pressed={notificationEnabled}>
            {notificationEnabled ? 'Desactivar accesos en notificaciones' : 'Activar accesos en notificaciones'}
          </Button>
        </div>
        <p className="text-xs text-muted-gray">Android puede permitirte descartar la notificación. El widget sigue disponible en la pantalla de inicio.</p>
      </CardContent>
    </Card>
  )
}
