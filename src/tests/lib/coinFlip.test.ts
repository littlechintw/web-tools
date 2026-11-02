import { describe, it, expect } from 'vitest'
import { computeStats, currentStreak, decide, flipCoins, longestStreak, MAX_COINS, type Side } from '@/lib/coinFlip'
import type { RandomU32 } from '@/lib/random'

const H: Side = 'heads'
const T: Side = 'tails'
function seq(values: number[]): RandomU32 {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('flipCoins', () => {
  it('maps even to heads and odd to tails', () => {
    expect(flipCoins(4, seq([0, 1, 2, 3]))).toEqual([H, T, H, T])
  })
  it('clamps the count to 1..100', () => {
    expect(flipCoins(0, seq([0]))).toHaveLength(1)
    expect(flipCoins(1000, seq([0]))).toHaveLength(MAX_COINS)
  })
  it('is roughly fair over many flips', () => {
    let x = 2463534242
    const rng: RandomU32 = () => {
      x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0
      return x
    }
    let heads = 0
    for (let i = 0; i < 100; i++) heads += flipCoins(100, rng).filter((s) => s === H).length
    expect(heads).toBeGreaterThan(4700)
    expect(heads).toBeLessThan(5300)
  })
})

describe('streaks', () => {
  it('handles empty', () => {
    expect(currentStreak([])).toEqual({ side: null, length: 0 })
    expect(longestStreak([])).toEqual({ side: null, length: 0 })
  })
  it('current streak', () => {
    expect(currentStreak([H, T, T, T])).toEqual({ side: T, length: 3 })
    expect(currentStreak([H])).toEqual({ side: H, length: 1 })
  })
  it('longest streak, first wins ties', () => {
    expect(longestStreak([H, H, T, T, T, H])).toEqual({ side: T, length: 3 })
    expect(longestStreak([H, H, T, T])).toEqual({ side: H, length: 2 })
    expect(longestStreak([H, T, H])).toEqual({ side: H, length: 1 })
  })
})

describe('computeStats', () => {
  it('aggregates', () => {
    const s = computeStats([H, H, T, H])
    expect(s).toMatchObject({ total: 4, heads: 3, tails: 1, headsRatio: 0.75 })
    expect(s.current).toEqual({ side: H, length: 1 })
    expect(s.longest).toEqual({ side: H, length: 2 })
  })
  it('empty has zero ratio', () => {
    expect(computeStats([]).headsRatio).toBe(0)
  })
})

describe('decide', () => {
  it('returns 0 or 1', () => {
    expect(decide(seq([2]))).toBe(0)
    expect(decide(seq([3]))).toBe(1)
  })
})
