import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NativeVoiceOverlay, supportsVoiceOverlay } from '@/lib/native-voice'
import { requestSystemNotificationPermission } from '@/lib/system-notifications'
import { useVoiceStore } from '@/store/voiceStore'

export function VoiceSettings() {
  const { enabled, setEnabled, language, setLanguage } = useVoiceStore()
  const supported = supportsVoiceOverlay()
  const [status, setStatus] = useState({ enabled: false, permitted: false })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!supported) return
    const refresh = () => { void NativeVoiceOverlay.getStatus().then(setStatus).catch(() => {}) }
    refresh(); window.addEventListener('focus', refresh)
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', visible)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible) }
  }, [supported])
  async function toggleExternal() {
    setBusy(true)
    try {
      const current = await NativeVoiceOverlay.getStatus()
      if (!current.enabled && !current.permitted) { await NativeVoiceOverlay.requestPermission(); toast.info('Permite mostrar Plata sobre otras aplicaciones y vuelve para activar la burbuja.'); return }
      if (!current.enabled && await requestSystemNotificationPermission() !== 'granted') { toast.error('Permite las notificaciones para controlar la burbuja.'); return }
      await NativeVoiceOverlay.setEnabled({ enabled: !current.enabled })
      setStatus(await NativeVoiceOverlay.getStatus())
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cambiar la burbuja.') }
    finally { setBusy(false) }
  }
  return <Card><CardHeader><CardTitle>Asistente de voz</CardTitle><CardDescription>Dicta varios gastos y gustos, revisa los borradores y guarda con un toque.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">
    <Checkbox checked={enabled} onCheckedChange={setEnabled}>Mostrar micrófono flotante dentro de Plata</Checkbox>
    <Field><FieldLabel htmlFor="voice-language">Idioma del dictado</FieldLabel><Select value={language} onValueChange={(value) => { if (value) setLanguage(value) }}><SelectTrigger id="voice-language" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="es-ES">Español · España</SelectItem><SelectItem value="es-MX">Español · México</SelectItem><SelectItem value="es-US">Español · Estados Unidos</SelectItem><SelectItem value="es-CU">Español · Cuba</SelectItem></SelectGroup></SelectContent></Select></Field>
    <Button variant="outline" className="h-auto min-h-10 whitespace-normal py-2" disabled={!supported || busy} onClick={() => { void toggleExternal() }}>{status.enabled ? 'Desactivar burbuja sobre otras apps' : status.permitted ? 'Activar burbuja sobre otras apps' : 'Permitir burbuja sobre otras apps'}</Button>
    {!supported && <p className="text-sm text-muted-foreground">La burbuja externa requiere la APK Android con esta función.</p>}
    <p className="text-xs text-muted-foreground">Sin API de IA. El reconocimiento del teléfono puede necesitar internet y un idioma instalado. El micrófono solo se activa al tocar Dictar; los movimientos empiezan como pendientes.</p>
  </CardContent></Card>
}
