import { Capacitor } from '@capacitor/core'

import { requestJson } from '@/lib/api'

/**
 * Obtains a Google ID token.
 *
 * Two paths, because Google blocks OAuth inside Android/iOS WebViews: the web
 * uses Google Identity Services, and the packaged app uses the native plugin.
 * Both return the same kind of ID token, which the API verifies server-side —
 * nothing here is trusted on its own.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client'
let runtimeGoogleClientId = ''

export function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || runtimeGoogleClientId
}

async function resolveGoogleClientId() {
  const bundledClientId = getGoogleClientId()
  if (bundledClientId) return bundledClientId

  try {
    const response = await requestJson<{ clientId: string }>('/auth/google/config')
    runtimeGoogleClientId = response.clientId?.trim() ?? ''
  } catch {
    runtimeGoogleClientId = ''
  }

  return runtimeGoogleClientId
}

export class GoogleSignInCancelled extends Error {}

interface GoogleCredentialResponse {
  credential?: string
}

interface GoogleAccountsOauth2 {
  initTokenClient: (config: Record<string, unknown>) => { requestAccessToken: () => void }
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    use_fedcm_for_prompt?: boolean
    ux_mode?: string
  }) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
  prompt: () => void
  cancel: () => void
}

function getGoogleAccounts(): { id: GoogleAccountsId; oauth2?: GoogleAccountsOauth2 } | null {
  const google = (window as unknown as {
    google?: { accounts?: { id?: GoogleAccountsId; oauth2?: GoogleAccountsOauth2 } }
  }).google
  return google?.accounts?.id ? { id: google.accounts.id, oauth2: google.accounts.oauth2 } : null
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

/**
 * Opens Google's account chooser and resolves with an ID token.
 *
 * Google's own rendered button cannot be restyled, so this drives the same
 * flow from our button instead: the hidden widget is rendered off-screen and
 * clicked programmatically, which keeps a real user gesture behind the popup
 * (Google requires one) while the visible button is entirely ours.
 */
export async function signInWithGoogleWeb(): Promise<string> {
  const clientId = await resolveGoogleClientId()
  if (!clientId) {
    throw new Error('El acceso con Google no está configurado en producción.')
  }

  return new Promise((resolve, reject) => {
    void loadGoogleScript().then((loaded) => {
      const accounts = getGoogleAccounts()
      if (!loaded || !accounts) {
        reject(new Error('No se pudo cargar el acceso con Google.'))
        return
      }

      let settled = false

      accounts.id.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        callback: (response) => {
          if (settled) return
          settled = true
          host.remove()
          if (response.credential) resolve(response.credential)
          else reject(new GoogleSignInCancelled('Inicio de sesión cancelado.'))
        },
      })

      // Off-screen host for Google's widget: never visible, only clicked.
      const host = document.createElement('div')
      host.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;pointer-events:none;'
      document.body.append(host)

      accounts.id.renderButton(host, { type: 'standard', size: 'large' })

      const trigger = host.querySelector<HTMLElement>('div[role="button"]')
        ?? host.querySelector<HTMLElement>('div')
      if (!trigger) {
        host.remove()
        reject(new Error('No se pudo iniciar el acceso con Google.'))
        return
      }

      trigger.click()

      // The popup gives no "closed" event; clean up if nothing comes back.
      window.setTimeout(() => {
        if (settled) return
        settled = true
        host.remove()
        reject(new GoogleSignInCancelled('Inicio de sesión cancelado.'))
      }, 120000)
    })
  })
}

/** Native sign-in for the Capacitor build. */
export async function signInWithGoogleNative(): Promise<string> {
  const [{ GoogleAuth }, clientId] = await Promise.all([
    import('@codetrix-studio/capacitor-google-auth'),
    resolveGoogleClientId(),
  ])
  if (!clientId) {
    throw new Error('El acceso con Google no está configurado en producción.')
  }

  await GoogleAuth.initialize({
    clientId,
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
