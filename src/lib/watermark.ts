// Placement maths for the image watermark tool. Every size is expressed
// relative to the target image's width so one set of settings fits an 800 px
// screenshot and a 6000 px photo alike; the canvas drawing lives in
// watermarkBrowser.ts so this half stays unit-testable in Node.

import { extensionForMime } from '@/utils/image'
import { stripExtension } from '@/utils/format'

export const LAYOUTS = ['tile', 'single'] as const
export type Layout = (typeof LAYOUTS)[number]

export const POSITIONS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const
export type Position = (typeof POSITIONS)[number]

export interface Point {
  x: number
  y: number
}

/** Upper bound on marks drawn per image so a tiny mark with no gap can't
 *  freeze the tab; the step is widened to stay under it. */
export const MAX_TILE_MARKS = 2000

/** Resolve a percentage of the image width to whole pixels (never below 1). */
export function pctToPx(pct: number, width: number): number {
  const v = Math.round((width * pct) / 100)
  return Math.max(1, Number.isFinite(v) ? v : 1)
}

/** Axis-aligned bounding box of a w×h rectangle rotated by `angleDeg`. */
export function rotatedBounds(w: number, h: number, angleDeg: number): { w: number; h: number } {
  const rad = (angleDeg * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const s = Math.abs(Math.sin(rad))
  return { w: w * c + h * s, h: w * s + h * c }
}

/**
 * Centre of a single mark in one of nine positions, `margin` px from the
 * edges. The rotated bounding box is used so a tilted mark stays inside the
 * image. Marks larger than the image are centred on the relevant axis.
 */
export function singlePlacement(
  width: number,
  height: number,
  markW: number,
  markH: number,
  angleDeg: number,
  position: Position,
  margin: number,
): Point {
  const box = rotatedBounds(markW, markH, angleDeg)
  const axis = (size: number, extent: number, where: 'start' | 'middle' | 'end'): number => {
    if (extent + margin * 2 >= size || where === 'middle') return size / 2
    return where === 'start' ? margin + extent / 2 : size - margin - extent / 2
  }
  const [v, h] = positionAxes(position)
  return { x: axis(width, box.w, h), y: axis(height, box.h, v) }
}

function positionAxes(position: Position): ['start' | 'middle' | 'end', 'start' | 'middle' | 'end'] {
  const vertical = position.startsWith('top') ? 'start' : position.startsWith('bottom') ? 'end' : 'middle'
  const horizontal = position.endsWith('left') ? 'start' : position.endsWith('right') ? 'end' : 'middle'
  return [vertical, horizontal]
}

/**
 * Mark centres for a tiled layout, in a frame rotated about the image centre
 * (the caller translates to the centre and rotates the canvas by the same
 * angle). Alternate rows are offset by half a step so the diagonals read
 * evenly, and the grid covers the image's circumscribed circle so no corner
 * is left bare at any angle.
 */
export function tilePlacements(width: number, height: number, markW: number, markH: number, gap: number): Point[] {
  if (markW <= 0 || markH <= 0) return []
  const radius = Math.hypot(width, height) / 2
  let stepX = markW + Math.max(0, gap)
  let stepY = markH + Math.max(0, gap)
  const count = (sx: number, sy: number) => (2 * Math.ceil(radius / sx) + 3) * (2 * Math.ceil(radius / sy) + 3)
  if (count(stepX, stepY) > MAX_TILE_MARKS) {
    // The count is only roughly ∝ 1/step², so widen a little more until it fits.
    const k = Math.sqrt(count(stepX, stepY) / MAX_TILE_MARKS)
    stepX *= k
    stepY *= k
    while (count(stepX, stepY) > MAX_TILE_MARKS) {
      stepX *= 1.05
      stepY *= 1.05
    }
  }
  const nx = Math.ceil(radius / stepX) + 1
  const ny = Math.ceil(radius / stepY) + 1
  const points: Point[] = []
  for (let j = -ny; j <= ny; j++) {
    const offset = j % 2 ? stepX / 2 : 0
    for (let i = -nx; i <= nx; i++) points.push({ x: i * stepX + offset, y: j * stepY })
  }
  return points
}

export const OUTPUT_FORMATS = ['auto', 'image/png', 'image/jpeg', 'image/webp'] as const
export type OutputFormat = (typeof OUTPUT_FORMATS)[number]
export type OutputMime = Exclude<OutputFormat, 'auto'>

/** `auto` keeps PNG/JPEG/WEBP sources as they are and turns anything else
 *  (GIF, BMP, SVG, HEIC…) into PNG so transparency survives. */
export function resolveOutputType(sourceType: string, choice: OutputFormat): OutputMime {
  if (choice !== 'auto') return choice
  return sourceType === 'image/jpeg' || sourceType === 'image/webp' ? sourceType : 'image/png'
}

export function outputName(sourceName: string, mime: OutputMime): string {
  const base = stripExtension(sourceName) || 'image'
  return `${base}-watermarked.${extensionForMime(mime)}`
}
