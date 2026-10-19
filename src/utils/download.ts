// Trigger browser downloads without leaking object URLs.

function clickAnchor(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Download a Blob under the given filename. The object URL is revoked once
 *  the browser has had a chance to start the download. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  clickAnchor(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob([text], { type: mime }), filename)
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime = 'application/octet-stream'): void {
  downloadBlob(new Blob([bytes as BlobPart], { type: mime }), filename)
}

/** Download an existing URL (data: URL or an object URL the caller manages). */
export function downloadUrl(url: string, filename: string): void {
  clickAnchor(url, filename)
}

/** Download several files one after another. Firing them all at once trips
 *  the browser's multiple-download throttle and silently drops most of them. */
export async function downloadSequentially(
  items: Array<{ blob?: Blob; url?: string; filename: string }>,
  delayMs = 300,
): Promise<void> {
  for (const [i, item] of items.entries()) {
    if (item.blob) downloadBlob(item.blob, item.filename)
    else if (item.url) downloadUrl(item.url, item.filename)
    if (i < items.length - 1) await new Promise((r) => setTimeout(r, delayMs))
  }
}
