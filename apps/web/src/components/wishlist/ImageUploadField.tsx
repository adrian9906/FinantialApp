import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { ImagePlus, Upload, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ImageUploadFieldProps {
  value?: string
  onChange: (value?: string) => void
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'))
    reader.readAsDataURL(file)
  })
}

export function ImageUploadField({ value, onChange }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isBroken, setIsBroken] = useState(false)

  useEffect(() => {
    const Broken = () => {
      setIsBroken(false)
    }
    Broken()
    if (!value && inputRef.current) {
      inputRef.current.value = ''
    }
  }, [value])

  const patternBlocks = useMemo(() => Array.from({ length: 36 }, (_, index) => index), [])

  async function handleFiles(files: FileList | File[] | null) {
    const file = files?.[0]
    if (!file) {
      if (inputRef.current) {
        inputRef.current.value = ''
      }
      return
    }

    if (!file.type.startsWith('image/')) {
      if (inputRef.current) {
        inputRef.current.value = ''
      }
      return
    }

    onChange(await fileToDataUrl(file))

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDragging(false)
    void handleFiles(event.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'relative block w-full overflow-hidden rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-left transition-all duration-200 hover:border-primary/70 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isDragging && 'border-primary bg-primary/10'
        )}
      >
        <div className="absolute inset-0 opacity-60">
          <div className="grid h-full grid-cols-6 gap-1 p-2">
            {patternBlocks.map((block) => (
              <span
                key={block}
                className={cn(
                  'rounded-md bg-background/70',
                  block % 2 === 0 && 'shadow-[rgba(255,255,255,0.05)_0px_0px_0px_1px_inset]'
                )}
              />
            ))}
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex h-24 w-full items-center justify-center rounded-2xl border border-border/60 bg-card md:w-32">
            {value && !isBroken ? (
              <img
                src={value}
                alt="Vista previa del producto"
                className="h-full w-full rounded-2xl object-cover"
                onError={() => setIsBroken(true)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImagePlus className="size-5" />
                <span className="text-xs">Vista previa</span>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              <Upload className="size-3.5" />
              Imagen del producto
            </div>
            <p className="text-sm font-medium text-foreground">
              Arrastra una foto aqui o haz clic para subirla
            </p>
            <p className="text-sm text-muted-foreground">
              Se usara para la vista en tarjetas y para reconocer el producto más rápido.
            </p>
          </div>
        </div>
      </button>

      {value ? (
        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2">
          <p className="text-sm text-muted-foreground">Foto lista para mostrarse en la tarjeta.</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)} className="text-muted-foreground hover:text-foreground">
            <X data-icon="inline-start" />
            Quitar
          </Button>
        </div>
      ) : null}
    </div>
  )
}
