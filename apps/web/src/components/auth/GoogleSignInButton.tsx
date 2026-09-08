import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  isGoogleSignInAvailable,
  isNativePlatform,
  renderGoogleButton,
  signInWithGoogleNative,
} from '@/lib/google-signin'
import { useAuthStore } from '@/store/authStore'

interface GoogleSignInButtonProps {
  onError: (message: string) => void
  onSuccess?: () => void
}

/**
 * Google sign-in entry point. On the web it renders Google's own button (their
 * branding rules require it); inside the Capacitor app it falls back to the
 * native flow, since Google blocks OAuth in WebViews.
 */
export function GoogleSignInButton({ onError, onSuccess }: GoogleSignInButtonProps) {
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [webButtonReady, setWebButtonReady] = useState(false)

  const available = isGoogleSignInAvailable()
  const native = isNativePlatform()

  useEffect(() => {
    if (!available || native) return

    let active = true
    const container = containerRef.current
    if (!container) return

    void renderGoogleButton(container, (idToken) => {
      if (!active) return
      void loginWithGoogle(idToken)
        .then(() => onSuccess?.())
        .catch(() => onError('No se pudo iniciar sesión con Google.'))
    }).then((ready) => {
      if (active) setWebButtonReady(ready)
    })

    return () => {
      active = false
    }
  }, [available, loginWithGoogle, native, onError, onSuccess])

  if (!available) return null

  async function handleNativeSignIn() {
    setIsWorking(true)
    try {
      const idToken = await signInWithGoogleNative()
      await loginWithGoogle(idToken)
      onSuccess?.()
    } catch {
      // A cancelled sign-in and a failed one look the same to the user here.
      onError('No se pudo iniciar sesión con Google.')
    } finally {
      setIsWorking(false)
    }
  }

  if (native) {
    return (
      <Button
        type="button"
        variant="outline"
        loading={isWorking}
        onClick={() => void handleNativeSignIn()}
        className="w-full border-graphite"
      >
        Continuar con Google
      </Button>
    )
  }

  return (
    <div className="w-full">
      <div ref={containerRef} className="flex w-full justify-center [&>div]:w-full" />
      {!webButtonReady ? (
        <p className="text-center text-xs text-muted-gray">
          No se pudo cargar el acceso con Google.
        </p>
      ) : null}
    </div>
  )
}
