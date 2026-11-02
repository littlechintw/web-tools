import { describe, it, expect } from 'vitest'
import { randomInt, randomRange, shuffle, type RandomU32 } from '@/lib/random'
import {
  applyRolls, formatDiceNotation, keptMask, parseDiceNotation, rollDice,
} from '@/lib/dice'

function seq(values: number[]): RandomU32 {
  let i = 0
  return () => values[i++ % values.length]!
}
/** Deterministic xorshift32 uint32 generator. */
function xorshift(seed: number): RandomU32 {
  let x = seed >>> 0
  return () => {
    x ^= x << 13; x >>>= 0
    x ^= x >>> 17
    x ^= x << 5; x >>>= 0
    return x
  }
}

describe('parseDiceNotation', () => {
  it('parses basics', () => {
    expect(parseDiceNotation('2d6+3')).toEqual({ ok: true, spec: { count: 2, sides: 6, modifier: 3 } })
    expect(parseDiceNotation('d20')).toEqual({ ok: true, spec: { count: 1, sides: 20, modifier: 0 } })
    expect(parseDiceNotation(' 3 D 8 - 2 ')).toEqual({ ok: true, spec: { count: 3, sides: 8, modifier: -2 } })
  })
  it('parses keep-highest / keep-lowest', () => {
    expect(parseDiceNotation('4d6kh3')).toEqual({
      ok: true, spec: { count: 4, sides: 6, keep: { mode: 'highest', n: 3 }, modifier: 0 },
    })
    expect(parseDiceNotation('2d20KL1+5')).toEqual({
      ok: true, spec: { count: 2, sides: 20, keep: { mode: 'lowest', n: 1 }, modifier: 5 },
    })
  })
  it('rejects malformed input', () => {
    for (const bad of ['abc', '2d', '2d6+', '2d6++3', '2x6', '2d6kh', '-2d6', '2d6+3+4', '1.5d6', '2d6 3']) {
      const r = parseDiceNotation(bad)
      expect(r.ok, bad).toBe(false)
    }
    expect(parseDiceNotation('')).toEqual({ ok: false, error: 'empty' })
    expect(parseDiceNotation('   ')).toEqual({ ok: false, error: 'empty' })
  })
  it('rejects out-of-range values', () => {
    expect(parseDiceNotation('1000000d6')).toEqual({ ok: false, error: 'tooManyDice' })
    expect(parseDiceNotation('101d6')).toEqual({ ok: false, error: 'tooManyDice' })
    expect(parseDiceNotation('0d6')).toEqual({ ok: false, error: 'tooManyDice' })
    expect(parseDiceNotation('100d6').ok).toBe(true)
    expect(parseDiceNotation('2d1')).toEqual({ ok: false, error: 'badSides' })
    expect(parseDiceNotation('2d1001')).toEqual({ ok: false, error: 'badSides' })
    expect(parseDiceNotation('2d1000').ok).toBe(true)
    expect(parseDiceNotation('4d6kh5')).toEqual({ ok: false, error: 'badKeep' })
    expect(parseDiceNotation('4d6kh0')).toEqual({ ok: false, error: 'badKeep' })
    expect(parseDiceNotation('2d6+9999999')).toEqual({ ok: false, error: 'badModifier' })
  })
  it('rejects absurdly long input quickly', () => {
    expect(parseDiceNotation('9'.repeat(100000) + 'd6').ok).toBe(false)
  })
  it('round-trips through formatDiceNotation', () => {
    for (const n of ['2d6+3', '1d20', '4d6kh3', '3d8-2', '2d20kl1+5']) {
      const r = parseDiceNotation(n)
      expect(r.ok && formatDiceNotation(r.spec)).toBe(n)
    }
  })
})

describe('keep logic', () => {
  it('keeps the highest N, earliest wins ties', () => {
    expect(keptMask([3, 6, 1, 6], { mode: 'highest', n: 2 })).toEqual([false, true, false, true])
    expect(keptMask([4, 4, 4], { mode: 'highest', n: 2 })).toEqual([true, true, false])
  })
  it('keeps the lowest N', () => {
    expect(keptMask([3, 6, 1, 2], { mode: 'lowest', n: 2 })).toEqual([false, false, true, true])
  })
  it('keeps all without keep', () => {
    expect(keptMask([1, 2])).toEqual([true, true])
  })
  it('totals only kept dice plus modifier', () => {
    const r = applyRolls(
      { count: 4, sides: 6, keep: { mode: 'highest', n: 3 }, modifier: 2 },
      [1, 5, 6, 4],
    )
    expect(r.subtotal).toBe(15)
    expect(r.total).toBe(17)
  })
})

describe('secure helpers with injected RNG', () => {
  it('rejects values in the biased tail', () => {
    // max=3 -> limit = 2^32 - 1 = 4294967295; 4294967295 is rejected
    expect(randomInt(3, seq([4294967295, 4]))).toBe(1)
  })
  it('randomInt(1) never consumes randomness', () => {
    expect(randomInt(1, () => { throw new Error('no') })).toBe(0)
  })
  it('rejects bad max', () => {
    expect(() => randomInt(0)).toThrow()
    expect(() => randomInt(1.5)).toThrow()
  })
  it('d6 distribution is roughly uniform', () => {
    const rng = xorshift(12345)
    const counts = new Array(6).fill(0)
    const N = 60000
    for (let i = 0; i < N; i++) counts[randomRange(1, 6, rng) - 1]++
    for (const c of counts) expect(Math.abs(c - N / 6)).toBeLessThan(N / 6 * 0.05)
  })
  it('rollDice stays in range and has the right length', () => {
    const r = rollDice({ count: 10, sides: 20, modifier: 0 }, xorshift(7))
    expect(r.rolls).toHaveLength(10)
    for (const v of r.rolls) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(20) }
  })
  it('shuffle keeps all elements', () => {
    const out = shuffle([1, 2, 3, 4, 5], xorshift(99))
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
  })
})
