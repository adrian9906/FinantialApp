import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { NativeWidgets, supportsNativeWidgets } from '@/lib/native-widgets'
import { useHomeWidgetSummary } from '@/lib/useHomeWidgetSummary'
import { useAuthStore } from '@/store/authStore'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'
export function NativeWidgetBridge() {
  const summary = useHomeWidgetSummary()
  const authMode = useAuthStore((state) => state.authMode)
  const hasChecked = useAuthStore((state) => state.hasChecked)
  const userId = useAuthStore((state) => state.user?.id)
  const hasLoaded = useFinanceStore((state) => state.hasLoaded)
  const loadedKey = useFinanceStore((state) => state.loadedKey)
  const navigate = useNavigate()
  const setActiveCurrency = usePreferencesStore((state) => state.setActiveCurrency)
  const setActiveIncomeSource = usePreferencesStore((state) => state.setActiveIncomeSource)
  useEffect(() => {
    if (!supportsNativeWidgets() || !hasChecked) return
    if (authMode === 'anonymous') { void NativeWidgets.clearSummary().catch(() => {}); return }
    if (!hasLoaded || loadedKey !== (authMode === 'guest' ? 'guest' : `user:${userId}`)) return
    const timer = window.setTimeout(() => { void NativeWidgets.updateSummary(summary).catch(() => {}) }, 250)
    return () => clearTimeout(timer)
  }, [summary, authMode, hasChecked, hasLoaded, loadedKey, userId])
  useEffect(() => {
    if (!supportsNativeWidgets() || !hasChecked || authMode === 'anonymous'
      || !hasLoaded || loadedKey !== (authMode === 'guest' ? 'guest' : `user:${userId}`)) return
    const consumeSelection = async () => {
      if (document.visibilityState === 'hidden') return
      const selection = await NativeWidgets.getSelection()
      if (!selection.changed) return
      const preferences = usePreferencesStore.getState()
      if (preferences.activeCurrencyCode !== selection.currencyCode) setActiveCurrency(selection.currencyCode)
      if (preferences.activeIncomeSourceId !== selection.accountId) setActiveIncomeSource(selection.accountId)
    }
    void consumeSelection().catch(() => {})
    window.addEventListener('focus', consumeSelection)
    document.addEventListener('visibilitychange', consumeSelection)
    return () => {
      window.removeEventListener('focus', consumeSelection)
      document.removeEventListener('visibilitychange', consumeSelection)
    }
  }, [hasChecked, authMode, hasLoaded, loadedKey, userId, setActiveCurrency, setActiveIncomeSource])
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
