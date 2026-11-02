/** Serialisation of CSS gradients and box-shadows (framework-free). */

export interface ColorStop {
  /** #rrggbb */
  color: string
  /** 0..1 */
  alpha: number
  /** 0..100 (percent) */
  pos: number
}

export type GradientKind = 'linear' | 'radial' | 'conic'

export interface GradientSpec {
  kind: GradientKind
  /** degrees; linear direction or conic start angle */
  angle: number
  /** radial shape */
  shape: 'circle' | 'ellipse'
  /** centre for radial/conic, percent */
  cx: number
  cy: number
  stops: ColorStop[]
}

export interface ShadowLayer {
  x: number
  y: number
  blur: number
  spread: number
  color: string
  alpha: number
  inset: boolean
}

const num = (n: number) => String(Math.round((Number.isFinite(n) ? n : 0) * 100) / 100)

/** Alpha with at most 2 decimals, no trailing zeros ("0.5", "0.25", "1"). */
export function formatAlpha(a: number): string {
  const v = Math.min(1, Math.max(0, Number.isFinite(a) ? a : 1))
  return String(Math.round(v * 100) / 100)
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [0, 0, 0]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Opaque colours stay as lowercase hex; translucent ones become rgba(). */
export function colorWithAlpha(hex: string, alpha: number): string {
  const a = Math.min(1, Math.max(0, Number.isFinite(alpha) ? alpha : 1))
  const [r, g, b] = hexToRgb(hex)
  if (a >= 1) return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  return `rgba(${r}, ${g}, ${b}, ${formatAlpha(a)})`
}

/** Stable sort by position (equal positions keep their order, giving hard stops). */
export function sortStops(stops: ColorStop[]): ColorStop[] {
  return stops
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.pos - b.s.pos || a.i - b.i)
    .map((x) => x.s)
}

export function gradientCss(spec: GradientSpec): string {
  const list = sortStops(spec.stops).map((s) => `${colorWithAlpha(s.color, s.alpha)} ${num(Math.min(100, Math.max(0, s.pos)))}%`).join(', ')
  const at = `${num(spec.cx)}% ${num(spec.cy)}%`
  switch (spec.kind) {
    case 'linear':
      return `linear-gradient(${num(spec.angle)}deg, ${list})`
    case 'radial':
      return `radial-gradient(${spec.shape} at ${at}, ${list})`
    case 'conic':
      return `conic-gradient(from ${num(spec.angle)}deg at ${at}, ${list})`
  }
}

export function shadowCss(layers: ShadowLayer[]): string {
  if (!layers.length) return 'none'
  return layers
    .map((l) => {
      const parts = [num(l.x) + 'px', num(l.y) + 'px', num(Math.max(0, l.blur)) + 'px', num(l.spread) + 'px', colorWithAlpha(l.color, l.alpha)]
      // Per spec, the order is flexible; browsers serialise inset first.
      return (l.inset ? 'inset ' : '') + parts.join(' ')
    })
    .join(',\n    ')
}

export const backgroundDeclaration = (spec: GradientSpec) => `background: ${gradientCss(spec)};`
export const shadowDeclaration = (layers: ShadowLayer[]) => `box-shadow: ${shadowCss(layers)};`
