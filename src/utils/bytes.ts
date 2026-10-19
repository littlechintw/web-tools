// Byte-string conversions used across the encode/crypto tools.

function toBytes(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

export function bytesToHex(data: Uint8Array | ArrayBuffer): string {
  const bytes = toBytes(data)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

export function bytesToBase64(data: Uint8Array | ArrayBuffer, urlSafe = false): string {
  const bytes = toBytes(data)
  let bin = ''
  // Chunked so huge inputs don't blow the argument limit of String.fromCharCode.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  const b64 = btoa(bin)
  return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64
}

/** Decode standard or URL-safe Base64; whitespace and missing padding are
 *  tolerated (MIME/PEM-wrapped input decodes fine). Throws on invalid input. */
export function base64ToBytes(b64: string): Uint8Array {
  let s = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Split a data: URL into its MIME type and decoded bytes. */
export function dataUrlToBytes(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const comma = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || comma === -1) throw new Error('Not a data URL')
  const header = dataUrl.slice(5, comma)
  const mime = header.split(';')[0] || 'application/octet-stream'
  const payload = dataUrl.slice(comma + 1)
  if (/;base64$/i.test(header)) return { mime, bytes: base64ToBytes(payload) }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(payload)) }
}
