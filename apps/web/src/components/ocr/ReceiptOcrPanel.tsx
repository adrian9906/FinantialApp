import { useRef, useState } from 'react'
import { Eye, ScanLine, Trash2 } from 'lucide-react'
import type { CategorizationRule, ReceiptOCRLineItem, ReceiptOCRParsedDraft, ReceiptOCRTransactionType } from '@plata/shared'
import { isOcrUserError, readImageFile, runClientOcr } from '@/lib/ocr'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'

type OcrStatus = 'idle' | 'preparing' | 'recognizing' | 'parsing' | 'done' | 'error'

interface ReceiptOcrPanelProps {
  transactionType: ReceiptOCRTransactionType
  userRules?: readonly CategorizationRule[]
  onApply: (draft: ReceiptOCRParsedDraft) => void
  onAddItems?: (items: ReceiptOCRLineItem[], date?: string) => Promise<void>
}

export function ReceiptOcrPanel({ transactionType, userRules, onApply, onAddItems }: ReceiptOcrPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [status, setStatus] = useState<OcrStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [draft, setDraft] = useState<ReceiptOCRParsedDraft | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [addingItems, setAddingItems] = useState(false)

  const isProcessing = status === 'preparing' || status === 'recognizing' || status === 'parsing'

  function resetState() {
    abortRef.current?.abort()
    setDraft(null)
    setErrorMessage(null)
    setShowRaw(false)
    setSelectedItems(new Set())
    setStatus('idle')
    setProgress(0)
  }

  async function handleFile(file: File | undefined) {
    if (!file || isProcessing) return

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setDraft(null)
    setErrorMessage(null)
    setShowRaw(false)
    setPreview(null)
    setStatus('preparing')
    setProgress(0)

    try {
      const image = await readImageFile(file)
      if (controller.signal.aborted) return
      setPreview(image.dataUrl)

      const detected = await runClientOcr({
        image,
        transactionType,
        userRules,
        signal: controller.signal,
        onProgress: (info) => {
          if (controller.signal.aborted) return
          setStatus(info.status)
          setProgress(info.progress ?? 0)
        },
      })

      if (controller.signal.aborted) return
      setDraft(detected)
      setSelectedItems(new Set(detected.lineItems?.map((_, index) => index) ?? []))
      setStatus('done')
      onApply(detected)
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus('error')
      setErrorMessage(isOcrUserError(error) ? error.message : 'El escaneo no pudo completarse.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleCancel() {
    abortRef.current?.abort()
    setStatus('idle')
    setProgress(0)
  }

  function toggleItem(index: number) {
    setSelectedItems((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    if (!draft) return
    setSelectedItems(checked ? new Set(draft.lineItems?.map((_, index) => index) ?? []) : new Set())
  }

  async function handleAddSelected() {
    if (!draft || !onAddItems || selectedItems.size === 0) return
    const selected = draft.lineItems?.filter((_, index) => selectedItems.has(index)) ?? []
    if (selected.length === 0) return
    setAddingItems(true)
    try {
      await onAddItems(selected, draft.date)
    } finally {
      setAddingItems(false)
    }
  }

  const hasDetectedData = draft !== null && (draft.amount !== undefined || draft.date !== undefined || draft.suggestedName !== undefined)
  const summaryTokens = [
    draft?.suggestedName ? { label: 'Nombre', value: draft.suggestedName } : null,
    draft?.amount !== undefined ? { label: 'Importe', value: String(draft.amount) } : null,
    draft?.date ? { label: 'Fecha', value: draft.date } : null,
  ].filter((token): token is { label: string; value: string } => token !== null)

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-graphite bg-abyss/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-medium-gray">Escanear recibo</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isProcessing}
          onClick={() => fileInputRef.current?.click()}
          className="bg-surface-container-high text-on-surface hover:bg-surface-container-higher"
        >
          {isProcessing ? 'Procesando…' : <><ScanLine className="size-4" /> Escanear recibo</>}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </div>

      <p className="text-xs leading-5 text-muted-gray">
        Sube una foto del recibo y los datos se rellenan automáticamente. Siempre podrás editarlos antes de guardar.
      </p>

      {preview ? (
        <div className="flex items-center gap-3">
          <img src={preview} alt="Vista previa del recibo" className="h-20 w-20 rounded-lg border border-graphite bg-surface object-cover" />
          <div className="min-w-0 flex-1">
            {isProcessing ? (
              <div className="space-y-1">
                <Progress value={progress}>
                  <p className="text-xs text-muted-gray">
                    {status === 'preparing' ? 'Preparando la imagen…' : status === 'recognizing' ? `Leyendo texto… ${progress}%` : 'Interpretando los datos…'}
                  </p>
                  {progress > 0 ? <span className="text-xs tabular-nums text-muted-gray">{progress}%</span> : null}
                </Progress>
                <Button type="button" variant="ghost" size="sm" onClick={handleCancel} className="h-auto px-0 text-xs text-muted-gray hover:text-on-surface">
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-medium ${status === 'done' && hasDetectedData ? 'text-success' : status === 'error' ? 'text-error' : 'text-muted-gray'}`}>
                  {status === 'done'
                    ? (hasDetectedData ? 'Datos detectados' : 'No se detectaron datos relevantes')
                    : status === 'error'
                      ? errorMessage ?? 'Escaneo fallido'
                      : 'Listo'}
                </span>
                {status === 'done' ? (
                  <Button type="button" variant="ghost" size="sm" onClick={resetState} className="h-auto px-0 text-xs text-muted-gray hover:text-on-surface">
                    <Trash2 className="size-3" /> Limpiar
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {hasDetectedData && status === 'done' ? (
        <div className="space-y-2 rounded-lg border border-graphite bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            {summaryTokens.map((token) => (
              <span key={token.label} className="inline-flex items-center gap-1 rounded-md bg-surface-container-high px-2 py-1 text-xs text-on-surface">
                <span className="text-muted-gray">{token.label}:</span> {token.value}
              </span>
            ))}
          </div>

          {draft && draft.warnings.length > 0 ? (
            <ul className="space-y-1">
              {draft.warnings.map((warning) => (
                <li key={warning} className="text-xs text-warning">
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}

          {draft ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowRaw((current) => !current)}
              className="h-auto px-0 text-xs text-muted-gray hover:text-on-surface"
            >
              <Eye className="size-3" /> {showRaw ? 'Ocultar' : 'Ver'} texto detectado completo
            </Button>
          ) : null}

          {showRaw && draft ? (
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-abyss p-2 font-mono text-xs leading-5 text-muted-gray">
              {draft.rawText}
            </pre>
          ) : null}
        </div>
      ) : null}

      {status === 'done' && draft && draft.lineItems && draft.lineItems.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-graphite bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-on-surface">
              Productos detectados ({draft.lineItems.length})
            </p>
            <button
              type="button"
              className="text-xs font-medium text-accent hover:text-accent/80"
              onClick={() => toggleAll(selectedItems.size !== draft.lineItems?.length)}
            >
              {selectedItems.size === draft.lineItems?.length ? 'Quitar todos' : 'Marcar todos'}
            </button>
          </div>

          <ul className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {draft.lineItems.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 hover:bg-surface-container-high">
                  <Checkbox
                    checked={selectedItems.has(index)}
                    onCheckedChange={() => toggleItem(index)}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-on-surface">{item.name}</span>
                  <span className="shrink-0 tabular-nums text-sm font-medium text-on-surface">
                    {item.price.toLocaleString('es')}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {onAddItems ? (
            <Button
              type="button"
              size="sm"
              disabled={addingItems || selectedItems.size === 0}
              onClick={() => void handleAddSelected()}
              className="bg-primary text-on-primary hover:bg-primary/90"
            >
              {addingItems ? 'Agregando…' : `Agregar ${selectedItems.size} producto${selectedItems.size === 1 ? '' : 's'}`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}