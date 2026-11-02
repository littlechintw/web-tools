import { describe, it, expect } from 'vitest'
import { classifyMediaError, levelFromTimeDomain, peakHold, toDb } from '@/lib/avTest'

describe('levelFromTimeDomain', () => {
  it('silence', () => {
    expect(levelFromTimeDomain(new Uint8Array(64).fill(128))).toEqual({ rms: 0, peak: 0 })
  })
  it('empty buffer', () => {
    expect(levelFromTimeDomain([])).toEqual({ rms: 0, peak: 0 })
  })
  it('full-scale square wave has rms = peak = 1 (clamped)', () => {
    const d = Uint8Array.from({ length: 8 }, (_, i) => (i % 2 ? 0 : 255))
    const r = levelFromTimeDomain(d)
    expect(r.peak).toBeCloseTo(1, 1)
    expect(r.rms).toBeCloseTo(1, 1)
  })
  it('half-amplitude square wave', () => {
    const d = [192, 64, 192, 64]
    const r = levelFromTimeDomain(d)
    expect(r.rms).toBeCloseTo(0.5, 10)
    expect(r.peak).toBeCloseTo(0.5, 10)
  })
  it('single spike: peak high, rms low', () => {
    const d = new Array(100).fill(128)
    d[3] = 255
    const r = levelFromTimeDomain(d)
    expect(r.peak).toBeCloseTo(127 / 128, 10)
    expect(r.rms).toBeCloseTo(Math.sqrt(((127 / 128) ** 2) / 100), 10)
  })
})

describe('toDb / peakHold', () => {
  it('dB values', () => {
    expect(toDb(1)).toBe(0)
    expect(toDb(0.5)).toBeCloseTo(-6.0206, 3)
    expect(toDb(0)).toBe(-100)
    expect(toDb(1e-9)).toBe(-100)
    expect(toDb(NaN)).toBe(-100)
  })
  it('holds, decays and floors at zero', () => {
    expect(peakHold(0.2, 0.8, 0.1)).toBe(0.8)
    expect(peakHold(0.8, 0.1, 0.2)).toBeCloseTo(0.7, 10)
    expect(peakHold(0.1, 0, 10)).toBe(0)
    expect(peakHold(0.5, 0.1, -1)).toBe(0.5)
  })
})

describe('classifyMediaError', () => {
  it('maps names', () => {
    expect(classifyMediaError({ name: 'NotAllowedError' })).toBe('denied')
    expect(classifyMediaError({ name: 'NotFoundError' })).toBe('noDevice')
    expect(classifyMediaError({ name: 'NotReadableError' })).toBe('inUse')
    expect(classifyMediaError({ name: 'TypeError' })).toBe('unsupported')
    expect(classifyMediaError(new Error('x'))).toBe('other')
    expect(classifyMediaError(null)).toBe('other')
  })
})
