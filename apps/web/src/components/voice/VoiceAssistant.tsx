import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Mic, Square, Trash2, Minus, Check, AudioLines } from 'lucide-react'
import { toast } from 'sonner'
import { buildExpenseDescription, buildWantDescription } from '@plata/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useVoiceStore } from '@/store/voiceStore'
import { useFinanceStore } from '@/store/financeStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { useAuthStore } from '@/store/authStore'
import { useActiveIncomeAccount } from '@/lib/useActiveIncomeAccount'
import { getTodayDateKey } from '@/lib/date'
import { convertToUsd, getCurrencyByCode } from '@/lib/currency'
import { NativeVoice, NativeVoiceOverlay, startVoiceRecognition, supportsNativeVoice } from '@/lib/native-voice'
import { isVoiceExpenseCategory, isVoiceWantCategory, parseVoiceMovements, type VoiceMovementDraft } from '@/lib/voice-parser'

const expenseCategories = [{ value: 'food', label: 'Alimentación' }, { value: 'home', label: 'Hogar' }, { value: 'services', label: 'Servicios' }, { value: 'gym', label: 'Deporte' }, { value: 'health', label: 'Salud' }, { value: 'essentials', label: 'Esenciales' }]
const wantCategories = [{ value: 'outings', label: 'Salidas' }, { value: 'shopping', label: 'Compras' }, { value: 'gaming', label: 'Videojuegos' }, { value: 'subscriptions', label: 'Suscripciones' }, { value: 'selfcare', label: 'Cuidado personal' }]
function Choice({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel><Select value={value || null} onValueChange={(next) => onChange(next ?? '')}><SelectTrigger id={id} className="w-full"><SelectValue>{options.find((option) => option.value === value)?.label ?? 'Seleccionar'}</SelectValue></SelectTrigger><SelectContent><SelectGroup>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
}
function subscribeViewport(callback: () => void) { window.addEventListener('resize', callback); return () => window.removeEventListener('resize', callback) }
const getViewport = () => `${window.innerWidth}:${window.innerHeight}`

export function VoiceAssistant() {
  const voice = useVoiceStore()
  const finance = useFinanceStore()
  const preferences = usePreferencesStore()
  const { activeAccount, allAccounts } = useActiveIncomeAccount()
  const authMode = useAuthStore((state) => state.authMode)
  const userId = useAuthStore((state) => state.user?.id)
  const viewport = useSyncExternalStore(subscribeViewport, getViewport, () => '375:812')
  const [width, height] = viewport.split(':').map(Number)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const recording = useRef<{ stop: () => void; cancel: () => void } | null>(null)
  const generation = useRef(0)
  const saving = useRef(false)
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null)
  const blockClick = useRef(false)
  const bubbleX = Math.min(Math.max(12, voice.position?.x ?? width - 76), Math.max(12, width - 68))
  const bubbleY = Math.min(Math.max(80, voice.position?.y ?? height - 96), Math.max(80, height - 96))
  const profileId = authMode === 'guest' ? 'guest' : userId ?? 'guest'
  const accountOptions = allAccounts.map((account) => ({ value: account.source.id, label: account.source.name }))

  function stopRecording() { generation.current++; recording.current?.cancel(); recording.current = null; if (supportsNativeVoice()) void NativeVoice.cancel().catch(() => {}); setListening(false) }
  useEffect(() => {
    if (!voice.open) return
    const visibility = () => { if (document.visibilityState !== 'visible') { generation.current++; recording.current?.cancel(); recording.current = null; setListening(false) } }
    document.addEventListener('visibilitychange', visibility)
    const generationRef = generation
    const recordingRef = recording
    return () => { document.removeEventListener('visibilitychange', visibility); generationRef.current++; recordingRef.current?.cancel(); recordingRef.current = null }
  }, [voice.open])
  function interpret(input: string) {
    const parsed = parseVoiceMovements(input, {
      today: getTodayDateKey(), accountId: activeAccount?.source.id ?? '', currencyCode: activeAccount?.salary.currencyCode ?? activeAccount?.source.currencyCode ?? preferences.activeCurrencyCode,
      accounts: allAccounts.map((account) => ({ id: account.source.id, name: account.source.name, currencyCode: account.salary.currencyCode ?? account.source.currencyCode ?? 'USD' })),
      currencyCodes: preferences.currencies.map((currency) => currency.code), rules: preferences.categoryRulesByProfile[profileId] ?? [],
    })
    if (!parsed.length) { setError('Di o escribe al menos un movimiento.'); return }
    voice.setDrafts([...useVoiceStore.getState().drafts, ...parsed]); setText(''); setError('')
  }
  async function dictate() {
    if (listening || saving.current) return
    stopRecording(); setError(''); setText(''); setListening(true)
    const token = generation.current
    try {
      const session = await startVoiceRecognition(voice.language, (transcript, final) => {
        if (generation.current !== token) return
        setText(transcript)
        if (final) { setListening(false); recording.current = null; interpret(transcript) }
      }, (message) => { if (generation.current === token) { setListening(false); recording.current = null; setError(message) } })
      if (generation.current !== token) session.cancel()
      else recording.current = session
    } catch (failure) { if (generation.current === token) { setListening(false); setError(failure instanceof Error ? failure.message : 'No se pudo iniciar el dictado.') } }
  }
  useEffect(() => {
    if (!listening) return
    const timer = window.setTimeout(() => recording.current?.stop(), 60_000)
    return () => clearTimeout(timer)
  }, [listening])
  function minimize() {
    if (saving.current) return
    stopRecording(); voice.setOpen(false)
    if (voice.compact) { voice.setCompact(false); void NativeVoiceOverlay.closePanel().catch(() => toast.error('No se pudo cerrar el panel Android.')) }
  }
  function update(id: string, patch: Partial<VoiceMovementDraft>) { voice.setDrafts(voice.drafts.map((draft) => draft.id === id ? { ...draft, ...patch, issues: [] } : draft)); setError('') }
  async function save(drafts: VoiceMovementDraft[]) {
    if (saving.current || !drafts.length) return
    saving.current = true; setBusy(true); stopRecording(); setError('')
    try {
      const inputs = drafts.map((draft) => {
        if (!draft.itemName.trim() || !draft.incomeSourceId || !draft.currencyCode || !draft.type || !draft.category || !draft.amount.trim()) throw new Error('Completa el concepto, importe, tipo, categoría, cuenta y moneda de cada movimiento.')
        const currency = preferences.currencies.find((entry) => entry.code === draft.currencyCode)
        if (!currency) throw new Error('Selecciona una moneda configurada en Ajustes.')
        const amount = convertToUsd(Number(draft.amount.replace(',', '.')), getCurrencyByCode(currency.code))
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('El importe debe ser mayor que cero.')
        let description: string
        if (draft.type === 'expense' && isVoiceExpenseCategory(draft.category)) description = buildExpenseDescription(draft.category, draft.itemName.trim(), draft.status)
        else if (draft.type === 'want' && isVoiceWantCategory(draft.category)) description = buildWantDescription(draft.category, draft.itemName.trim(), draft.status)
        else throw new Error('La categoría no corresponde al tipo de movimiento.')
        return { id: draft.id, type: draft.type, amount, description, date: draft.date, incomeSourceId: draft.incomeSourceId, createdAt: new Date().toISOString() }
      })
      await finance.addTransactionsBatch(inputs)
      const savedIds = new Set(drafts.map((draft) => draft.id))
      voice.setDrafts(useVoiceStore.getState().drafts.filter((draft) => !savedIds.has(draft.id)))
      toast.success(`${drafts.length} movimiento${drafts.length === 1 ? '' : 's'} guardado${drafts.length === 1 ? '' : 's'}.`)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudieron guardar los movimientos.') }
    finally { saving.current = false; setBusy(false) }
  }
  const panel = <>
    <header className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1"><Badge variant="secondary"><AudioLines className="size-3" /> Dictado de movimientos</Badge>{voice.compact ? <h1 id="voice-title" className="text-lg font-semibold">Anota con tu voz</h1> : <DialogTitle>Anota con tu voz</DialogTitle>}{voice.compact ? <p className="text-sm text-muted-foreground">Revisa tus gastos y gustos antes de guardar.</p> : <DialogDescription>Revisa tus gastos y gustos antes de guardar.</DialogDescription>}</div>
      <Button size="icon" variant="ghost" aria-label="Minimizar asistente" disabled={busy} onClick={minimize}><Minus className="size-4" /></Button>
    </header>
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
      <FieldGroup><Field><FieldLabel htmlFor="voice-text">{listening ? 'Escuchando…' : 'Di o escribe tu movimiento'}</FieldLabel><Textarea id="voice-text" className="min-h-20 resize-none" value={text} disabled={listening || busy} onChange={(event) => setText(event.target.value)} maxLength={4000} placeholder="Ej.: gasto pan 5 USD y gusto cine 20 USD" /></Field></FieldGroup>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || listening} onClick={() => { void dictate() }}><Mic className="size-4" data-icon="inline-start" />{error ? 'Reintentar dictado' : 'Dictar'}</Button>{listening ? <Button variant="outline" onClick={() => recording.current?.stop()}><Square className="size-4" /> Detener</Button> : <Button variant="outline" disabled={busy || !text.trim()} onClick={() => interpret(text)}>Crear borradores</Button>}</div>
      <p className="text-xs text-muted-foreground" aria-live="polite">{listening ? 'El micrófono está activo. Toca Detener al terminar.' : 'Pendiente por defecto · Nada se guarda automáticamente.'}</p>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {voice.drafts.map((draft, index) => {
        const categoryOptions = [...(draft.type === 'want' ? wantCategories : draft.type === 'expense' ? expenseCategories : []), ...Array.from(new Set(finance.transactions.filter((entry) => entry.type === draft.type).map((entry) => entry.description?.split('::')[0] ?? '').filter((category) => category.startsWith('custom:')))).map((category) => ({ value: category, label: category.slice(7) }))]
        return <section key={draft.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2"><Checkbox checked={!excluded.has(draft.id)} disabled={busy} onCheckedChange={(checked) => setExcluded((previous) => { const next = new Set(previous); if (checked) next.delete(draft.id); else next.add(draft.id); return next })}>Movimiento {index + 1}</Checkbox><Button size="icon-sm" variant="ghost" aria-label={`Eliminar movimiento ${index + 1}`} disabled={busy} onClick={() => voice.setDrafts(voice.drafts.filter((entry) => entry.id !== draft.id))}><Trash2 className="size-4" /></Button></div>
          <p className="break-words text-xs text-muted-foreground">«{draft.text}»</p>
          {draft.issues.length > 0 && <p className="text-xs text-destructive">{draft.issues.join(' ')}</p>}
          <fieldset disabled={busy} className="min-w-0"><FieldGroup className="gap-3"><Field><FieldLabel htmlFor={`${draft.id}-name`}>Concepto</FieldLabel><Input id={`${draft.id}-name`} value={draft.itemName} onChange={(event) => update(draft.id, { itemName: event.target.value })} /></Field>
            <div className="grid min-w-0 grid-cols-2 gap-3"><Field><FieldLabel htmlFor={`${draft.id}-amount`}>Importe</FieldLabel><Input id={`${draft.id}-amount`} inputMode="decimal" value={draft.amount} onChange={(event) => update(draft.id, { amount: event.target.value })} /></Field><Choice id={`${draft.id}-currency`} label="Moneda" value={draft.currencyCode} options={preferences.currencies.map((currency) => ({ value: currency.code, label: currency.code }))} onChange={(value) => update(draft.id, { currencyCode: value })} /></div>
            <div className="grid min-w-0 grid-cols-2 gap-3"><Choice id={`${draft.id}-type`} label="Tipo" value={draft.type} options={[{ value: 'expense', label: 'Gasto' }, { value: 'want', label: 'Gusto' }]} onChange={(value) => update(draft.id, { type: value as VoiceMovementDraft['type'], category: '' })} /><Choice id={`${draft.id}-status`} label="Estado" value={draft.status} options={[{ value: 'pending', label: 'Pendiente' }, { value: 'checked', label: 'Pagado' }]} onChange={(value) => update(draft.id, { status: value as VoiceMovementDraft['status'] })} /></div>
            <Choice id={`${draft.id}-category`} label="Categoría" value={draft.category} options={categoryOptions} onChange={(value) => update(draft.id, { category: value as VoiceMovementDraft['category'] })} />
            <Choice id={`${draft.id}-account`} label="Cuenta" value={draft.incomeSourceId} options={accountOptions} onChange={(value) => update(draft.id, { incomeSourceId: value })} />
            <Field><FieldLabel htmlFor={`${draft.id}-date`}>Fecha</FieldLabel><Input id={`${draft.id}-date`} type="date" value={draft.date} onChange={(event) => update(draft.id, { date: event.target.value })} /></Field>
          </FieldGroup></fieldset>
          <Button variant="outline" disabled={busy || !finance.hasLoaded} onClick={() => { void save([draft]) }}>Guardar este movimiento</Button>
        </section>
      })}
    </div>
    <footer className="flex flex-col gap-2 border-t border-border pt-3"><Button disabled={busy || !finance.hasLoaded || !voice.drafts.some((draft) => !excluded.has(draft.id))} onClick={() => { void save(voice.drafts.filter((draft) => !excluded.has(draft.id))) }}><Check className="size-4" data-icon="inline-start" />{busy ? 'Guardando…' : 'Guardar seleccionados'}</Button><Button variant="ghost" disabled={busy} onClick={() => { if (!voice.drafts.length || window.confirm('¿Descartar todos los borradores?')) { voice.setDrafts([]); setText(''); minimize() } }}>Cancelar y descartar</Button></footer>
  </>
  if (voice.compact) return <section role="dialog" aria-labelledby="voice-title" className="flex h-dvh min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-popover p-4 text-popover-foreground">{panel}</section>
  return <>
    {voice.enabled && <Button size="icon" className="fixed z-30 size-14 touch-none rounded-full shadow-vault" style={{ left: bubbleX, top: bubbleY }} aria-label="Abrir asistente de dictado" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: bubbleX, y: bubbleY, startX: event.clientX, startY: event.clientY, moved: false }; blockClick.current = false }} onPointerMove={(event) => { const pointer = drag.current; if (!pointer) return; if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 8) pointer.moved = true; if (pointer.moved) voice.setPosition({ x: pointer.x + event.clientX - pointer.startX, y: pointer.y + event.clientY - pointer.startY }) }} onPointerUp={() => { blockClick.current = drag.current?.moved ?? false; drag.current = null }} onPointerCancel={() => { blockClick.current = true; drag.current = null }} onClick={() => { if (!blockClick.current) voice.setOpen(true) }}><Mic className="size-6" /></Button>}
    <Dialog open={voice.open} onOpenChange={(open) => { if (!open) minimize() }}><DialogContent showCloseButton={false} className="flex h-[min(88dvh,780px)] max-h-[88dvh] min-w-0 flex-col overflow-hidden sm:max-w-lg">{panel}</DialogContent></Dialog>
  </>
}
