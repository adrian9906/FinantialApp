import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { NativeWidgets, supportsNativeWidgets } from '@/lib/native-widgets'
import { useHomeWidgetSummary } from '@/lib/useHomeWidgetSummary'
import { useAuthStore } from '@/store/authStore'
export function NativeWidgetBridge() {
  const summary = useHomeWidgetSummary()
  const authMode = useAuthStore((state) => state.authMode)
  const hasChecked = useAuthStore((state) => state.hasChecked)
  const userId = useAuthStore((state) => state.user?.id)
  const navigate = useNavigate()
  useEffect(() => {
    if (!supportsNativeWidgets() || !hasChecked) return
    if (authMode === 'anonymous') { void NativeWidgets.clearSummary().catch(() => {}); return }
    const timer = window.setTimeout(() => { void NativeWidgets.updateSummary(summary).catch(() => {}) }, 250)
    return () => clearTimeout(timer)
  }, [summary, authMode, hasChecked, userId])
  useEffect(() => {
    if (!supportsNativeWidgets() || !hasChecked || authMode === 'anonymous') return
    let cancelled = false
    const consume = async () => {
      const { action } = await NativeWidgets.getLaunchAction()
      if (cancelled || !action) return
      if (action === 'add-expense') navigate(`/expenses?add=${Date.now()}`)
      else if (action === 'dashboard') navigate('/')
    }
    const listener = NativeWidgets.addListener('launchAction', () => { void consume().catch(() => {}) })
    void listener.then(() => consume()).catch(() => {})
    return () => { cancelled = true; void listener.then((handle) => handle.remove()).catch(() => {}) }
  }, [hasChecked, authMode, navigate])
  return null
}
