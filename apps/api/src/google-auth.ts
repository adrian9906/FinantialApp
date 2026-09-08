import { OAuth2Client } from 'google-auth-library'

/**
 * Verification of Google ID tokens.
 *
 * An ID token is just a signed string until it is checked, so nothing here
 * trusts its contents: the library validates the RSA signature against Google's
 * published keys, the issuer, the expiry, and — critically — that the audience
 * is one of OUR client IDs. Without the audience check, a token minted for any
 * other Google app would be accepted and could impersonate a user.
 */

/** Web client plus, optionally, the Android/iOS clients used by Capacitor. */
function getAllowedAudiences() {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ].filter((value): value is string => Boolean(value && value.trim()))
}

export function isGoogleAuthConfigured() {
  return getAllowedAudiences().length > 0
}

export interface GoogleIdentity {
  googleId: string
  email: string
  name: string
  emailVerified: boolean
}

const client = new OAuth2Client()

/**
 * Returns the identity carried by a valid token, or null when the token is
 * missing, malformed, expired, signed by someone else, or issued for another
 * application. Callers must treat null as "not authenticated".
 */
export async function verifyGoogleIdToken(idToken: unknown): Promise<GoogleIdentity | null> {
  if (typeof idToken !== 'string' || idToken.length === 0 || idToken.length > 8192) return null

  const audience = getAllowedAudiences()
  if (audience.length === 0) return null

  try {
    const ticket = await client.verifyIdToken({ idToken, audience })
    const payload = ticket.getPayload()
    if (!payload) return null

    // verifyIdToken already checks signature, expiry and audience; the issuer
    // is asserted here as well because it is cheap and unambiguous.
    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      return null
    }

    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    if (!email || !payload.sub) return null

    return {
      googleId: payload.sub,
      email,
      name: (typeof payload.name === 'string' && payload.name.trim()) || email.split('@')[0],
      emailVerified: payload.email_verified === true,
    }
  } catch {
    // Any verification failure is an authentication failure.
    return null
  }
}
