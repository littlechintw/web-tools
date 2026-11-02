import { describe, it, expect } from 'vitest'
import { businessSum, generateTestBusinessNo, generateTestId, validateBusinessNo, validateId } from '@/lib/tw-id'

describe('validateId (hand-computed checksums)', () => {
  it('A123456789: A=10 -> 1 + 0*9, then 8*1+7*2+6*3+5*4+4*5+3*6+2*7+1*8, +9 = 130', () => {
    expect(validateId('A123456789')).toEqual({ valid: true, kind: 'national', gender: 'male', reason: undefined })
  })
  it('F131104093 sum = 107 + 3 = 110', () => {
    expect(validateId('F131104093').valid).toBe(true)
  })
  it('is case-insensitive and trims', () => {
    expect(validateId(' a123456789 ').valid).toBe(true)
  })
  it('detects checksum errors', () => {
    const r = validateId('A123456788')
    expect(r.valid).toBe(false)
    expect(r.reason).toBe('checksum')
    expect(validateId('A223456789').valid).toBe(false)
  })
  it('female national ID', () => {
    // A=10 -> 1; gender 2*8=16; digits 0000000 -> 0; sum 17 + check -> check 3
    const r = validateId('A200000003')
    expect(r.valid).toBe(true)
    expect(r.gender).toBe('female')
  })
  it('new ARC: A800000014 (1 + 64 + 1 + 4 = 70)', () => {
    const r = validateId('A800000014')
    expect(r).toMatchObject({ valid: true, kind: 'arc-new', gender: 'male' })
    expect(validateId('A900000014').valid).toBe(false)
  })
  it('old ARC: AB23456789 (1 + 1*8 + 112 + 9 = 130)', () => {
    expect(validateId('AB23456789')).toMatchObject({ valid: true, kind: 'arc-old', gender: 'female' })
    expect(validateId('AB23456780').valid).toBe(false)
  })
  it('uses the irregular letter codes (I=34, O=35, W=32)', () => {
    // I=34 -> 3 + 36 = 39; 8*1 = 8; digits 0000000 -> 0; 47 + check -> check 3
    expect(validateId('I100000003').valid).toBe(true)
    // O=35 -> 3 + 45 = 48; +8 = 56 -> check 4
    expect(validateId('O100000004').valid).toBe(true)
    // W=32 -> 3 + 18 = 21; +8 = 29 -> check 1
    expect(validateId('W100000001').valid).toBe(true)
  })
  it('rejects bad formats without throwing', () => {
    for (const bad of ['', 'A12345678', 'A1234567890', '1234567890', 'A323456789', 'AE23456789', 'A12345678X', '😀'])
      expect(validateId(bad)).toMatchObject({ valid: false, reason: 'format' })
  })
})

describe('validateBusinessNo', () => {
  it('04595257: digit sums 0+8+5+9+5+4+2+7 = 40', () => {
    expect(businessSum('04595257')).toBe(40)
    expect(validateBusinessNo('04595257')).toEqual({ valid: true, legacyValid: true, reason: undefined })
  })
  it('rejects a non-multiple of 5', () => {
    // last digit 3 instead of 7 -> sum 36
    expect(validateBusinessNo('04595253')).toMatchObject({ valid: false, legacyValid: false, reason: 'checksum' })
  })
  it('7th digit = 7 special case: sum 29 passes via sum+1', () => {
    expect(businessSum('10458574')).toBe(29)
    expect(validateBusinessNo('10458574')).toMatchObject({ valid: true, legacyValid: true })
  })
  it('new divisor-5 rule accepts numbers the legacy rule rejects', () => {
    expect(businessSum('10458570')).toBe(25)
    expect(validateBusinessNo('10458570')).toMatchObject({ valid: true, legacyValid: false })
  })
  it('sum 26 with 7th digit 7 is invalid in both', () => {
    expect(businessSum('10458571')).toBe(26)
    expect(validateBusinessNo('10458571')).toMatchObject({ valid: false, legacyValid: false })
  })
  it('the +1 rule only applies when the 7th digit is 7', () => {
    // 04595254: 7th digit 5, sum 37 -> 37%5=2, and no +1 allowance (38%5=3 anyway); use 04595256: sum 39 -> 39+1=40 would pass if wrongly allowed
    expect(businessSum('04595256')).toBe(39)
    expect(validateBusinessNo('04595256').valid).toBe(false)
  })
  it('rejects bad formats', () => {
    for (const bad of ['', '1234567', '123456789', 'abcdefgh', '1234 567']) expect(validateBusinessNo(bad)).toMatchObject({ valid: false, reason: 'format' })
  })
})

describe('generators', () => {
  const seeded = (seed: number) => (max: number) => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return Math.floor((seed / 0x100000000) * max)
  }
  it('produce valid IDs of each kind', () => {
    const r = seeded(7)
    for (const kind of ['national', 'arc-new', 'arc-old'] as const) {
      for (let i = 0; i < 100; i++) {
        const id = generateTestId(kind, r)
        expect(id).toHaveLength(10)
        expect(validateId(id)).toMatchObject({ valid: true, kind })
      }
    }
  })
  it('produce valid business numbers under both rules', () => {
    const r = seeded(99)
    for (let i = 0; i < 200; i++) {
      const b = generateTestBusinessNo(r)
      expect(validateBusinessNo(b)).toMatchObject({ valid: true, legacyValid: true })
    }
  })
  it('default random source works', () => {
    expect(validateId(generateTestId('national')).valid).toBe(true)
    expect(validateBusinessNo(generateTestBusinessNo()).valid).toBe(true)
  })
})
