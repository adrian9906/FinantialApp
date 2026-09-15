export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024

function readFile(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se pudo leer la foto.'))
    reader.onerror = () => reject(new Error('No se pudo leer la foto. Intenta seleccionarla de nuevo.'))
    reader.onabort = () => reject(new Error('La lectura de la foto se canceló.'))
    reader.readAsDataURL(file)
  })
}

/** Keep small originals; resize oversized camera photos before sending JSON. */
export async function preparePurchasePhoto(file: File): Promise<string> {
  if (file.size <= MAX_UPLOAD_BYTES) return readFile(file)
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Esta imagen supera 3 MB. Usa una versión más pequeña en JPG, PNG o WEBP.')
  }
  const source = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('No se pudo abrir la foto. Usa JPG, PNG o WEBP.'))
      image.src = source
    })
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la foto en este dispositivo.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error('No se pudo reducir la foto a 3 MB. Elige una imagen más pequeña.')
    return readFile(blob)
  } finally {
    URL.revokeObjectURL(source)
  }
}
