/** WCAG 2.x colour contrast helpers (framework-free). */

export interface Rgb {
  r: number
  g: number
  b: number
}

const NAMED: Record<string, string> = {
  black: '000000', white: 'ffffff', red: 'ff0000', lime: '00ff00', blue: '0000ff',
  yellow: 'ffff00', cyan: '00ffff', aqua: '00ffff', magenta: 'ff00ff', fuchsia: 'ff00ff',
  gray: '808080', grey: '808080', silver: 'c0c0c0', maroon: '800000', olive: '808000',
  green: '008000', purple: '800080', teal: '008080', navy: '000080', orange: 'ffa500',
  pink: 'ffc0cb', brown: 'a52a2a', gold: 'ffd700', indigo: '4b0082', violet: 'ee82ee',
  rebeccapurple: '663399', darkgray: 'a9a9a9', lightgray: 'd3d3d3', dimgray: '696969',
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function parseChannel(s: string): number | null {
  const m = /^([+-]?\d*\.?\d+)(%?)$/.exec(s)
  if (!m) return null
  const v = Number(m[1])
  return Math.round(clamp(m[2] ? (v / 100) * 255 : v, 0, 255))
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  // h in degrees, s and l in 0..100
  const hh = ((h % 360) + 360) % 360
  const ss = clamp(s, 0, 100) / 100
  const ll = clamp(l, 0, 100) / 100
  const k = (n: number) => (n + hh / 30) % 12
  const a = ss * Math.min(ll, 1 - ll)
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }
}

export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rr = r / 255, gg = g / 255, bb = b / 255
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l: l * 100 }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === rr) h = ((gg - bb) / d) % 6
  else if (max === gg) h = (bb - rr) / d + 2
  else h = (rr - gg) / d + 4
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 }
}

/** Parse hex (3/4/6/8 digits), rgb()/rgba(), hsl()/hsla() or a few named colours. Alpha is ignored. */
export function parseColor(input: string): Rgb | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  if (NAMED[s]) return parseColor('#' + NAMED[s])
  const hex = /^#?([0-9a-f]{3,8})$/.exec(s)
  if (hex && [3, 4, 6, 8].includes(hex[1].length)) {
    let h = hex[1]
    if (h.length <= 4) h = [...h].map((c) => c + c).join('')
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
  }
  const fn = /^(rgba?|hsla?)\(\s*([^)]*)\)$/.exec(s)
  if (!fn) return null
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean)
  if (parts.length < 3 || parts.length > 4) return null
  if (fn[1].startsWith('rgb')) {
    const c = parts.slice(0, 3).map(parseChannel)
    if (c.some((v) => v === null)) return null
    return { r: c[0]!, g: c[1]!, b: c[2]! }
  }
  const h = /^([+-]?\d*\.?\d+)(deg)?$/.exec(parts[0])
  const sat = /^(\d*\.?\d+)%?$/.exec(parts[1])
  const lig = /^(\d*\.?\d+)%?$/.exec(parts[2])
  if (!h || !sat || !lig) return null
  return hslToRgb(Number(h[1]), Number(sat[1]), Number(lig[1]))
}

export function toHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export interface WcagResult {
  aaNormal: boolean
  aaaNormal: boolean
  aaLarge: boolean
  aaaLarge: boolean
  ui: boolean
}

/** Thresholds are applied to the exact ratio (no rounding up). */
export function wcagResults(ratio: number): WcagResult {
  return { aaNormal: ratio >= 4.5, aaaNormal: ratio >= 7, aaLarge: ratio >= 3, aaaLarge: ratio >= 4.5, ui: ratio >= 3 }
}

/** Nearest foreground (same hue/saturation, minimal lightness change) reaching `target`; null if impossible. */
export function suggestForeground(fg: Rgb, bg: Rgb, target = 4.5): Rgb | null {
  if (contrastRatio(fg, bg) >= target) return fg
  const { h, s, l } = rgbToHsl(fg)
  for (let d = 0.25; d <= 100; d += 0.25) {
    const cands = [l - d, l + d]
      .filter((x) => x >= 0 && x <= 100)
      .map((x) => hslToRgb(h, s, x))
      .filter((c) => contrastRatio(c, bg) >= target)
    if (cands.length) {
      return cands.sort((x, y) => contrastRatio(y, bg) - contrastRatio(x, bg))[0]
    }
  }
  return null
}
