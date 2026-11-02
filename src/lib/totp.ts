/** RFC 4226 / 6238 one-time passwords. HMAC is delegated to WebCrypto. */

export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512'

export interface TotpOptions {
  algorithm: TotpAlgorithm
  digits: number
  period: number
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Decode RFC 4648 Base32. Ignores spaces, dashes, case and '=' padding. Returns null on invalid input. */
export function base32Decode(input: string): Uint8Array | null {
  const s = input.replace(/[\s-]+/g, '').replace(/=+$/, '').toUpperCase()
  if (!s) return null
  // A valid unpadded length never leaves 1, 3 or 6 stray characters mod 8.
  if ([1, 3, 6].includes(s.length % 8)) return null
  const out: number[] = []
  let bits = 0
  let value = 0
  for (const ch of s) {
    const idx = B32.indexOf(ch)
    if (idx < 0) return null
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out.push((value >>> bits) & 0xff)
      value &= (1 << bits) - 1
    }
  }
  return out.length ? new Uint8Array(out) : null
}

export function base32Encode(bytes: Uint8Array): string {
  let out = ''
  let bits = 0
  let value = 0
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      bits -= 5
      out += B32[(value >>> bits) & 31]
      value &= (1 << bits) - 1
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  while (out.length % 8) out += '='
  return out
}

/** HOTP value for a counter (RFC 4226 dynamic truncation). Returns null if the key is unusable. */
export async function hotp(key: Uint8Array, counter: number, algorithm: TotpAlgorithm, digits: number): Promise<string | null> {
  try {
    const msg = new Uint8Array(8)
    new DataView(msg.buffer).setBigUint64(0, BigInt(Math.max(0, Math.floor(counter))))
    const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: algorithm }, false, ['sign'])
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, msg))
    const off = mac[mac.length - 1] & 0x0f
    const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3]
    return String(bin % 10 ** digits).padStart(digits, '0')
  } catch {
    return null
  }
}

/** TOTP at `unixSeconds` (T0 = 0). */
export function totp(key: Uint8Array, unixSeconds: number, opts: TotpOptions): Promise<string | null> {
  return hotp(key, Math.floor(unixSeconds / opts.period), opts.algorithm, opts.digits)
}

export interface OtpauthInfo {
  secret: string
  label: string
  issuer: string
  algorithm: TotpAlgorithm
  digits: number
  period: number
}

/** Parse otpauth://totp/Label?secret=…&issuer=…&algorithm=…&digits=…&period=…; null if not a TOTP URI. */
export function parseOtpauth(uri: string): OtpauthInfo | null {
  const trimmed = uri.trim()
  if (!/^otpauth:\/\//i.test(trimmed)) return null
  let u: URL
  try {
    u = new URL(trimmed)
  } catch {
    return null
  }
  if (u.hostname.toLowerCase() !== 'totp') return null
  const secret = u.searchParams.get('secret')
  if (!secret) return null
  let label = ''
  try {
    label = decodeURIComponent(u.pathname.replace(/^\//, ''))
  } catch {
    label = u.pathname.replace(/^\//, '')
  }
  const algo = (u.searchParams.get('algorithm') ?? 'SHA1').toUpperCase().replace('-', '')
  const algorithm: TotpAlgorithm = algo === 'SHA256' ? 'SHA-256' : algo === 'SHA512' ? 'SHA-512' : 'SHA-1'
  const d = Number(u.searchParams.get('digits'))
  const p = Number(u.searchParams.get('period'))
  return {
    secret,
    label,
    issuer: u.searchParams.get('issuer') ?? (label.includes(':') ? label.split(':')[0].trim() : ''),
    algorithm,
    digits: d >= 6 && d <= 8 ? Math.floor(d) : 6,
    period: p > 0 && p <= 300 ? Math.floor(p) : 30,
  }
}
