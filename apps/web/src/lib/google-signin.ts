import { Capacitor } from '@capacitor/core'

/**
 * Obtains a Google ID token.
 *
 * Two paths, because Google blocks OAuth inside Android/iOS WebViews: the web
 * uses Google Identity Services, and the packaged app uses the native plugin.
 * Both return the same kind of ID token, which the API verifies server-side —
 * nothing here is trusted on its own.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client'

export function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
}

export function isGoogleSignInAvailable() {
  return getGoogleClientId().length > 0
}

export class GoogleSignInCancelled extends Error {}

interface GoogleCredentialResponse {
  credential?: string
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
  }) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
  prompt: () => void
  cancel: () => void
}

function getGoogleAccounts(): { id: GoogleAccountsId } | null {
  const google = (window as unknown as { google?: { accounts?: { id?: GoogleAccountsId } } }).google
  return google?.accounts?.id ? { id: google.accounts.id } : null
}

let scriptPromise: Promise<boolean> | null = null

function loadGoogleScript(): Promise<boolean> {
  if (getGoogleAccounts()) return Promise.resolve(true)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(getGoogleAccounts())))
      existing.addEventListener('error', () => resolve(false))
      return
    }

    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve(Boolean(getGoogleAccounts()))
    script.onerror = () => resolve(false)
    document.head.append(script)
  })

  return scriptPromise
}

/** Renders Google's own button, which is required by their branding rules. */
export async function renderGoogleButton(
  container: HTMLElement,
  onToken: (idToken: string) => void,
): Promise<boolean> {
  if (!isGoogleSignInAvailable()) return false
  const loaded = await loadGoogleScript()
  const accounts = getGoogleAccounts()
  if (!loaded || !accounts) return false

  accounts.id.initialize({
    client_id: getGoogleClientId(),
    callback: (response) => {
      if (response.credential) onToken(response.credential)
    },
  })

  container.replaceChildren()
  accounts.id.renderButton(container, {
    theme: 'filled_black',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    width: container.clientWidth || 320,
  })

  return true
}

/** Native sign-in for the Capacitor build. */
export async function signInWithGoogleNative(): Promise<string> {
  const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth')

  await GoogleAuth.initialize({
    clientId: getGoogleClientId(),
    scopes: ['profile', 'email'],
    grantOfflineAccess: false,
  })

  const user = await GoogleAuth.signIn()
  const idToken = user?.authentication?.idToken
  if (!idToken) throw new GoogleSignInCancelled('No se obtuvo el token de Google.')
  return idToken
}

export function isNativePlatform() {
  return Capacitor.isNativePlatform()
}
