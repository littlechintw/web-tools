// Small canvas / image helpers shared by the image and PDF tools.

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image failed to load'))
    img.src = src
  })
}

/** Encode a canvas. `quality` is ignored for PNG. */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas encode failed'))),
      type,
      type === 'image/png' ? undefined : quality,
    )
  })
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : '')
    fr.onerror = () => reject(fr.error ?? new Error('read failed'))
    fr.readAsDataURL(file)
  })
}

/** File extension for a MIME type ("image/jpeg" → "jpg"). */
export function extensionForMime(mime: string): string {
  const sub = mime.split('/')[1] ?? ''
  return sub.replace('jpeg', 'jpg').replace('svg+xml', 'svg').replace(/^x-/, '') || 'bin'
}
