import { describe, expect, it } from 'vitest'
import { clampBpm, detectPitch, freqToNote, midiToFreq, planBeats, tapTempo } from '@/lib/music'

const SR = 44100
function sine(freq: number, n = 4096, amp = 0.5, harmonics = false): Float32Array {
  const b = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let v = Math.sin((2 * Math.PI * freq * i) / SR)
    if (harmonics) v += 0.5 * Math.sin((4 * Math.PI * freq * i) / SR) + 0.3 * Math.sin((6 * Math.PI * freq * i) / SR)
    b[i] = amp * v
  }
  return b
}

describe('freq <-> note', () => {
  it('A4 reference', () => {
    const n = freqToNote(440)!
    expect(n).toMatchObject({ midi: 69, name: 'A', octave: 4 })
    expect(n.cents).toBeCloseTo(0, 8)
  })
  it('known pitches', () => {
    expect(freqToNote(261.6256)).toMatchObject({ name: 'C', octave: 4, midi: 60 })
    expect(freqToNote(82.4069)).toMatchObject({ name: 'E', octave: 2 })
    expect(freqToNote(27.5)).toMatchObject({ name: 'A', octave: 0 })
    expect(freqToNote(466.1638)).toMatchObject({ name: 'A#', octave: 4 })
  })
  it('cents offset: 1 semitone = 100 cents, quarter-tone = 50', () => {
    expect(freqToNote(440 * 2 ** (20 / 1200))!.cents).toBeCloseTo(20, 6)
    expect(freqToNote(440 * 2 ** (-30 / 1200))!.cents).toBeCloseTo(-30, 6)
  })
  it('alternate A4', () => {
    expect(freqToNote(415.3, 415)!.name).toBe('A')
    expect(freqToNote(415, 415)!.cents).toBeCloseTo(0, 8)
    expect(midiToFreq(69, 432)).toBe(432)
    expect(midiToFreq(81, 440)).toBeCloseTo(880, 8)
  })
  it('invalid', () => {
    expect(freqToNote(0)).toBeNull()
    expect(freqToNote(-3)).toBeNull()
    expect(freqToNote(NaN)).toBeNull()
  })
})

describe('tap tempo', () => {
  it('averages intervals', () => {
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120)
    expect(tapTempo([0, 600, 1200])).toBe(100)
  })
  it('needs two taps', () => {
    expect(tapTempo([])).toBeNull()
    expect(tapTempo([100])).toBeNull()
  })
  it('restarts after a long pause', () => {
    expect(tapTempo([0, 500, 1000, 10_000, 10_600])).toBe(100)
    expect(tapTempo([0, 500, 10_000])).toBeNull()
  })
  it('only the last 8 taps count and result is clamped', () => {
    const taps = [0, 2000, 3000, ...Array.from({ length: 8 }, (_, i) => 3000 + (i + 1) * 500)]
    expect(tapTempo(taps)).toBe(120)
    expect(tapTempo([0, 100])).toBe(300)
    expect(tapTempo([0, 1900])).toBe(32)
    expect(clampBpm(5)).toBe(20)
    expect(clampBpm(999)).toBe(300)
    expect(clampBpm(NaN)).toBe(120)
  })
})

describe('planBeats', () => {
  it('schedules within the lookahead with accents', () => {
    const p = planBeats(0, 0, 0, 2.05, 120, 4, 1) // 0.5s per beat
    expect(p.events.map((e) => e.time)).toEqual([0, 0.5, 1, 1.5, 2])
    expect(p.events.map((e) => e.accent)).toEqual(['strong', 'medium', 'medium', 'medium', 'strong'])
    expect(p.events[4].beat).toBe(0)
    expect(p.nextTime).toBeCloseTo(2.5, 10)
  })
  it('subdivisions are weak and spaced evenly', () => {
    const p = planBeats(10, 0, 10, 0.55, 120, 2, 3)
    expect(p.events.map((e) => e.accent)).toEqual(['strong', 'weak', 'weak', 'medium'])
    expect(p.events[1].time - p.events[0].time).toBeCloseTo(0.5 / 3, 10)
  })
  it('resumes from returned state without duplicates', () => {
    const a = planBeats(0, 0, 0, 1.2, 60, 3, 1)
    const b = planBeats(a.nextTime, a.tickIndex, 1.0, 2.1, 60, 3, 1)
    expect(a.events.map((e) => e.time)).toEqual([0, 1])
    expect(b.events[0]).toMatchObject({ time: 2, beat: 2, accent: 'medium' })
    expect(b.events[1]).toMatchObject({ time: 3, beat: 0, accent: 'strong' })
  })
  it('nothing due yet -> no events', () => {
    expect(planBeats(5, 0, 0, 0.1, 120, 4, 1).events).toEqual([])
  })
})

describe('detectPitch (YIN)', () => {
  const cases: [string, number][] = [
    ['E2 low guitar', 82.41], ['A2', 110], ['D3', 146.83], ['G3', 196], ['B3', 246.94],
    ['E4', 329.63], ['A4', 440], ['A5', 880], ['C6', 1046.5],
  ]
  for (const [name, f] of cases) {
    it(`detects ${name} (${f} Hz) within 5 cents`, () => {
      const p = detectPitch(sine(f), SR)!
      expect(p).not.toBeNull()
      expect(Math.abs(1200 * Math.log2(p.freq / f))).toBeLessThan(5)
      expect(p.clarity).toBeGreaterThan(0.85)
    })
  }
  it('finds the fundamental of a harmonic-rich low E2', () => {
    const p = detectPitch(sine(82.41, 4096, 0.4, true), SR)!
    expect(Math.abs(1200 * Math.log2(p.freq / 82.41))).toBeLessThan(5)
  })
  it('works at 48 kHz', () => {
    const b = new Float32Array(4096)
    for (let i = 0; i < b.length; i++) b[i] = 0.5 * Math.sin((2 * Math.PI * 196 * i) / 48000)
    expect(Math.abs(1200 * Math.log2(detectPitch(b, 48000)!.freq / 196))).toBeLessThan(5)
  })
  it('null for silence, very quiet, and empty buffers', () => {
    expect(detectPitch(new Float32Array(4096), SR)).toBeNull()
    expect(detectPitch(sine(440, 4096, 0.001), SR)).toBeNull()
    expect(detectPitch(new Float32Array(0), SR)).toBeNull()
  })
  it('null for white noise', () => {
    let seed = 12345
    const b = new Float32Array(4096)
    for (let i = 0; i < b.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      b[i] = (seed / 2 ** 32 - 0.5) * 0.8
    }
    expect(detectPitch(b, SR)).toBeNull()
  })
})
