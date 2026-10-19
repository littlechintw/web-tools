// Browser-only halves of the PDF compressor: the canvas JPEG encoder used to
// re-encode embedded images, and the "flatten every page to a JPEG" fallback
// built on pdf.js + pdf-lib.
import { PDFDocument } from '@cantoo/pdf-lib'
import { getDocument } from '@/utils/pdfjs'
import type { ImageEncoder, ProgressFn, RasterSettings } from '@/lib/pdfCompress'

/** Refuse to allocate canvases beyond this many pixels (≈ 200 MB of RGBA). */
const MAX_CANVAS_PIXELS = 50_000_000

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG encode failed'))), 'image/jpeg', quality)
  })
}

/** Re-encode a decoded image as JPEG at the requested size via canvas. */
export const canvasJpegEncoder: ImageEncoder = async (img, width, height, quality) => {
  if (width * height > MAX_CANVAS_PIXELS) return null
  const options: ImageBitmapOptions = {
    // PDF ignores EXIF orientation and embedded ICC profiles are the viewer's
    // business; decode the raw pixels exactly as stored.
    imageOrientation: 'none',
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  }
  if (width !== img.width || height !== img.height) {
    options.resizeWidth = width
    options.resizeHeight = height
    options.resizeQuality = 'high'
  }
  const source: ImageBitmapSource =
    img.kind === 'jpeg'
      ? new Blob([img.bytes as BlobPart], { type: 'image/jpeg' })
      : new ImageData(img.data, img.width, img.height)
  const bitmap = await createImageBitmap(source, options)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0)
    const blob = await canvasToJpeg(canvas, quality)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    canvas.width = canvas.height = 0
    return { bytes, width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}

export interface RasterizeOptions extends RasterSettings {
  password?: string
}

/** Render every page to a JPEG and rebuild the PDF from those images. Highest
 *  compression, but text/vectors are flattened. */
export async function rasterizePdf(
  src: Uint8Array,
  opts: RasterizeOptions,
  onProgress?: ProgressFn,
): Promise<Uint8Array> {
  // pdf.js transfers the buffer to its worker, so hand it a copy.
  const pdf = await getDocument({ data: src.slice(), password: opts.password }).promise
  try {
    const out = await PDFDocument.create({ updateMetadata: false })
    const total = pdf.numPages
    for (let n = 1; n <= total; n++) {
      onProgress?.({ phase: 'pages', done: n - 1, total })
      const page = await pdf.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const vp = page.getViewport({ scale: opts.dpi / 72 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(vp.width)
      canvas.height = Math.ceil(vp.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise
      const blob = await canvasToJpeg(canvas, opts.quality)
      canvas.width = canvas.height = 0
      const jpg = await out.embedJpg(await blob.arrayBuffer())
      const dest = out.addPage([base.width, base.height])
      dest.drawImage(jpg, { x: 0, y: 0, width: base.width, height: base.height })
      page.cleanup()
    }
    onProgress?.({ phase: 'saving', done: total, total })
    return await out.save({ useObjectStreams: true })
  } finally {
    void pdf.loadingTask.destroy()
  }
}
