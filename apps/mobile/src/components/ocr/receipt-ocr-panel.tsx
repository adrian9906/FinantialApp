import { useRef, useState } from 'react'
import { ActivityIndicator, Image, Pressable, View } from 'react-native'
import { Check, Eye, ScanLine, Trash2 } from 'lucide-react-native'
import type { CategorizationRule, ReceiptOCRLineItem, ReceiptOCRParsedDraft, ReceiptOCRTransactionType } from '@plata/shared'

import { Button } from '../ui/button'
import { Text } from '../ui/text'
import { resolvePalette } from '../../theme/palette'
import { radius, spacing } from '../../theme/tokens'
import { isOcrUserError, pickReceiptImage, runClientOcr } from '../../lib/ocr'
import { usePreferencesStore } from '../../store/preferences-store'

const ScanLineIcon = ScanLine as any
const EyeIcon = Eye as any
const Trash2Icon = Trash2 as any
const CheckIcon = Check as any

type OcrStatus = 'idle' | 'preparing' | 'recognizing' | 'parsing' | 'done' | 'error'

interface ReceiptOcrPanelProps {
  transactionType: ReceiptOCRTransactionType
  userRules?: readonly CategorizationRule[]
  onApply: (draft: ReceiptOCRParsedDraft) => void
  onAddItems?: (items: ReceiptOCRLineItem[], date?: string) => Promise<void>
}

export function ReceiptOcrPanel({ transactionType, userRules, onApply, onAddItems }: ReceiptOcrPanelProps) {
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)
  const abortRef = useRef<AbortController | null>(null)
  const [status, setStatus] = useState<OcrStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
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
    setPreviewUri(null)
    setStatus('idle')
    setProgress(0)
  }

  async function handleScan() {
    if (isProcessing) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setDraft(null)
    setErrorMessage(null)
    setShowRaw(false)
    setPreviewUri(null)
    setStatus('preparing')
    setProgress(0)

    try {
      const picked = await pickReceiptImage()
      if (controller.signal.aborted) return
      if (!picked) {
        if (abortRef.current === controller) setStatus('idle')
        return
      }
      setPreviewUri(picked.previewUri)

      const detected = await runClientOcr({
        image: { dataUrl: picked.dataUrl },
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
    <View
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: palette.border,
        backgroundColor: palette.backgroundAlt,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text style={{ color: palette.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Escanear recibo</Text>
        <Button variant="outline" onPress={() => void handleScan()} disabled={isProcessing}>
          <ScanLineIcon size={16} color={palette.text} />
          <Text>{isProcessing ? 'Procesando…' : 'Escanear recibo'}</Text>
        </Button>
      </View>

      <Text style={{ color: palette.textMuted, fontSize: 12, lineHeight: 18 }}>
        Sube una foto del recibo y los datos se rellenan automáticamente. Siempre podrás editarlos antes de guardar.
      </Text>

      {previewUri ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Image source={{ uri: previewUri }} style={{ width: 72, height: 72, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border }} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            {isProcessing ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <ActivityIndicator size="small" color={palette.primary} />
                  <Text style={{ color: palette.textMuted, fontSize: 12, flex: 1 }}>
                    {status === 'preparing'
                      ? 'Preparando la imagen…'
                      : status === 'recognizing'
                        ? `Leyendo texto… ${progress}%`
                        : 'Interpretando los datos…'}
                  </Text>
                </View>
                <Pressable onPress={handleCancel}>
                  <Text style={{ color: palette.textMuted, fontSize: 12 }}>Cancelar</Text>
                </Pressable>
              </>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Text
                  style={{
                    color: status === 'done' && hasDetectedData
                      ? palette.success
                      : status === 'error'
                        ? palette.danger
                        : palette.textMuted,
                    fontSize: 12,
                    fontWeight: '700',
                    flexShrink: 1,
                  }}
                >
                  {status === 'done'
                    ? (hasDetectedData ? 'Datos detectados' : 'No se detectaron datos relevantes')
                    : status === 'error'
                      ? (errorMessage ?? 'Escaneo fallido')
                      : 'Listo'}
                </Text>
                {status === 'done' ? (
                  <Pressable onPress={resetState}>
                    <Trash2Icon size={14} color={palette.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        </View>
      ) : null}

      {hasDetectedData && status === 'done' ? (
        <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: spacing.sm, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {summaryTokens.map((token) => (
              <View key={token.label} style={{ borderRadius: radius.sm, backgroundColor: palette.surfaceMuted, paddingHorizontal: spacing.sm, paddingVertical: 4 }}>
                <Text style={{ color: palette.text, fontSize: 12 }}>
                  <Text style={{ color: palette.textMuted }}>{token.label}: </Text>
                  {token.value}
                </Text>
              </View>
            ))}
          </View>

          {draft && draft.warnings.length > 0 ? (
            <View style={{ gap: 2 }}>
              {draft.warnings.map((warning) => (
                <Text key={warning} style={{ color: palette.warning, fontSize: 12 }}>
                  {warning}
                </Text>
              ))}
            </View>
          ) : null}

          {draft ? (
            <Pressable onPress={() => setShowRaw((current) => !current)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <EyeIcon size={14} color={palette.textMuted} />
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>{showRaw ? 'Ocultar' : 'Ver'} texto detectado completo</Text>
            </Pressable>
          ) : null}

          {showRaw && draft ? (
            <Text style={{ color: palette.textMuted, fontSize: 12, lineHeight: 18, maxHeight: 160 }}>{draft.rawText}</Text>
          ) : null}
        </View>
      ) : null}

      {status === 'done' && draft && draft.lineItems && draft.lineItems.length > 0 ? (
        <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: spacing.sm, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text style={{ fontWeight: '700', fontSize: 12, color: palette.text }}>
              Productos detectados ({draft.lineItems.length})
            </Text>
            <Pressable onPress={() => setSelectedItems(
              selectedItems.size === draft.lineItems?.length
                ? new Set()
                : new Set(draft.lineItems?.map((_, index) => index) ?? []),
            )}>
              <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '600' }}>
                {selectedItems.size === draft.lineItems?.length ? 'Quitar todos' : 'Marcar todos'}
              </Text>
            </Pressable>
          </View>

          {draft.lineItems.map((item, index) => {
            const selected = selectedItems.has(index)
            return (
              <Pressable
                key={`${item.name}-${index}`}
                onPress={() => toggleItem(index)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: selected ? palette.primary : palette.border,
                    backgroundColor: selected ? palette.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selected ? <CheckIcon size={13} color={palette.textOnPrimary} /> : null}
                </View>
                <Text style={{ flex: 1, color: palette.text, fontSize: 13 }} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  {item.price.toLocaleString('es')}
                </Text>
              </Pressable>
            )
          })}

          {onAddItems ? (
            <Button
              onPress={() => void handleAddSelected()}
              disabled={addingItems || selectedItems.size === 0}
            >
              <Text>
                {addingItems
                  ? 'Agregando…'
                  : `Agregar ${selectedItems.size} producto${selectedItems.size === 1 ? '' : 's'}`}
              </Text>
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}