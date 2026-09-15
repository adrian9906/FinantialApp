import assert from 'node:assert/strict'
import { requestJson } from './api.ts'

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
let timerCallback: (() => void) | undefined
let duration = 0
let cleared = 0
globalThis.window = {
  localStorage: { getItem: () => 'test-token' },
  setTimeout: (callback: () => void, ms: number) => { timerCallback = callback; duration = ms; return 1 },
  clearTimeout: () => { cleared++ },
} as unknown as Window & typeof globalThis
try {
  globalThis.fetch = async (_url, init) => {
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-token')
    assert.equal(init?.signal?.aborted, false)
    return new Response(JSON.stringify({ url: 'https://example.com/photo.jpg' }), { status: 201 })
  }
  assert.deepEqual(await requestJson('/uploads/transaction-image', { method: 'POST' }, { timeoutMs: 60_000 }), { url: 'https://example.com/photo.jpg' })
  assert.equal(duration, 60_000, 'uploads allow more than the former 8-second deadline')
  await requestJson('/normal')
  assert.equal(duration, 8_000, 'ordinary queries keep their deadline')
  globalThis.fetch = async (_url, init) => {
    timerCallback?.()
    assert.equal(init?.signal?.aborted, true)
    throw new DOMException('Timed out', 'AbortError')
  }
  await assert.rejects(requestJson('/uploads/transaction-image', {}, { timeoutMs: 60_000 }), { name: 'AbortError' })
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'El almacenamiento de imágenes todavía no está configurado.' }), { status: 503 })
  await assert.rejects(requestJson('/uploads/transaction-image'), /todavía no está configurado/)
  assert.equal(cleared, 4, 'successful and failed requests both clear timers')
  console.log('Image upload requests: deadline, authentication, cancellation and server errors passed')
} finally {
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window
  else globalThis.window = originalWindow
}
