import { useEffect } from 'react'
import { NativeVoiceOverlay, supportsVoiceOverlay } from '@/lib/native-voice'
import { useVoiceStore } from '@/store/voiceStore'
import { useAuthStore } from '@/store/authStore'

export function NativeVoiceBridge() {
  const authMode = useAuthStore((state) => state.authMode)
  const checked = useAuthStore((state) => state.hasChecked)
  const userId = useAuthStore((state) => state.user?.id)
  useEffect(() => {
    if (!checked) return
    useVoiceStore.getState().clear()
    if (!supportsVoiceOverlay()) return
    if (authMode === 'anonymous') { void NativeVoiceOverlay.setEnabled({ enabled: false }).catch(() => {}); void NativeVoiceOverlay.closePanel().catch(() => {}); return }
    let cancelled = false
    const open = () => { if (!cancelled) useVoiceStore.getState().setCompact(true) }
    const listener = NativeVoiceOverlay.addListener('openVoicePanel', open)
    const close = () => { useVoiceStore.getState().setCompact(false); useVoiceStore.getState().setOpen(false) }
    window.addEventListener('plata-voice-closed', close)
    void listener.then(() => NativeVoiceOverlay.getStatus()).then((status) => { if (!cancelled && status.compact) open() }).catch(() => {})
    return () => { cancelled = true; window.removeEventListener('plata-voice-closed', close); void listener.then((handle) => handle.remove()).catch(() => {}) }
  }, [checked, authMode, userId])
  return null
}
