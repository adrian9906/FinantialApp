import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_ATTACHMENTS_PER_TRANSACTION,
  validateImageDataUrl,
  isValidHostedImageUrl,
} from '@plata/shared'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { requestJson } from '@/lib/api'
import { preparePurchasePhoto } from '@/lib/prepare-purchase-photo'
import { useAuthStore } from '@/store/authStore'

interface PurchasePhotosFieldProps {
  value: string[]
  onChange: (value: string[]) => void
  kind?: 'expense' | 'want' | 'saving'
  onBusyChange?: (busy: boolean) => void
}

/**
 * Optional receipt/place photos. Every file is validated against the real image
 * bytes before it is accepted, so a renamed script or document is refused here
 * as well as on the server.
 */
export function PurchasePhotosField({ value, onChange, kind = 'expense', onBusyChange }: PurchasePhotosFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [progress, setProgress] = useState('')
  const authMode = useAuthStore((state) => state.authMode)

  const remaining = MAX_ATTACHMENTS_PER_TRANSACTION - value.length

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || isReading) return
    if (authMode !== 'authenticated') {
      setError('Inicia sesión para subir fotos y guardarlas en tu cuenta.')
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setError(null)
    setIsReading(true)
    onBusyChange?.(true)

    try {
      const accepted: string[] = []
      let rejected: string | null = null

      for (const file of Array.from(files).slice(0, Math.max(0, remaining))) {
        setProgress(`Preparando foto ${accepted.length + 1}…`)
        let dataUrl: string
        try {
          dataUrl = await preparePurchasePhoto(file)
        } catch (error) {
          rejected = error instanceof Error ? error.message : 'No se pudo preparar la foto.'
          continue
        }
        const result = validateImageDataUrl(dataUrl)
        if (!result.valid || !dataUrl) {
          rejected = result.error ?? 'No se pudo leer el archivo.'
          continue
        }

        try {
          setProgress(`Subiendo foto ${accepted.length + 1}…`)
          const uploaded = await requestJson<{ url: string }>('/uploads/transaction-image', {
            method: 'POST',
            body: JSON.stringify({ image: dataUrl, kind }),
          }, { timeoutMs: 60_000 })
          if (!isValidHostedImageUrl(uploaded.url)) throw new Error('La subida no devolvió una foto válida. Inténtalo de nuevo.')
          accepted.push(uploaded.url)
        } catch (error) {
          rejected = error instanceof DOMException && error.name === 'AbortError'
            ? 'La subida tardó demasiado. Comprueba tu conexión y selecciona la foto de nuevo.'
            : error instanceof TypeError ? 'No se pudo conectar para subir la foto. Comprueba tu conexión e inténtalo de nuevo.'
            : error instanceof Error ? error.message : 'No se pudo subir el archivo.'
        }
      }

      if (accepted.length > 0) onChange([...new Set([...value, ...accepted])])
      if (rejected) setError(rejected)
      else if (files.length > remaining) {
        setError(`Solo puedes adjuntar ${MAX_ATTACHMENTS_PER_TRANSACTION} fotos.`)
      }
    } finally {
      setIsReading(false)
      onBusyChange?.(false)
      setProgress('')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, position) => position !== index))
    setError(null)
  }

  return (
    <div className="space-y-2">
      <Label className="text-medium-gray">Fotos de la compra o del recibo (opcional)</Label>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
        multiple
        hidden
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <div className="flex flex-wrap gap-2">
        {value.map((photo, index) => (
          <div key={`${index}-${photo.slice(-16)}`} className="relative">
            <img
              src={photo}
              alt={`Foto ${index + 1} de la compra`}
              className="size-20 rounded-lg border border-graphite object-cover"
            />
            <button
              type="button"
              aria-label={`Quitar foto ${index + 1}`}
              onClick={() => removeAt(index)}
              disabled={isReading}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-surface p-1 text-muted-gray shadow-vault-sm hover:text-error"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </div>
        ))}

        {remaining > 0 ? (
          <Button
            type="button"
            variant="outline"
            loading={isReading}
            onClick={() => inputRef.current?.click()}
            className="size-20 flex-col gap-1 border-dashed border-graphite text-xs text-muted-gray"
          >
            {isReading ? null : <ImagePlus className="size-4" aria-hidden="true" />}
            Agregar
          </Button>
        ) : null}
      </div>

      {isReading ? <p role="status" className="text-xs text-muted-gray">{progress}</p> : null}
      {error ? <p role="alert" className="text-xs text-error">{error}</p> : null}
      <p className="text-xs text-muted-gray">
        JPG, PNG, WEBP o GIF. Hasta {MAX_ATTACHMENTS_PER_TRANSACTION} fotos. Las fotos grandes se reducen a 3 MB antes de subirlas.
      </p>
    </div>
  )
}
