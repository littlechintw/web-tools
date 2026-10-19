import { describe, it, expect } from 'vitest'
import { base64ToBytes, bytesToBase64, bytesToHex, dataUrlToBytes } from '@/utils/bytes'

describe('bytes utils', () => {
  it('hex encodes with zero padding', () => {
    expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe('000fff')
    expect(bytesToHex(new Uint8Array([1, 2]).buffer)).toBe('0102')
  })

  it('base64 round-trips, including large inputs and url-safe mode', () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 251)
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big)
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf])
    expect(bytesToBase64(bytes)).toBe('+/+/')
    expect(bytesToBase64(bytes, true)).toBe('-_-_')
    expect(base64ToBytes('-_-_')).toEqual(bytes)
  })

  it('tolerates whitespace and missing padding when decoding', () => {
    const text = new TextDecoder().decode(base64ToBytes('aGVs\nbG8g d29y bGQ'))
    expect(text).toBe('hello world')
  })

  it('rejects invalid base64', () => {
    expect(() => base64ToBytes('@@@')).toThrow()
  })

  it('parses data URLs (base64 and percent-encoded)', () => {
    const b64 = dataUrlToBytes('data:image/png;base64,AQID')
    expect(b64.mime).toBe('image/png')
    expect([...b64.bytes]).toEqual([1, 2, 3])
    const plain = dataUrlToBytes('data:text/plain,hi%20there')
    expect(plain.mime).toBe('text/plain')
    expect(new TextDecoder().decode(plain.bytes)).toBe('hi there')
    expect(() => dataUrlToBytes('nope')).toThrow()
  })
})
