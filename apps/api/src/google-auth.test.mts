// Google sign-in must never trust the client. These checks cover the rules
// that decide whether a token becomes a session.
import { strict as assert } from 'node:assert'

import { verifyGoogleIdToken } from './google-auth.ts'
import { verifyPassword } from './auth.ts'

// --- Garbage tokens are rejected without configuration ---
{
  delete process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_ANDROID_CLIENT_ID
  delete process.env.GOOGLE_IOS_CLIENT_ID

  for (const value of ['', 'not-a-token', 'a.b.c', null, undefined, 42, {}]) {
    assert.equal(await verifyGoogleIdToken(value), null, `debe rechazar: ${String(value)}`)
  }
  console.log('PASS 1: sin configuracion, ningun token es valido')
}

// --- A forged token is rejected even when a client id is set ---
{
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'

  // A syntactically valid JWT claiming to be someone, but unsigned by Google.
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://accounts.google.com',
    aud: 'test-client-id.apps.googleusercontent.com',
    sub: '1234567890',
    email: 'victima@gmail.com',
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url')

  const forged = `${header}.${payload}.`
  assert.equal(await verifyGoogleIdToken(forged), null, 'un token sin firma valida debe rechazarse')

  const fakeSignature = `${header}.${payload}.ZmFrZS1zaWduYXR1cmU`
  assert.equal(await verifyGoogleIdToken(fakeSignature), null, 'una firma falsa debe rechazarse')
  console.log('PASS 2: un token falsificado se rechaza (firma invalida)')
}

// --- Oversized input is refused before any network work ---
{
  assert.equal(await verifyGoogleIdToken('x'.repeat(9000)), null, 'entrada enorme debe rechazarse')
  console.log('PASS 3: entradas desmedidas se rechazan')
}

// --- A Google-only account cannot be entered with a password ---
{
  assert.equal(verifyPassword('', null), false, 'contrasena vacia contra hash nulo debe fallar')
  assert.equal(verifyPassword('cualquier-cosa', null), false, 'sin hash no se autentica')
  assert.equal(verifyPassword('cualquier-cosa', undefined), false, 'hash indefinido no autentica')
  assert.equal(verifyPassword('', ''), false, 'hash vacio no autentica')
  console.log('PASS 4: una cuenta de Google no se puede abrir con contrasena')
}

console.log('\nSeguridad del acceso con Google correcta.')
