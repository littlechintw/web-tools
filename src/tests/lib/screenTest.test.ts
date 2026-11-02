import { describe, it, expect } from 'vitest'
import { SOLID_COLORS, cycleIndex, grayHex, grayRamp, isHexColor, textOnGray } from '@/lib/screenTest'

describe('screenTest helpers', () => {
  it('cycles with wrap-around both ways', () => {
    expect(cycleIndex(0, -1, 7)).toBe(6)
    expect(cycleIndex(6, 1, 7)).toBe(0)
    expect(cycleIndex(2, 1, 7)).toBe(3)
    expect(cycleIndex(1, -15, 7)).toBe(0)
    expect(cycleIndex(3, 1, 0)).toBe(0)
  })
  it('validates hex colours', () => {
    expect(isHexColor('#a0B1c2')).toBe(true)
    expect(isHexColor('#fff')).toBe(false)
    expect(isHexColor('red')).toBe(false)
  })
  it('gray ramp endpoints and spacing', () => {
    const r = grayRamp(17)
    expect(r).toHaveLength(17)
    expect(r[0]).toEqual({ level: 0, hex: '#000000' })
    expect(r[16]).toEqual({ level: 255, hex: '#ffffff' })
    expect(r[8].level).toBe(128)
    expect(grayRamp(1)).toHaveLength(2)
  })
  it('grayHex clamps', () => {
    expect(grayHex(-5)).toBe('#000000')
    expect(grayHex(300)).toBe('#ffffff')
    expect(grayHex(16)).toBe('#101010')
  })
  it('text colour and base palette', () => {
    expect(textOnGray(10)).toBe('#ffffff')
    expect(textOnGray(200)).toBe('#000000')
    expect(SOLID_COLORS).toHaveLength(6)
  })
})
