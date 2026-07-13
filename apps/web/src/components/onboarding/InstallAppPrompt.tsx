import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'plata-app:pwa-install-dismissed:v1'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
}

export function InstallAppPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(DISMISS_KEY) || isStandaloneMode()) return

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
      setHidden(false)
    }

    function handleInstalled() {
      setPromptEvent(null)
      setHidden(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function handleInstall() {
    if (!promptEvent) return

    await promptEvent.prompt()
    const choice = await promptEvent.userChoice

    if (choice.outcome !== 'accepted') {
      window.localStorage.setItem(DISMISS_KEY, '1')
    }

    setPromptEvent(null)
    setHidden(true)
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISS_KEY, '1')
    setHidden(true)
  }

  if (hidden || !promptEvent) {
    return null
  }

  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-primary/20 bg-[color:color-mix(in_srgb,var(--surface)_88%,white)] px-4 py-4 shadow-vault backdrop-blur">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-on-surface">Instala Plata App en este movil</p>
        <p className="mt-1 text-sm text-muted-gray">
          Te dara acceso rapido desde la pantalla principal y una experiencia mas estable en telefonos donde la APK no vaya fina.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" size="sm" className="rounded-xl" onClick={() => void handleInstall()}>
          <Download className="size-4" />
          Instalar
        </Button>
        <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={handleDismiss} aria-label="Cerrar aviso de instalacion">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}
