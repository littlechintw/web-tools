import { describe, it, expect } from 'vitest'
import { base32Decode, base32Encode, hotp, parseOtpauth, totp, type TotpAlgorithm } from '@/lib/totp'

const enc = (s: string) => new TextEncoder().encode(s)
const SEEDS: Record<TotpAlgorithm, string> = {
  'SHA-1': '12345678901234567890',
  'SHA-256': '12345678901234567890123456789012',
  'SHA-512': '1234567890123456789012345678901234567890123456789012345678901234',
}
// RFC 6238 Appendix B (8 digits, period 30)
const VECTORS: [number, string, string, string][] = [
  [59, '94287082', '46119246', '90693936'],
  [1111111109, '07081804', '68084774', '25091201'],
  [1111111111, '14050471', '67062674', '99943326'],
  [1234567890, '89005924', '91819424', '93441116'],
  [2000000000, '69279037', '90698825', '38618901'],
  [20000000000, '65353130', '77737706', '47863826'],
]

describe('RFC 6238 vectors', () => {
  const algos: TotpAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-512']
  for (const [i, algorithm] of algos.entries()) {
    it(algorithm, async () => {
      for (const v of VECTORS) {
        const code = await totp(enc(SEEDS[algorithm]), v[0], { algorithm, digits: 8, period: 30 })
        expect(code, `${algorithm} @ ${v[0]}`).toBe(v[i + 1])
      }
    })
  }
  it('6-digit code is the tail of the 8-digit code', async () => {
    expect(await totp(enc(SEEDS['SHA-1']), 59, { algorithm: 'SHA-1', digits: 6, period: 30 })).toBe('287082')
  })
})

describe('RFC 4226 HOTP vectors', () => {
  it('counters 0..2', async () => {
    const exp = ['755224', '287082', '359152']
    for (const [c, e] of exp.entries()) expect(await hotp(enc(SEEDS['SHA-1']), c, 'SHA-1', 6)).toBe(e)
  })
  it('returns null for an empty key', async () => {
    expect(await hotp(new Uint8Array(0), 0, 'SHA-1', 6)).toBeNull()
  })
})

describe('base32', () => {
  it('RFC 4648 vectors', () => {
    expect(base32Encode(enc('foobar'))).toBe('MZXW6YTBOI======')
    expect(base32Encode(enc('f'))).toBe('MY======')
    expect(new TextDecoder().decode(base32Decode('MZXW6YTBOI======')!)).toBe('foobar')
  })
  it('tolerates spaces, lowercase, dashes and missing padding', () => {
    expect(new TextDecoder().decode(base32Decode('mzxw 6ytb-oi')!)).toBe('foobar')
  })
  it('rejects invalid input', () => {
    expect(base32Decode('')).toBeNull()
    expect(base32Decode('abc1')).toBeNull()
    expect(base32Decode('A')).toBeNull()
    expect(base32Decode('MZXW6!')).toBeNull()
  })
  it('decodes the RFC seed from its base32 form', () => {
    expect(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')).toEqual(enc('12345678901234567890'))
  })
})

describe('parseOtpauth', () => {
  it('parses a full URI', () => {
    const r = parseOtpauth('otpauth://totp/ACME%20Co:john@example.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=ACME%20Co&algorithm=SHA256&digits=8&period=60')
    expect(r).toEqual({
      secret: 'HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ',
      label: 'ACME Co:john@example.com',
      issuer: 'ACME Co',
      algorithm: 'SHA-256',
      digits: 8,
      period: 60,
    })
  })
  it('applies defaults and rejects non-TOTP', () => {
    expect(parseOtpauth('otpauth://totp/x?secret=ABCD')).toMatchObject({ algorithm: 'SHA-1', digits: 6, period: 30 })
    expect(parseOtpauth('otpauth://hotp/x?secret=ABCD')).toBeNull()
    expect(parseOtpauth('otpauth://totp/x')).toBeNull()
    expect(parseOtpauth('JBSWY3DPEHPK3PXP')).toBeNull()
  })
})
