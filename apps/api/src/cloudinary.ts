import { createHash, randomUUID } from 'node:crypto'

const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const imageDataUrlPattern = /^data:image\/(avif|gif|jpe?g|png|webp);base64,([a-z0-9+/=\r\n]+)$/i

type UploadOptions = {
  folder: string
  publicId?: string
  overwrite?: boolean
}

function getCloudinaryConfig() {
  const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim()

  if (cloudinaryUrl) {
    const parsed = new URL(cloudinaryUrl)

    if (parsed.protocol !== 'cloudinary:' || !parsed.hostname || !parsed.username || !parsed.password) {
      throw new Error('CLOUDINARY_URL no tiene el formato cloudinary://API_KEY:API_SECRET@CLOUD_NAME.')
    }

    return {
      cloud_name: parsed.hostname,
      api_key: decodeURIComponent(parsed.username),
      api_secret: decodeURIComponent(parsed.password),
      secure: true,
    }
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim()
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim()
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim()

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary no está configurado. Define CLOUDINARY_URL en la API.')
  }

  return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true }
}

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_URL?.trim()
    || (process.env.CLOUDINARY_CLOUD_NAME?.trim() && process.env.CLOUDINARY_API_KEY?.trim() && process.env.CLOUDINARY_API_SECRET?.trim()),
  )
}

/** Folder root shared by live uploads and one-time recovery uploads. */
export function getCloudinaryFolder(...segments: string[]) {
  const configured = process.env.CLOUDINARY_FOLDER?.trim().replace(/^\/+|\/+$/g, '') || 'plata'

  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(configured)) {
    throw new Error('CLOUDINARY_FOLDER solo puede contener letras, números, guiones y barras.')
  }

  return [configured, ...segments.map((segment) => segment.replace(/^\/+|\/+$/g, ''))].join('/')
}

function dataUrlByteLength(dataUrl: string) {
  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1).replace(/[\r\n]/g, '')
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  return Math.floor((encoded.length * 3) / 4) - padding
}

export function assertSupportedImageDataUrl(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !imageDataUrlPattern.test(value)) {
    throw new Error('La imagen debe ser JPG, PNG, WEBP, GIF o AVIF en formato válido.')
  }

  if (dataUrlByteLength(value) > MAX_IMAGE_BYTES) {
    throw new Error('La imagen supera el límite de 3 MB.')
  }
}

export async function uploadImageDataUrl(dataUrl: string, options: UploadOptions) {
  assertSupportedImageDataUrl(dataUrl)
  const config = getCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signedParameters = {
    folder: options.folder,
    overwrite: String(options.overwrite ?? false),
    public_id: options.publicId ?? randomUUID(),
    timestamp,
  }
  const signaturePayload = Object.entries(signedParameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  const signature = createHash('sha1').update(`${signaturePayload}${config.api_secret}`).digest('hex')
  const body = new FormData()

  body.set('file', dataUrl)
  body.set('api_key', config.api_key)
  body.set('signature', signature)
  Object.entries(signedParameters).forEach(([key, value]) => body.set(key, value))

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloud_name)}/image/upload`, {
    method: 'POST',
    body,
  })
  const result = await response.json().catch(() => null) as { secure_url?: unknown } | null

  if (!response.ok || !result || typeof result.secure_url !== 'string') {
    throw new Error('Cloudinary no devolvió una URL segura para la imagen.')
  }

  return result.secure_url
}
