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
    workerPromise = import('tesseract.js').then(async ({ createWorker, PSM }) => {
      const worker = await createWorker(['spa', 'eng'], 1, {
        logger: (message) => {
          activeProgress?.({
            status: 'recognizing',
            progress: Math.round(message.progress * 100),
          })
        },
        errorHandler: () => {},
      })
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      })
      return worker
    })
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

interface CropBounds {
  x: number
  y: number
  width: number
  height: number
}

function percentileFromHistogram(histogram: Uint32Array, total: number, percentile: number) {
  const target = total * percentile
  let seen = 0
  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value]
    if (seen >= target) return value
  }
  return 255
}

function otsuThreshold(histogram: Uint32Array, total: number) {
  let weightedTotal = 0
  for (let value = 0; value < histogram.length; value += 1) weightedTotal += value * histogram[value]
  let backgroundWeight = 0
  let backgroundSum = 0
  let bestVariance = -1
  let threshold = 160
  for (let value = 0; value < histogram.length; value += 1) {
    backgroundWeight += histogram[value]
    if (backgroundWeight === 0) continue
    const foregroundWeight = total - backgroundWeight
    if (foregroundWeight === 0) break
    backgroundSum += value * histogram[value]
    const backgroundMean = backgroundSum / backgroundWeight
    const foregroundMean = (weightedTotal - backgroundSum) / foregroundWeight
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2
    if (variance > bestVariance) {
      bestVariance = variance
      threshold = value
    }
  }
  return Math.max(95, Math.min(220, threshold))
}

/** Finds the largest pale, receipt-shaped surface and ignores bright objects touching the photo edges. */
function findReceiptBounds(image: HTMLImageElement): CropBounds | null {
  const detectionScale = Math.min(1, 360 / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * detectionScale))
  const height = Math.max(1, Math.round(image.naturalHeight * detectionScale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(image, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height).data
  const luminanceHistogram = new Uint32Array(256)

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = Math.round((pixels[index] * 299 + pixels[index + 1] * 587 + pixels[index + 2] * 114) / 1000)
    luminanceHistogram[luminance] += 1
  }

  const brightPercentile = percentileFromHistogram(luminanceHistogram, width * height, 0.82)
  const threshold = Math.max(145, Math.min(220, brightPercentile - 18))
  const mask = new Uint8Array(width * height)
  for (let pixel = 0, index = 0; pixel < mask.length; pixel += 1, index += 4) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    const luminance = (red * 299 + green * 587 + blue * 114) / 1000
    const saturation = Math.max(red, green, blue) - Math.min(red, green, blue)
    if (luminance >= threshold && saturation <= 72) mask[pixel] = 1
  }

  // Close tiny gaps caused by printed characters so the paper remains one component.
  const closed = mask.slice()
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      if (mask[index]) continue
      const horizontal = mask[index - 1] && mask[index + 1]
      const vertical = mask[index - width] && mask[index + width]
      if (horizontal || vertical) closed[index] = 1
    }
  }

  const visited = new Uint8Array(width * height)
  const stack = new Int32Array(width * height)
  let best: { score: number; minX: number; minY: number; maxX: number; maxY: number } | null = null

  for (let start = 0; start < closed.length; start += 1) {
    if (!closed[start] || visited[start]) continue
    let stackLength = 0
    stack[stackLength++] = start
    visited[start] = 1
    let count = 0
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0

    while (stackLength > 0) {
      const current = stack[--stackLength]
      const x = current % width
      const y = Math.floor(current / width)
      count += 1
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)

      const neighbors = [current - 1, current + 1, current - width, current + width]
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= closed.length || visited[neighbor] || !closed[neighbor]) continue
        const neighborX = neighbor % width
        if (Math.abs(neighborX - x) > 1) continue
        visited[neighbor] = 1
        stack[stackLength++] = neighbor
      }
    }

    const componentWidth = maxX - minX + 1
    const componentHeight = maxY - minY + 1
    const area = componentWidth * componentHeight
    if (count < width * height * 0.015 || componentWidth < width * 0.12 || componentHeight < height * 0.2) continue
    const fill = count / area
    const aspect = componentWidth / componentHeight
    const centerX = (minX + maxX) / 2 / width
    const centerWeight = 1 - Math.min(0.55, Math.abs(centerX - 0.5))
    const touchesEdge = minX <= 1 || minY <= 1 || maxX >= width - 2 || maxY >= height - 2
    const shapeWeight = aspect >= 0.22 && aspect <= 1.15 ? 1.35 : 0.65
    const score = count * fill * centerWeight * shapeWeight * (touchesEdge ? 0.35 : 1)
    if (!best || score > best.score) best = { score, minX, minY, maxX, maxY }
  }

  if (!best) return null
  const scaleX = image.naturalWidth / width
  const scaleY = image.naturalHeight / height
  const paddingX = (best.maxX - best.minX + 1) * scaleX * 0.035
  const paddingY = (best.maxY - best.minY + 1) * scaleY * 0.025
  const x = Math.max(0, best.minX * scaleX - paddingX)
  const y = Math.max(0, best.minY * scaleY - paddingY)
  const right = Math.min(image.naturalWidth, (best.maxX + 1) * scaleX + paddingX)
  const bottom = Math.min(image.naturalHeight, (best.maxY + 1) * scaleY + paddingY)
  return { x, y, width: right - x, height: bottom - y }
}

