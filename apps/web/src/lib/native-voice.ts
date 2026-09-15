import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

interface PlataVoicePlugin {
  available(): Promise<{ available: boolean }>
  start(options: { language: string }): Promise<void>
  stop(): Promise<void>
  cancel(): Promise<void>
  addListener(event: 'voiceResult', callback: (result: { text: string; final: boolean; error?: string }) => void): Promise<PluginListenerHandle>
}
interface PlataOverlayPlugin {
  getStatus(): Promise<{ enabled: boolean; permitted: boolean; compact: boolean }>
  requestPermission(): Promise<void>
  setEnabled(options: { enabled: boolean }): Promise<void>
  closePanel(): Promise<void>
  addListener(event: 'openVoicePanel', callback: () => void): Promise<PluginListenerHandle>
}
export const NativeVoice = registerPlugin<PlataVoicePlugin>('PlataVoice')
export const NativeVoiceOverlay = registerPlugin<PlataOverlayPlugin>('PlataVoiceOverlay')
export const supportsVoiceOverlay = () => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('PlataVoiceOverlay')
export const supportsNativeVoice = () => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('PlataVoice')

interface BrowserRecognition {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void; abort(): void
}
type VoiceWindow = Window & { SpeechRecognition?: new () => BrowserRecognition; webkitSpeechRecognition?: new () => BrowserRecognition }
export async function startVoiceRecognition(language: string, onResult: (text: string, final: boolean) => void, onError: (error: string) => void): Promise<{ stop: () => void; cancel: () => void }> {
  if (supportsNativeVoice()) {
    if (!await NativeVoice.available().then((result) => result.available)) throw new Error('El teléfono no tiene reconocimiento de voz disponible.')
    let closed = false
    const remove = async () => { if (!closed) { closed = true; await listener.remove() } }
    const listener = await NativeVoice.addListener('voiceResult', (result) => {
      if (closed) return
      if (result.error) { onError(result.error); void remove() }
      else { onResult(result.text, result.final); if (result.final) void remove() }
    })
    try { await NativeVoice.start({ language }) }
    catch (error) { await remove(); throw error }
    return { stop: () => { void NativeVoice.stop().catch(() => { onError('No se pudo detener el dictado.'); void remove() }) }, cancel: () => { void remove(); void NativeVoice.cancel().catch(() => {}) } }
  }
  const voiceWindow = window as VoiceWindow
  const Constructor = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition
  if (!Constructor) throw new Error('Este navegador no admite dictado. Puedes escribir la frase.')
  const recognition = new Constructor()
  recognition.lang = language; recognition.continuous = false; recognition.interimResults = true
  let closed = false, finalReceived = false
  recognition.onresult = (event) => {
    if (closed) return
    for (let index = event.resultIndex; index < event.results.length; index++) {
      const result = event.results[index]
      onResult(result[0].transcript, result.isFinal)
      if (result.isFinal) { finalReceived = true; closed = true; recognition.stop() }
    }
  }
  recognition.onerror = (event) => { if (!closed) { closed = true; onError(event.error === 'not-allowed' ? 'Permite el micrófono para dictar.' : 'No se pudo reconocer la voz. Reintenta o escribe.'); } }
  recognition.onend = () => { if (!closed && !finalReceived) { closed = true; onError('No se recibió un dictado. Reintenta o escribe.') } }
  recognition.start()
  return { stop: () => recognition.stop(), cancel: () => { closed = true; recognition.abort() } }
}
