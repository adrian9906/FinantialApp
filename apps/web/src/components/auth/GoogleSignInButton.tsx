import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  isNativePlatform,
  signInWithGoogleNative,
  signInWithGoogleWeb,
  GoogleSignInCancelled,
} from '@/lib/google-signin'
import { useAuthStore } from '@/store/authStore'

interface GoogleSignInButtonProps {
  onError: (message: string) => void
  onSuccess?: () => void
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

/**
 * Uses the app's own Button so it matches the rest of the login screen.
 * Google's rendered widget cannot be restyled, so it is driven off-screen from
 * here (see signInWithGoogleWeb) instead of being shown directly.
 */
export function GoogleSignInButton({ onError, onSuccess }: GoogleSignInButtonProps) {
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle)
  const [isWorking, setIsWorking] = useState(false)

  async function handleSignIn() {
    setIsWorking(true)
    try {
      const idToken = isNativePlatform()
        ? await signInWithGoogleNative()
        : await signInWithGoogleWeb()

      await loginWithGoogle(idToken)
      onSuccess?.()
    } catch (error) {
      // Closing the popup is not a failure worth shouting about.
      if (error instanceof GoogleSignInCancelled) return
      onError(error instanceof Error ? error.message : 'No se pudo iniciar sesión con Google.')
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      loading={isWorking}
      onClick={() => void handleSignIn()}
      className="h-12 w-full gap-3 border-graphite bg-surface text-on-surface hover:bg-surface-container-high"
    >
      {isWorking ? null : <GoogleLogo />}
      Continuar con Google
    </Button>
  )
}
