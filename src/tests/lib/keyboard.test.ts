import { describe, it, expect } from 'vitest'
import { MAIN_LAYOUT, NAV_LAYOUT, describeEvent, formatEvent, isGap, keyDisplay, layoutCodes, locationName } from '@/lib/keyboard'

describe('labels', () => {
  it('names special keys', () => {
    expect(keyDisplay(' ')).toBe('Space')
    expect(keyDisplay('')).toBe('(empty)')
    expect(keyDisplay('a')).toBe('a')
    expect(keyDisplay('Enter')).toBe('Enter')
  })
  it('names locations', () => {
    expect([0, 1, 2, 3, 9].map(locationName)).toEqual(['standard', 'left', 'right', 'numpad', 'unknown'])
  })
  it('describes and formats events', () => {
    const i = describeEvent({ type: 'keydown', key: 'a', code: '', location: 0, keyCode: 65, repeat: undefined })
    expect(i).toEqual({ type: 'keydown', key: 'a', code: '(none)', location: 0, keyCode: 65, repeat: false })
    expect(formatEvent({ ...i, code: 'KeyA', repeat: true })).toBe('keydown key="a" code=KeyA location=0(standard) keyCode=65 repeat')
  })
})

describe('layout', () => {
  it('has unique codes', () => {
    const codes = layoutCodes()
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes).toContain('KeyA')
    expect(codes).toContain('Numpad0')
    expect(codes).toContain('F12')
  })
  it('main block rows are 15 units wide', () => {
    for (const row of MAIN_LAYOUT) {
      const w = row.reduce((s, i) => s + (isGap(i) ? i.gap : i.w), 0)
      expect(w).toBeCloseTo(15, 5)
    }
  })
  it('nav cluster rows fit in 3 units', () => {
    for (const row of NAV_LAYOUT) expect(row.reduce((s, i) => s + (isGap(i) ? i.gap : i.w), 0)).toBeLessThanOrEqual(3)
  })
})
