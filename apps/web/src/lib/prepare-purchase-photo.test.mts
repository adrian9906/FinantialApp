import assert from 'node:assert/strict'
import { preparePurchasePhoto, MAX_UPLOAD_BYTES } from './prepare-purchase-photo.ts'

const originalReader = globalThis.FileReader
class Reader {
  result: string | null = null
  onload?: () => void
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((data) => {
      this.result = `data:${blob.type};base64,${Buffer.from(data).toString('base64')}`
      this.onload?.()
    })
  }
}
globalThis.FileReader = Reader as unknown as typeof FileReader
try {
  const small = new File([new Uint8Array([255, 216, 255])], 'photo.jpg', { type: 'image/jpeg' })
  assert.equal(await preparePurchasePhoto(small), 'data:image/jpeg;base64,/9j/')
  const largeGif = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'animated.gif', { type: 'image/gif' })
  await assert.rejects(preparePurchasePhoto(largeGif), /supera 3 MB/)
  const originalImage = globalThis.Image
  const originalDocument = globalThis.document
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  let revoked = false
  class FakeImage {
    naturalWidth = 4000
    naturalHeight = 3000
    onload?: () => void
    set src(_value: string) { queueMicrotask(() => this.onload?.()) }
  }
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }),
    toBlob: (callback: (blob: Blob) => void) => callback(new Blob([new Uint8Array([255, 216, 255])], { type: 'image/jpeg' })),
  }
  try {
    globalThis.Image = FakeImage as unknown as typeof Image
    globalThis.document = { createElement: () => canvas } as unknown as Document
    URL.createObjectURL = () => 'blob:test'
    URL.revokeObjectURL = () => { revoked = true }
    const large = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'camera.jpg', { type: 'image/jpeg' })
    assert.equal(await preparePurchasePhoto(large), 'data:image/jpeg;base64,/9j/')
    assert.equal(canvas.width, 1600)
    assert.equal(canvas.height, 1200)
    assert.equal(revoked, true)
  } finally {
    globalThis.Image = originalImage
    globalThis.document = originalDocument
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  }
  console.log('Photo preparation: original preservation, large-file handling, resize and cleanup passed')
} finally {
  globalThis.FileReader = originalReader
}
