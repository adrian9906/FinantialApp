import type {
  CategorizationRule,
  OCRWorkflowProgress,
  ReceiptOCRParsedDraft,
  ReceiptOCRTransactionType,
} from '@plata/shared'
import { parseReceiptTextToDraft } from '@plata/shared'

export class OcrUserError extends Error {}

export function isOcrUserError(error: unknown): error is OcrUserError {
  return error instanceof OcrUserError
}

export interface OcrImageSource {
  dataUrl: string
}

export interface RunClientOcrInput {
  image: OcrImageSource
  transactionType: ReceiptOCRTransactionType
  userRules?: readonly CategorizationRule[]
  onProgress?: (progress: OCRWorkflowProgress) => void
  signal?: AbortSignal
}

let workerPromise: Promise<Tesseract.Worker> | null = null
let activeProgress: ((progress: OCRWorkflowProgress) => void) | null = null

async function getWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) =>
      createWorker(['spa', 'eng'], 1, {
        logger: (message) => {
          activeProgress?.({
            status: 'recognizing',
            progress: Math.round(message.progress * 100),
          })
        },
        errorHandler: () => {},
      }),
    )
    workerPromise.catch(() => {
      workerPromise = null
    })
  }
  return workerPromise
}

function failIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new OcrUserError('Escaneo cancelado.')
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new OcrUserError('No se pudo leer el archivo seleccionado.'))
    reader.readAsDataURL(file)
  })
}

function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new OcrUserError('La imagen seleccionada no se pudo abrir.'))
    image.src = dataUrl
  })
}

async function downscaleImage(dataUrl: string, maxDimension: number, quality: number): Promise<string | null> {
  try {
    const image = await loadHtmlImage(dataUrl)
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return null
  }
}

export async function readImageFile(file: File): Promise<OcrImageSource> {
  if (!file.type.startsWith('image/')) {
    throw new OcrUserError('Selecciona una imagen válida (JPG, PNG o similar).')
  }
  const dataUrl = await readFileAsDataUrl(file)
  const downscaled = await downscaleImage(dataUrl, 1600, 0.85)
  if (!downscaled) {
    throw new OcrUserError('No se pudo procesar la imagen seleccionada.')
  }
  return { dataUrl: downscaled }
}

export async function runClientOcr(input: RunClientOcrInput): Promise<ReceiptOCRParsedDraft> {
  const { image, transactionType, userRules, onProgress, signal } = input
  const report = (progress: OCRWorkflowProgress) => onProgress?.(progress)

  failIfAborted(signal)
  report({ status: 'preparing', message: 'Preparando la imagen…' })

  let worker: Tesseract.Worker
  try {
    worker = await getWorker()
  } catch {
    throw new OcrUserError('No se pudo inicializar el motor de OCR. Revisa tu conexión y vuelve a intentarlo.')
  }

  failIfAborted(signal)
  report({ status: 'recognizing', progress: 0, message: 'Leyendo el texto…' })

  activeProgress = report
  let rawText = ''
  try {
    const result = await worker.recognize(image.dataUrl, {}, { text: true })
    rawText = result.data.text ?? ''
  } finally {
    activeProgress = null
  }

  failIfAborted(signal)

  if (!rawText.trim()) {
    throw new OcrUserError('No se detectó texto útil en la imagen. Prueba con una foto más nítida.')
  }

  report({ status: 'parsing', message: 'Interpretando los datos…' })
  const draft = parseReceiptTextToDraft(rawText, { transactionType, userRules })
  report({ status: 'done' })

  return draft
}