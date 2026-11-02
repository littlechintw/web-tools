import { describe, it, expect } from 'vitest'
import { contrastRatio, parseColor, suggestForeground, toHex, wcagResults, relativeLuminance } from '@/lib/colorContrast'

const W = { r: 255, g: 255, b: 255 }
const K = { r: 0, g: 0, b: 0 }

describe('parseColor', () => {
  it('parses hex forms', () => {
    expect(parseColor('#fff')).toEqual(W)
    expect(parseColor('767676')).toEqual({ r: 118, g: 118, b: 118 })
    expect(parseColor('#ff000080')).toEqual({ r: 255, g: 0, b: 0 })
    expect(parseColor('#f00a')).toEqual({ r: 255, g: 0, b: 0 })
  })
  it('parses rgb and hsl', () => {
    expect(parseColor('rgb(0, 128, 255)')).toEqual({ r: 0, g: 128, b: 255 })
    expect(parseColor('rgb(0 0 0 / 50%)')).toEqual(K)
    expect(parseColor('rgb(100%, 0%, 0%)')).toEqual({ r: 255, g: 0, b: 0 })
    expect(parseColor('hsl(120, 100%, 25%)')).toEqual({ r: 0, g: 128, b: 0 })
    expect(parseColor('hsl(0 0% 100%)')).toEqual(W)
    expect(parseColor('hsl(240deg, 100%, 50%)')).toEqual({ r: 0, g: 0, b: 255 })
  })
  it('parses names and rejects junk', () => {
    expect(parseColor('White')).toEqual(W)
    expect(parseColor('')).toBeNull()
    expect(parseColor('#12')).toBeNull()
    expect(parseColor('#ggg')).toBeNull()
    expect(parseColor('rgb(1,2)')).toBeNull()
    expect(parseColor('banana')).toBeNull()
  })
})

describe('contrast', () => {
  it('black on white is 21 and symmetric', () => {
    expect(contrastRatio(K, W)).toBeCloseTo(21, 10)
    expect(contrastRatio(W, K)).toBeCloseTo(21, 10)
    expect(contrastRatio(W, W)).toBe(1)
  })
  it('known grays', () => {
    expect(contrastRatio(parseColor('#777')!, W)).toBeCloseTo(4.478, 2)
    expect(contrastRatio(parseColor('#767676')!, W)).toBeCloseTo(4.542, 2)
  })
  it('luminance extremes', () => {
    expect(relativeLuminance(K)).toBe(0)
    expect(relativeLuminance(W)).toBeCloseTo(1, 10)
  })
  it('thresholds', () => {
    expect(wcagResults(4.478)).toEqual({ aaNormal: false, aaaNormal: false, aaLarge: true, aaaLarge: false, ui: true })
    expect(wcagResults(7).aaaNormal).toBe(true)
    expect(wcagResults(2.9).ui).toBe(false)
  })
})

describe('suggestForeground', () => {
  it('keeps passing colours', () => {
    expect(suggestForeground(K, W)).toEqual(K)
  })
  it('darkens #777 on white to #767676-ish', () => {
    const s = suggestForeground(parseColor('#777')!, W)!
    expect(contrastRatio(s, W)).toBeGreaterThanOrEqual(4.5)
    expect(toHex(s)).toMatch(/^#7[0-6]7[0-6]7[0-6]$/)
  })
  it('lightens on dark backgrounds', () => {
    const bg = parseColor('#111')!
    const s = suggestForeground(parseColor('#444')!, bg, 7)!
    expect(contrastRatio(s, bg)).toBeGreaterThanOrEqual(7)
    expect(s.r).toBeGreaterThan(0x44)
  })
  it('returns null when impossible', () => {
    expect(suggestForeground(parseColor('#808080')!, parseColor('#808080')!, 22)).toBeNull()
  })
})
