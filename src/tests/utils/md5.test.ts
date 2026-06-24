import { describe, it, expect } from 'vitest'
import { md5 } from '@/utils/md5'

// RFC 1321 test vectors
describe('md5', () => {
  it('empty string', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
  })

  it('"a"', () => {
    expect(md5('a')).toBe('0cc175b9c0f1b6a831c399e269772661')
  })

  it('"abc"', () => {
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  it('"message digest"', () => {
    expect(md5('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0')
  })

  it('alphabet a-z', () => {
    expect(md5('abcdefghijklmnopqrstuvwxyz')).toBe('c3fcd3d76192e4007dfb496cca67e13b')
  })

  it('alphanumeric', () => {
    expect(md5('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')).toBe(
      'd174ab98d277d9f5a5611c2c9f419d9f',
    )
  })

  it('accepts ArrayBuffer', () => {
    const buf = new TextEncoder().encode('abc').buffer as ArrayBuffer
    expect(md5(buf)).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  it('accepts Uint8Array', () => {
    const bytes = new TextEncoder().encode('abc')
    expect(md5(bytes)).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  it('output is always 32 hex chars', () => {
    for (const s of ['', 'x', 'hello world', 'a'.repeat(1000)]) {
      expect(md5(s)).toMatch(/^[0-9a-f]{32}$/)
    }
  })

  it('is deterministic', () => {
    expect(md5('hello')).toBe(md5('hello'))
  })
})
