import { describe, it, expect } from 'vitest'
import { backgroundDeclaration, colorWithAlpha, formatAlpha, gradientCss, shadowCss, shadowDeclaration, sortStops, type GradientSpec } from '@/lib/cssGen'

const base: GradientSpec = {
  kind: 'linear', angle: 90, shape: 'circle', cx: 50, cy: 50,
  stops: [
    { color: '#ff0000', alpha: 1, pos: 100 },
    { color: '#0000ff', alpha: 0.5, pos: 0 },
  ],
}

describe('alpha / colour', () => {
  it('formats alpha', () => {
    expect(formatAlpha(0.5)).toBe('0.5')
    expect(formatAlpha(0.123456)).toBe('0.12')
    expect(formatAlpha(1)).toBe('1')
    expect(formatAlpha(2)).toBe('1')
    expect(formatAlpha(-1)).toBe('0')
    expect(formatAlpha(NaN)).toBe('1')
  })
  it('keeps opaque as hex and translucent as rgba', () => {
    expect(colorWithAlpha('#FFF', 1)).toBe('#ffffff')
    expect(colorWithAlpha('#336699', 0.4)).toBe('rgba(51, 102, 153, 0.4)')
    expect(colorWithAlpha('#000000', 0)).toBe('rgba(0, 0, 0, 0)')
    expect(colorWithAlpha('nonsense', 1)).toBe('#000000')
  })
})

describe('gradients', () => {
  it('sorts stops by position, stable on ties', () => {
    const s = sortStops([
      { color: '#111111', alpha: 1, pos: 50 },
      { color: '#222222', alpha: 1, pos: 10 },
      { color: '#333333', alpha: 1, pos: 50 },
    ])
    expect(s.map((x) => x.color)).toEqual(['#222222', '#111111', '#333333'])
  })
  it('linear', () => {
    expect(gradientCss(base)).toBe('linear-gradient(90deg, rgba(0, 0, 255, 0.5) 0%, #ff0000 100%)')
  })
  it('radial and conic', () => {
    expect(gradientCss({ ...base, kind: 'radial', shape: 'ellipse', cx: 30, cy: 70 })).toBe(
      'radial-gradient(ellipse at 30% 70%, rgba(0, 0, 255, 0.5) 0%, #ff0000 100%)',
    )
    expect(gradientCss({ ...base, kind: 'conic', angle: 45.5 })).toBe(
      'conic-gradient(from 45.5deg at 50% 50%, rgba(0, 0, 255, 0.5) 0%, #ff0000 100%)',
    )
  })
  it('clamps positions and wraps declaration', () => {
    const css = backgroundDeclaration({ ...base, stops: [{ color: '#000', alpha: 1, pos: 150 }] })
    expect(css).toBe('background: linear-gradient(90deg, #000000 100%);')
  })
})

describe('shadows', () => {
  it('empty is none', () => {
    expect(shadowCss([])).toBe('none')
  })
  it('inset and multiple layers', () => {
    const css = shadowCss([
      { x: 0, y: 4, blur: 8, spread: 0, color: '#000000', alpha: 0.25, inset: false },
      { x: 1, y: -2, blur: -5, spread: 3, color: '#ffffff', alpha: 1, inset: true },
    ])
    expect(css).toBe('0px 4px 8px 0px rgba(0, 0, 0, 0.25),\n    inset 1px -2px 0px 3px #ffffff')
    expect(shadowDeclaration([])).toBe('box-shadow: none;')
  })
})
