/** Helpers for the screen colour / banding tester. */

export const SOLID_COLORS = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#808080'] as const

/** Wrap-around index step. */
export function cycleIndex(i: number, delta: number, len: number): number {
  if (len <= 0) return 0
  return (((i + delta) % len) + len) % len
}

export function isHexColor(s: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(s)
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0')
export const grayHex = (level: number) => '#' + hex2(Math.min(255, Math.max(0, level))).repeat(3)

/** `steps` evenly spaced gray levels from 0 to 255 inclusive (steps >= 2). */
export function grayRamp(steps: number): { level: number; hex: string }[] {
  const n = Math.max(2, Math.floor(steps))
  return Array.from({ length: n }, (_, i) => {
    const level = Math.round((i * 255) / (n - 1))
    return { level, hex: grayHex(level) }
  })
}

/** Pick black or white text for legibility on a gray level (WCAG-ish midpoint on sRGB value). */
export const textOnGray = (level: number) => (level < 128 ? '#ffffff' : '#000000')
