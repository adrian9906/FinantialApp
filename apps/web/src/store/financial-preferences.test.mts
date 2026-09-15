import assert from 'node:assert/strict'
import { defaultFormula, getFormulaBudgets } from '@plata/shared'
import { mergeCurrencyPreferences } from '../../../api/src/api.ts'

const originalWindow = globalThis.window
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const originalFetch = globalThis.fetch
const entries = new Map<string, string>()
const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value), removeItem: (key: string) => entries.delete(key) }
globalThis.window = { localStorage: storage, setTimeout, clearTimeout } as unknown as Window & typeof globalThis
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
const usd = { code: 'USD', name: 'USD', country: '', locale: 'en-US', exchangeRate: 1 }
const cup = { code: 'CUP', name: 'CUP', country: 'Cuba', locale: 'es-CU', exchangeRate: 350 }
const formula = { expenses: 37.5, wants: 0, savings: 62.5, rolloverSavings: false }
const otherFormula = { expenses: 60, wants: 15, savings: 25, rolloverSavings: true }
let server = { exists: true, currencies: [usd, cup], activeCurrencyCode: 'CUP', accountSavingsFormulas: { source1: formula } as Record<string, typeof formula>, formula }
const patches: Record<string, unknown>[] = []
let releaseRead!: () => void
let releaseWrite: (() => void) | undefined
let readGate: Promise<void> | undefined = new Promise((resolve) => { releaseRead = resolve })
let writeGate: Promise<void> | undefined
let writeStarted: (() => void) | undefined
let rejectWrite = false
globalThis.fetch = async (_url, init) => {
  if (init?.method === 'PUT') {
    const patch = JSON.parse(String(init.body))
    patches.push(patch)
    writeStarted?.()
    if (writeGate) await writeGate
    if (rejectWrite) return new Response(JSON.stringify({ error: 'Sin conexión al servidor' }), { status: 503 })
    server = mergeCurrencyPreferences(server, patch) as typeof server
  } else if (readGate) await readGate
  return new Response(JSON.stringify(server))
}

try {
  const { useAuthStore } = await import('./authStore.ts')
  const { usePreferencesStore } = await import('./preferencesStore.ts')
  const { ensureCurrencyPreference, convertToUsd, convertFromUsd } = await import('../lib/currency.ts')
  useAuthStore.setState({ authMode: 'authenticated', user: { id: 'user1', name: 'Test', email: 'test@example.com' } })
  const firstLoad = usePreferencesStore.getState().hydrateCurrencyPreferences('user1')
  ensureCurrencyPreference('CUP')
  releaseRead(); readGate = undefined
  await firstLoad
  assert.deepEqual(usePreferencesStore.getState().formula, formula)
  assert.deepEqual(usePreferencesStore.getState().accountSavingsFormulas, { source1: formula })
  const loadedCup = usePreferencesStore.getState().currencies.find((entry) => entry.code === 'CUP')!
  assert.equal(loadedCup.exchangeRate, 350)
  assert.ok(patches.every((patch) => !('accountSavingsFormulas' in patch) && !('formula' in patch)), 'detectar CUP no envía mapas ni fórmula locales')
  assert.equal(convertToUsd(3500, loadedCup), 10)
  assert.equal(convertFromUsd(getFormulaBudgets(10, formula).expenses, loadedCup), 1312.5)

  usePreferencesStore.getState().setFormula(defaultFormula)
  await usePreferencesStore.getState().syncCurrencyPreferences()
  assert.deepEqual(server.formula, defaultFormula)
  assert.deepEqual(server.accountSavingsFormulas.source1, formula)
  assert.deepEqual(patches.at(-1), { formula: defaultFormula })

  // Two edits while the first acknowledgement is pending must both survive.
  writeGate = new Promise((resolve) => { releaseWrite = resolve })
  const writing = new Promise<void>((resolve) => { writeStarted = resolve })
  usePreferencesStore.getState().setAccountFormula('source1', otherFormula)
  const sync = usePreferencesStore.getState().syncCurrencyPreferences()
  await writing
  usePreferencesStore.getState().setAccountFormula('source2', defaultFormula)
  releaseWrite!(); writeGate = undefined; writeStarted = undefined
  await sync
  assert.deepEqual(server.accountSavingsFormulas, { source1: otherFormula, source2: defaultFormula })
  assert.equal(entries.has('plata-financial-preferences-pending:user1'), false)

  server.formula = otherFormula
  await usePreferencesStore.getState().hydrateCurrencyPreferences('user1')
  assert.deepEqual(usePreferencesStore.getState().formula, otherFormula, 'recargar obtiene la fórmula cambiada en otro dispositivo')

  rejectWrite = true
  usePreferencesStore.getState().setAccountFormula('source1', formula)
  await assert.rejects(usePreferencesStore.getState().syncCurrencyPreferences())
  assert.ok(entries.has('plata-financial-preferences-pending:user1'))
  assert.deepEqual(usePreferencesStore.getState().accountSavingsFormulas.source1, formula)
  rejectWrite = false
  await usePreferencesStore.getState().hydrateCurrencyPreferences('user1')
  assert.deepEqual(server.accountSavingsFormulas.source1, formula)
  assert.equal(entries.has('plata-financial-preferences-pending:user1'), false)

  const savedUser1 = structuredClone(server)
  server = { exists: true, currencies: [usd], activeCurrencyCode: 'USD', accountSavingsFormulas: {}, formula: otherFormula }
  useAuthStore.setState({ user: { id: 'user2', name: 'Other', email: 'other@example.com' } })
  await usePreferencesStore.getState().hydrateCurrencyPreferences('user2')
  assert.deepEqual(usePreferencesStore.getState().accountSavingsFormulas, {})
  assert.ok(!usePreferencesStore.getState().currencies.some((entry) => entry.code === 'CUP'))
  server = savedUser1
  useAuthStore.setState({ user: { id: 'user1', name: 'Test', email: 'test@example.com' } })
  await usePreferencesStore.getState().hydrateCurrencyPreferences('user1')
  assert.deepEqual(usePreferencesStore.getState().accountSavingsFormulas, savedUser1.accountSavingsFormulas)
  assert.equal(usePreferencesStore.getState().currencies.find((entry) => entry.code === 'CUP')?.exchangeRate, 350)
  console.log('Cliente preferencias: CUP al iniciar, fórmula BD, cambios simultáneos, recuperación y aislamiento de usuarios correctos')
} finally {
  globalThis.window = originalWindow
  globalThis.fetch = originalFetch
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}
