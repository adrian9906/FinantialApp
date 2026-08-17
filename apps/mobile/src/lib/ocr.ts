import * as ImagePicker from 'expo-image-picker'
import type {
  CategorizationRule,
  OCRWorkflowProgress,
  ReceiptOCRParsedDraft,
  ReceiptOCRTransactionType,
} from '@plata/shared'
import { parseReceiptTextToDraft } from '@plata/shared'

// v1 usa el mismo pipeline de Tesseract.js en ambas plataformas. El rendimiento
// en móvil es inferior al de un OCR nativo, pero el contrato público de este
// servicio se mantiene estable para una v2 que pueda migrar a ML Kit / Vision
// Camera sin romper la interfaz de los formularios.

export class OcrUserError extends Error {}

export function isOcrUserError(error: unknown): error is OcrUserError {
  return error instanceof OcrUserError
}

export interface OcrImageSource {
  dataUrl: string
}

export interface PickedReceiptImage {
  dataUrl: string
  previewUri: string
}

export async function pickReceiptImage(): Promise<PickedReceiptImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.6,
    base64: true,
  })
  if (result.canceled) return null

  const asset = result.assets[0]
  if (!asset) return null
  if (!asset.base64) {
    throw new OcrUserError('La imagen seleccionada no se pudo preparar.')
  }
  return {
    dataUrl: `data:image/jpeg;base64,${asset.base64}`,
    previewUri: asset.uri,
  }
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

export async function runClientOcr(input: RunClientOcrInput): Promise<ReceiptOCRParsedDraft> {
  const { image, transactionType, userRules, onProgress, signal } = input
  const report = (progress: OCRWorkflowProgress) => onProgress?.(progress)

  failIfAborted(signal)
  report({ status: 'preparing', message: 'Preparando la imagen…' })

  let worker: Tesseract.Worker
  try {
    worker = await getWorker()
  } catch {
    throw new OcrUserError('No se pudo inicializar el motor de OCR. Vuelve a intentarlo.')
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