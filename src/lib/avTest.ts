/** Pure helpers for the microphone / camera tester. */

/** RMS and peak (0..1) of an 8-bit time-domain buffer from AnalyserNode.getByteTimeDomainData (128 = silence). */
export function levelFromTimeDomain(data: ArrayLike<number>): { rms: number; peak: number } {
  const n = data.length
  if (!n) return { rms: 0, peak: 0 }
  let sum = 0
  let peak = 0
  for (let i = 0; i < n; i++) {
    const v = (data[i] - 128) / 128
    sum += v * v
    const a = Math.abs(v)
    if (a > peak) peak = a
  }
  return { rms: Math.sqrt(sum / n), peak: Math.min(1, peak) }
}

/** Linear amplitude (0..1) to dBFS, floored at `floor` (default -100). */
export function toDb(level: number, floor = -100): number {
  if (!(level > 0)) return floor
  return Math.max(floor, 20 * Math.log10(level))
}

/** Peak-hold: jump up instantly, otherwise decay by `decayPerSec` (linear units/s). */
export function peakHold(prev: number, current: number, dtSec: number, decayPerSec = 0.5): number {
  return Math.max(current, prev - decayPerSec * Math.max(0, dtSec), 0)
}

export type MediaErrorKind = 'denied' | 'noDevice' | 'inUse' | 'unsupported' | 'other'

/** Classify a getUserMedia failure by DOMException name. */
export function classifyMediaError(err: unknown): MediaErrorKind {
  const name = typeof err === 'object' && err && 'name' in err ? String((err as { name: unknown }).name) : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'denied'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'noDevice'
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'inUse'
    case 'TypeError':
      return 'unsupported'
    default:
      return 'other'
  }
}
