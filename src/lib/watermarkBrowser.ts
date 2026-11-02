// Canvas half of the image watermark tool: paints text or a logo over an
// image using the placement maths in watermark.ts.

import { pctToPx, singlePlacement, tilePlacements, type Layout, type Position } from './watermark'

export interface TextMark {
  kind: 'text'
  text: string
  fontFamily: string
  bold: boolean
  color: string
  /** Font size as a percentage of the image width. */
  sizePct: number
}

export interface ImageMark {
  kind: 'image'
  image: HTMLImageElement
  /** Mark width as a percentage of the image width. */
  sizePct: number
}

export interface WatermarkOptions {
  mark: TextMark | ImageMark
  /** 0–1 */
  opacity: number
  /** Degrees; positive tilts the mark counter-clockwise (reads upward). */
  angle: number
  layout: Layout
  position: Position
  /** Space between tiled marks, as a percentage of the image width. */
  gapPct: number
  /** Distance from the edges for a single mark, as a percentage of the image width. */
  marginPct: number
}

interface Measured {
  w: number
  h: number
  /** Draw the mark centred on (cx, cy) of the current transform. */
  draw: (cx: number, cy: number) => void
}

function measureText(ctx: CanvasRenderingContext2D, mark: TextMark, width: number): Measured | null {
  const lines = mark.text.split('\n')
  if (!lines.some((l) => l.trim())) return null
  const px = pctToPx(mark.sizePct, width)
  ctx.font = `${mark.bold ? 'bold ' : ''}${px}px ${mark.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = mark.color
  const lineHeight = px * 1.2
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width))
  const h = lineHeight * lines.length
  return {
    w,
    h,
    draw: (cx, cy) => {
      const top = cy - h / 2 + lineHeight / 2
      lines.forEach((line, i) => ctx.fillText(line, cx, top + i * lineHeight))
    },
  }
}

function measureImage(ctx: CanvasRenderingContext2D, mark: ImageMark, width: number): Measured | null {
  const iw = mark.image.naturalWidth || mark.image.width
  const ih = mark.image.naturalHeight || mark.image.height
  if (!iw || !ih) return null
  const w = pctToPx(mark.sizePct, width)
  const h = (w * ih) / iw
  return { w, h, draw: (cx, cy) => ctx.drawImage(mark.image, cx - w / 2, cy - h / 2, w, h) }
}

/** Draw the watermark over an already-painted `width`×`height` context. */
export function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, opts: WatermarkOptions): void {
  ctx.save()
  try {
    const m =
      opts.mark.kind === 'text' ? measureText(ctx, opts.mark, width) : measureImage(ctx, opts.mark, width)
    if (!m) return
    ctx.globalAlpha = Math.min(1, Math.max(0, opts.opacity))
    // Canvas y points down, so a counter-clockwise tilt is a negative rotation.
    const rad = (-opts.angle * Math.PI) / 180
    if (opts.layout === 'tile') {
      ctx.translate(width / 2, height / 2)
      ctx.rotate(rad)
      const gap = (width * opts.gapPct) / 100
      for (const p of tilePlacements(width, height, m.w, m.h, gap)) m.draw(p.x, p.y)
    } else {
      const margin = (width * opts.marginPct) / 100
      const c = singlePlacement(width, height, m.w, m.h, opts.angle, opts.position, margin)
      ctx.translate(c.x, c.y)
      ctx.rotate(rad)
      m.draw(0, 0)
    }
  } finally {
    ctx.restore()
  }
}

/**
 * Paint `source` at `scale` (1 = full resolution) onto a fresh canvas and
 * watermark it. `background` fills behind the image for formats without
 * alpha (JPEG), otherwise transparency is preserved.
 */
export function renderWatermarked(
  source: HTMLImageElement,
  scale: number,
  opts: WatermarkOptions,
  background?: string,
): HTMLCanvasElement {
  const w = Math.max(1, Math.round(source.naturalWidth * scale))
  const h = Math.max(1, Math.round(source.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, w, h)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  drawWatermark(ctx, w, h, opts)
  return canvas
}