async function prepareReceiptImages(dataUrl: string): Promise<string[]> {
  const image = await loadHtmlImage(dataUrl)
  const crop = findReceiptBounds(image) ?? { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }
  const targetWidth = Math.min(1600, Math.max(1100, Math.round(crop.width * 3)))
  const scale = targetWidth / crop.width
  const width = Math.max(1, Math.round(crop.width * scale))
  const height = Math.max(1, Math.min(3200, Math.round(crop.height * scale)))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return [dataUrl]
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height)

  const source = context.getImageData(0, 0, width, height)
  const gray = new Uint8Array(width * height)
  const histogram = new Uint32Array(256)
  for (let pixel = 0, index = 0; pixel < gray.length; pixel += 1, index += 4) {
    const value = Math.round((source.data[index] * 299 + source.data[index + 1] * 587 + source.data[index + 2] * 114) / 1000)
    gray[pixel] = value
    histogram[value] += 1
  }
  const low = percentileFromHistogram(histogram, gray.length, 0.03)
  const high = Math.max(low + 30, percentileFromHistogram(histogram, gray.length, 0.97))
  const enhanced = new ImageData(width, height)
  const enhancedHistogram = new Uint32Array(256)
  for (let pixel = 0, index = 0; pixel < gray.length; pixel += 1, index += 4) {
    const normalized = Math.max(0, Math.min(255, Math.round(((gray[pixel] - low) * 255) / (high - low))))
    enhanced.data[index] = normalized
    enhanced.data[index + 1] = normalized
    enhanced.data[index + 2] = normalized
    enhanced.data[index + 3] = 255
    enhancedHistogram[normalized] += 1
  }
  context.putImageData(enhanced, 0, 0)
  const grayscale = canvas.toDataURL('image/png')

  // A high-contrast pass is a useful fallback for faded thermal printing.
  const binaryThreshold = otsuThreshold(enhancedHistogram, gray.length)
  for (let index = 0; index < enhanced.data.length; index += 4) {
    const value = enhanced.data[index] < binaryThreshold ? 0 : 255
    enhanced.data[index] = value
    enhanced.data[index + 1] = value
    enhanced.data[index + 2] = value
  }
  context.putImageData(enhanced, 0, 0)
  return [grayscale, canvas.toDataURL('image/png')]
}

function scoreReceiptDraft(draft: ReceiptOCRParsedDraft) {
  const items = draft.lineItems ?? []
  const itemTotal = items.reduce((sum, item) => sum + item.price, 0)
  const totalMatches = draft.amount && itemTotal
    ? Math.abs(itemTotal - draft.amount) <= Math.max(1, draft.amount * 0.03)
    : false
  const readableNames = items.filter((item) => /[A-Za-z\u00C0-\u017F]{4,}/.test(item.name)).length
  return items.length * 12
    + readableNames * 5
    + (draft.date ? 12 : 0)
    + (draft.amount ? 8 : 0)
    + (totalMatches ? 35 : 0)
    - draft.warnings.length * 2
}

export async function readImageFile(file: File): Promise<OcrImageSource> {
  if (!file.type.startsWith('image/')) {
    throw new OcrUserError('Selecciona una imagen válida (JPG, PNG o similar).')
  }
  const dataUrl = await readFileAsDataUrl(file)
  // Keep enough pixels for small thermal-printer glyphs; the OCR pass crops and enhances the paper.
  const downscaled = await downscaleImage(dataUrl, 3000, 0.92)
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

  const preparedImages = await prepareReceiptImages(image.dataUrl)
  let bestDraft: ReceiptOCRParsedDraft | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  try {
    for (let index = 0; index < preparedImages.length; index += 1) {
      const passStart = index * 50
      activeProgress = (progress) => report({
        ...progress,
        progress: Math.min(99, passStart + Math.round((progress.progress ?? 0) / 2)),
        message: index === 0 ? 'Leyendo el recibo recortado…' : 'Revisando texto poco visible…',
      })
      const result = await worker.recognize(preparedImages[index], {}, { text: true })
      failIfAborted(signal)
      const rawText = result.data.text ?? ''
      if (!rawText.trim()) continue
      const candidate = parseReceiptTextToDraft(rawText, { transactionType, userRules })
      const score = scoreReceiptDraft(candidate)
      if (score > bestScore) {
        bestDraft = candidate
        bestScore = score
      }

      const itemTotal = candidate.lineItems?.reduce((sum, item) => sum + item.price, 0) ?? 0
      const isReliable = (candidate.lineItems?.length ?? 0) >= 2
        && candidate.amount !== undefined
        && Math.abs(itemTotal - candidate.amount) <= Math.max(1, candidate.amount * 0.03)
      if (isReliable) break
    }
  } finally {
    activeProgress = null
  }

  failIfAborted(signal)

  if (!bestDraft) {
    throw new OcrUserError('No se detectó texto útil en la imagen. Prueba con una foto más nítida.')
  }

  report({ status: 'parsing', message: 'Interpretando los datos…' })
  report({ status: 'done' })

  return bestDraft
}
