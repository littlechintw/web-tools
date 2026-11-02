/** Metronome / tuner maths. Pure and framework-free. */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export const BPM_MIN = 20
export const BPM_MAX = 300

export const clampBpm = (bpm: number) => (Number.isFinite(bpm) ? Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm))) : 120)

/** Fractional MIDI note number for a frequency (A4 = MIDI 69). */
export function freqToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4)
}

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12)
}

export interface NoteInfo {
  midi: number
  name: string // e.g. "A#"
  octave: number
  /** Offset from the nearest note, -50..+50. */
  cents: number
  /** Exact frequency of the nearest note. */
  target: number
}

export function freqToNote(freq: number, a4 = 440): NoteInfo | null {
  if (!(freq > 0) || !Number.isFinite(freq) || !(a4 > 0)) return null
  const exact = freqToMidi(freq, a4)
  const midi = Math.round(exact)
  return {
    midi,
    name: NOTE_NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    cents: (exact - midi) * 100,
    target: midiToFreq(midi, a4),
  }
}

/**
 * Tap tempo from tap timestamps (ms). Uses the trailing run of taps whose gaps
 * are all under `resetGapMs`, at most the last `maxTaps`. Needs 2+ taps.
 */
export function tapTempo(taps: readonly number[], maxTaps = 8, resetGapMs = 2000): number | null {
  let from = taps.length - 1
  while (from > 0 && taps[from] - taps[from - 1] > 0 && taps[from] - taps[from - 1] <= resetGapMs) from--
  const run = taps.slice(Math.max(from, taps.length - maxTaps))
  if (run.length < 2) return null
  const avg = (run[run.length - 1] - run[0]) / (run.length - 1)
  return avg > 0 ? clampBpm(60000 / avg) : null
}

export type Accent = 'strong' | 'medium' | 'weak'
export interface BeatEvent {
  time: number
  beat: number // 0-based within bar
  sub: number // 0-based within beat
  accent: Accent
}

/**
 * Lookahead scheduling plan: all ticks in [nextTime, now + lookahead).
 * `tickIndex` counts subdivision ticks since the start (so a mid-run change of
 * bpm/subdivision only affects the next tick's spacing).
 */
export function planBeats(
  nextTime: number, tickIndex: number, now: number, lookahead: number,
  bpm: number, beatsPerBar: number, subdivisions: number,
): { events: BeatEvent[]; nextTime: number; tickIndex: number } {
  const events: BeatEvent[] = []
  const subs = Math.max(1, Math.floor(subdivisions))
  const beats = Math.max(1, Math.floor(beatsPerBar))
  const step = 60 / clampBpm(bpm) / subs
  let t = nextTime
  let i = tickIndex
  while (t < now + lookahead) {
    const sub = i % subs
    const beat = Math.floor(i / subs) % beats
    events.push({ time: t, beat, sub, accent: sub !== 0 ? 'weak' : beat === 0 ? 'strong' : 'medium' })
    t += step
    i++
  }
  return { events, nextTime: t, tickIndex: i % (subs * beats) }
}

export interface Pitch {
  freq: number
  /** 1 = perfectly periodic, lower = noisier. */
  clarity: number
}

/**
 * YIN pitch detection (de Cheveigne & Kawahara, 2002), steps 1-5.
 * Returns null for silence / unpitched signals.
 */
export function detectPitch(
  buf: Float32Array, sampleRate: number,
  opts: { minFreq?: number; maxFreq?: number; threshold?: number; minRms?: number } = {},
): Pitch | null {
  const { minFreq = 60, maxFreq = 1500, threshold = 0.15, minRms = 0.01 } = opts
  const n = buf.length
  let sum = 0
  for (let i = 0; i < n; i++) sum += buf[i] * buf[i]
  if (n === 0 || Math.sqrt(sum / n) < minRms) return null

  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq))
  const maxTau = Math.min(Math.ceil(sampleRate / minFreq), Math.floor(n / 2))
  const w = n - maxTau
  if (w < maxTau || minTau >= maxTau) return null

  // Difference function and cumulative mean normalised difference.
  const cmnd = new Float32Array(maxTau + 1)
  cmnd[0] = 1
  let running = 0
  for (let tau = 1; tau <= maxTau; tau++) {
    let d = 0
    for (let j = 0; j < w; j++) {
      const diff = buf[j] - buf[j + tau]
      d += diff * diff
    }
    running += d
    cmnd[tau] = running > 0 ? (d * tau) / running : 1
  }

  let tau = -1
  for (let t = minTau; t < maxTau; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 < maxTau && cmnd[t + 1] < cmnd[t]) t++
      tau = t
      break
    }
  }
  if (tau < 0) return null

  // Parabolic interpolation around the minimum.
  let better = tau
  if (tau > 1 && tau < maxTau) {
    const a = cmnd[tau - 1], b = cmnd[tau], c = cmnd[tau + 1]
    const denom = a - 2 * b + c
    if (denom !== 0) better = tau + (a - c) / (2 * denom)
  }
  return { freq: sampleRate / better, clarity: Math.max(0, 1 - cmnd[tau]) }
}
