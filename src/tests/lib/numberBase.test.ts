import { describe, it, expect } from 'vitest'
import { parseToBigInt, bigIntToBase, convertAll } from '@/lib/numberBase'

describe('parseToBigInt()', () => {
  it('parses decimal', () => {
    expect(parseToBigInt('255', 10)).toBe(255n)
  })

  it('parses hex', () => {
    expect(parseToBigInt('ff', 16)).toBe(255n)
    expect(parseToBigInt('FF', 16)).toBe(255n)
  })

  it('parses binary', () => {
    expect(parseToBigInt('11111111', 2)).toBe(255n)
  })

  it('parses octal', () => {
    expect(parseToBigInt('377', 8)).toBe(255n)
  })

  it('parses zero', () => {
    expect(parseToBigInt('0', 10)).toBe(0n)
    expect(parseToBigInt('0', 2)).toBe(0n)
  })

  it('parses negative', () => {
    expect(parseToBigInt('-255', 10)).toBe(-255n)
    expect(parseToBigInt('-ff', 16)).toBe(-255n)
  })

  it('parses with leading +', () => {
    expect(parseToBigInt('+10', 10)).toBe(10n)
  })

  it('parses large number', () => {
    expect(parseToBigInt('ffffffffffffffff', 16)).toBe(18446744073709551615n)
  })

  it('parses base 36', () => {
    expect(parseToBigInt('z', 36)).toBe(35n)
    expect(parseToBigInt('10', 36)).toBe(36n)
  })

  it('throws on empty string', () => {
    expect(() => parseToBigInt('', 10)).toThrow('empty')
    expect(() => parseToBigInt('  ', 10)).toThrow('empty')
  })

  it('throws on invalid digit', () => {
    expect(() => parseToBigInt('g', 16)).toThrow('invalid digit')
    expect(() => parseToBigInt('2', 2)).toThrow('invalid digit')
    expect(() => parseToBigInt('8', 8)).toThrow('invalid digit')
  })
})

describe('bigIntToBase()', () => {
  it('converts to binary', () => {
    expect(bigIntToBase(255n, 2)).toBe('11111111')
  })

  it('converts to octal', () => {
    expect(bigIntToBase(255n, 8)).toBe('377')
  })

  it('converts to hex', () => {
    expect(bigIntToBase(255n, 16)).toBe('ff')
  })

  it('converts zero', () => {
    expect(bigIntToBase(0n, 2)).toBe('0')
    expect(bigIntToBase(0n, 16)).toBe('0')
  })

  it('converts negative', () => {
    expect(bigIntToBase(-255n, 16)).toBe('-ff')
    expect(bigIntToBase(-1n, 2)).toBe('-1')
  })

  it('converts base 36', () => {
    expect(bigIntToBase(35n, 36)).toBe('z')
    expect(bigIntToBase(36n, 36)).toBe('10')
  })

  it('round-trips through parseToBigInt', () => {
    for (const base of [2, 8, 10, 16, 36]) {
      const n = 1234567890n
      expect(parseToBigInt(bigIntToBase(n, base), base)).toBe(n)
    }
  })
})

describe('convertAll()', () => {
  it('converts 255 from decimal', () => {
    const r = convertAll('255', 10)
    expect(r).not.toBeNull()
    expect(r!.bin).toBe('11111111')
    expect(r!.oct).toBe('377')
    expect(r!.dec).toBe('255')
    expect(r!.hex).toBe('ff')
  })

  it('converts ff from hex', () => {
    const r = convertAll('ff', 16)
    expect(r!.dec).toBe('255')
    expect(r!.bin).toBe('11111111')
  })

  it('returns null on invalid input', () => {
    expect(convertAll('xyz', 10)).toBeNull()
    expect(convertAll('', 10)).toBeNull()
  })
})
