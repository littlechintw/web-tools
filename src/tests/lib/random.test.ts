import { describe, it, expect } from 'vitest'
import { randomFloat, randomInt, randomRange, randomWeighted, shuffle, type RandomU32 } from '@/lib/random'

/** Deterministic RNG cycling through the given uint32 values. */
const seq = (...vals: number[]): RandomU32 => {
  let i = 0
  return () => vals[i++ % vals.length]!
}
/** A small LCG so distribution tests are reproducible. */
const lcg = (seed: number): RandomU32 => {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s
  }
}

describe('randomInt()', () => {
  it('stays in range', () => {
    const rng = lcg(1)
    for (let i = 0; i < 5000; i++) {
      const v = randomInt(6, rng)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(6)
    }
  })

  it('rejects the biased tail instead of taking a modulo', () => {
    // max=3: 2^32 % 3 = 1, so 0xFFFFFFFF is in the biased tail and must be skipped.
    expect(randomInt(3, seq(0xffffffff, 4))).toBe(1) // 4 % 3
  })

  it('is flat over many draws (chi-square sanity)', () => {
    const rng = lcg(42), counts = Array(6).fill(0)
    const n = 60000
    for (let i = 0; i < n; i++) counts[randomInt(6, rng)]++
    const expected = n / 6
    const chi = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0)
    expect(chi).toBeLessThan(20.5) // df=5, p≈0.001
  })

  it('validates its argument', () => {
    expect(() => randomInt(0)).toThrow(RangeError)
    expect(() => randomInt(1.5)).toThrow(RangeError)
    expect(randomInt(1)).toBe(0)
  })
})

describe('randomRange() / randomFloat()', () => {
  it('is inclusive on both ends', () => {
    const seen = new Set<number>()
    const rng = lcg(7)
    for (let i = 0; i < 500; i++) seen.add(randomRange(3, 5, rng))
    expect([...seen].sort()).toEqual([3, 4, 5])
  })
  it('float is in [0, 1)', () => {
    expect(randomFloat(() => 0)).toBe(0)
    expect(randomFloat(() => 0xffffffff)).toBeLessThan(1)
  })
})

describe('randomWeighted()', () => {
  it('picks proportionally to the weights', () => {
    const rng = lcg(99), counts = [0, 0, 0]
    const n = 60000
    for (let i = 0; i < n; i++) counts[randomWeighted([1, 2, 3], rng)]++
    expect(counts[0] / n).toBeCloseTo(1 / 6, 1)
    expect(counts[1] / n).toBeCloseTo(2 / 6, 1)
    expect(counts[2] / n).toBeCloseTo(3 / 6, 1)
  })
  it('never picks a zero-weight item and rejects empty/invalid totals', () => {
    const rng = lcg(5)
    for (let i = 0; i < 2000; i++) expect(randomWeighted([0, 4, 0], rng)).toBe(1)
    expect(() => randomWeighted([])).toThrow(RangeError)
    expect(() => randomWeighted([0, 0])).toThrow(RangeError)
    expect(() => randomWeighted([1.5])).toThrow(RangeError)
  })
})

describe('shuffle()', () => {
  it('returns a permutation and leaves the input untouched', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = shuffle(input, lcg(3))
    expect([...out].sort()).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})
