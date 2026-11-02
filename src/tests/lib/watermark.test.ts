import { describe, it, expect } from 'vitest'
import {
  MAX_TILE_MARKS,
  outputName,
  pctToPx,
  resolveOutputType,
  rotatedBounds,
  singlePlacement,
  tilePlacements,
} from '@/lib/watermark'

describe('pctToPx()', () => {
  it('rounds and never returns less than 1px', () => {
    expect(pctToPx(10, 1234)).toBe(123)
    expect(pctToPx(0, 1234)).toBe(1)
    expect(pctToPx(Number.NaN, 1234)).toBe(1)
  })
})

describe('rotatedBounds()', () => {
  it('is the identity at 0° and swaps axes at 90°', () => {
    expect(rotatedBounds(100, 20, 0)).toEqual({ w: 100, h: 20 })
    const r = rotatedBounds(100, 20, 90)
    expect(r.w).toBeCloseTo(20)
    expect(r.h).toBeCloseTo(100)
  })
})

describe('singlePlacement()', () => {
  it('keeps the mark inside the image with the requested margin', () => {
    const c = singlePlacement(1000, 800, 200, 50, 0, 'bottom-right', 30)
    expect(c).toEqual({ x: 1000 - 30 - 100, y: 800 - 30 - 25 })
    expect(singlePlacement(1000, 800, 200, 50, 0, 'top-left', 30)).toEqual({ x: 130, y: 55 })
    expect(singlePlacement(1000, 800, 200, 50, 0, 'center', 30)).toEqual({ x: 500, y: 400 })
  })
  it('accounts for rotation so a tilted mark does not poke out', () => {
    const flat = singlePlacement(1000, 800, 400, 40, 0, 'bottom-right', 0)
    const tilted = singlePlacement(1000, 800, 400, 40, 45, 'bottom-right', 0)
    const box = rotatedBounds(400, 40, 45)
    // The tilted mark is pulled up so its (taller) bounding box stays inside.
    expect(tilted.y).toBeLessThan(flat.y)
    expect(tilted.x + box.w / 2).toBeLessThanOrEqual(1000 + 1e-9)
    expect(tilted.y + box.h / 2).toBeLessThanOrEqual(800 + 1e-9)
  })
  it('centres a mark that is wider than the image', () => {
    expect(singlePlacement(300, 300, 1000, 50, 0, 'left', 10).x).toBe(150)
  })
})

describe('tilePlacements()', () => {
  it('covers the whole image at any rotation', () => {
    const pts = tilePlacements(1000, 600, 200, 40, 50)
    const radius = Math.hypot(1000, 600) / 2
    const maxX = Math.max(...pts.map((p) => Math.abs(p.x)))
    const maxY = Math.max(...pts.map((p) => Math.abs(p.y)))
    expect(maxX).toBeGreaterThanOrEqual(radius)
    expect(maxY).toBeGreaterThanOrEqual(radius)
  })
  it('staggers alternate rows by half a step', () => {
    const pts = tilePlacements(1000, 600, 200, 40, 50)
    const row0 = pts.filter((p) => p.y === 0).map((p) => p.x)
    const row1 = pts.filter((p) => Math.abs(p.y - 90) < 1e-9).map((p) => p.x)
    expect(row0).toContain(0)
    expect(row1).toContain(125)
  })
  it('caps the number of marks for tiny marks and gaps', () => {
    expect(tilePlacements(4000, 4000, 2, 2, 0).length).toBeLessThanOrEqual(MAX_TILE_MARKS)
    expect(tilePlacements(1000, 600, 0, 40, 10)).toEqual([])
  })
})

describe('output naming', () => {
  it('keeps PNG/JPEG/WEBP in auto mode and falls back to PNG otherwise', () => {
    expect(resolveOutputType('image/jpeg', 'auto')).toBe('image/jpeg')
    expect(resolveOutputType('image/webp', 'auto')).toBe('image/webp')
    expect(resolveOutputType('image/gif', 'auto')).toBe('image/png')
    expect(resolveOutputType('image/png', 'image/jpeg')).toBe('image/jpeg')
  })
  it('suffixes the source name with the right extension', () => {
    expect(outputName('photo.HEIC', 'image/png')).toBe('photo-watermarked.png')
    expect(outputName('', 'image/jpeg')).toBe('image-watermarked.jpg')
  })
})
