/**
 * Validation for user-supplied receipt/place photos.
 *
 * Images travel as data URLs, which means arbitrary text can be pasted into the
 * field. Checking the declared MIME type is not enough: a caller can label
 * anything `image/png`. So every attachment is verified against the real magic
 * bytes of the decoded payload, and formats that can carry script (SVG) or
 * arbitrary markup are rejected outright.
 */

/** Raster formats only. SVG is excluded on purpose: it can execute script. */
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export type AllowedImageMimeType = typeof ALLOWED_IMAGE_MIME_TYPES[number]

/** Roughly 4 MB of binary once base64 overhead is removed. */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024
export const MAX_ATTACHMENTS_PER_TRANSACTION = 5
export const MAX_PLACE_LENGTH = 120

const DATA_URL_PATTERN = /^data:([a-z]+\/[a-z0-9+.-]+);base64,([A-Za-z0-9+/]+={0,2})$/

/** Leading bytes that identify each accepted format. */
const MAGIC_BYTES: Record<AllowedImageMimeType, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
  // RIFF....WEBP - the middle four bytes are the file size, so they vary.
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Minimal base64 decoder for runtimes without atob. */
function decodeBase64WithoutAtob(input: string): string | null {
  let bits = 0
  let accumulator = 0
  let output = ''

  for (const char of input.replace(/=+$/, '')) {
    const index = BASE64_ALPHABET.indexOf(char)
    if (index === -1) return null
    accumulator = (accumulator << 6) | index
    bits += 6
    if (bits >= 8) {
      bits -= 8
      output += String.fromCharCode((accumulator >> bits) & 0xff)
    }
  }

  return output
}

function decodeBase64Prefix(base64: string, byteCount: number): number[] | null {
  // Only the header is needed, so decode a small slice rather than the file.
  const charsNeeded = Math.ceil(byteCount / 3) * 4
  const slice = base64.slice(0, charsNeeded)

  try {
    // atob in the browser; the Node global is reached without pulling in its
    // types, since this package is also bundled for the web.
    const decode = (globalThis as { atob?: (input: string) => string }).atob
    const binary = typeof decode === 'function'
      ? decode(slice)
      : decodeBase64WithoutAtob(slice)
    if (binary === null) return null
    return [...binary.slice(0, byteCount)].map((char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

function matchesMagicBytes(mime: AllowedImageMimeType, base64: string) {
  const signatures = MAGIC_BYTES[mime]
  const longest = Math.max(...signatures.map((signature) => signature.length))
  const header = decodeBase64Prefix(base64, Math.max(longest, 12))
  if (!header) return false

  const matches = signatures.some(
    (signature) => signature.every((byte, index) => header[index] === byte),
  )
  if (!matches) return false

  // WEBP additionally carries its format tag at offset 8.
  if (mime === 'image/webp') {
    const tag = [0x57, 0x45, 0x42, 0x50]
    return tag.every((byte, index) => header[8 + index] === byte)
  }

  return true
}

/** Byte length of a base64 payload, without decoding all of it. */
export function getBase64ByteLength(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

export interface AttachmentValidationResult {
  valid: boolean
  /** Message meant to be shown to the user, in Spanish. */
  error?: string
}

/**
 * Accepts only a base64 data URL whose declared type is an allowed raster image
 * AND whose decoded bytes actually start with that format's signature.
 */
export function validateImageDataUrl(value: unknown): AttachmentValidationResult {
  if (typeof value !== 'string' || value.length === 0) {
    return { valid: false, error: 'El archivo no es válido.' }
  }

  const match = DATA_URL_PATTERN.exec(value)
  if (!match) {
    return { valid: false, error: 'Solo se permiten imágenes. Ese archivo no lo es.' }
  }

  const [, mime, base64] = match

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime as AllowedImageMimeType)) {
    return { valid: false, error: 'Formato no permitido. Usa JPG, PNG, WEBP o GIF.' }
  }

  if (getBase64ByteLength(base64) > MAX_ATTACHMENT_BYTES) {
    return { valid: false, error: 'La imagen supera los 4 MB.' }
  }

  // The decisive check: the bytes must match the format they claim to be, so a
  // renamed script or document cannot pass as a picture.
  if (!matchesMagicBytes(mime as AllowedImageMimeType, base64)) {
    return { valid: false, error: 'El archivo no es una imagen real.' }
  }

  return { valid: true }
}

export function isValidImageDataUrl(value: unknown) {
  return validateImageDataUrl(value).valid
}

/** Drops anything that does not pass validation, keeping the rest. */
export function sanitizeAttachments(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return values
    .filter((value): value is string => isValidImageDataUrl(value))
    .slice(0, MAX_ATTACHMENTS_PER_TRANSACTION)
}

/** Trims and caps the free-text place, stripping control characters. */
export function sanitizePlace(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value
    // Strip control characters, then collapse whitespace.
    .split('')
    .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned ? cleaned.slice(0, MAX_PLACE_LENGTH) : undefined
}

/** Payments default to cash, which is how existing records are shown. */
export function isCashPayment(entry: { isCash?: boolean }) {
  return entry.isCash !== false
}
