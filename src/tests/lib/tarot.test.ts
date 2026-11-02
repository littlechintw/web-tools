import { describe, it, expect } from 'vitest'
import { drawCards, drawSpread, SPREAD_SIZE, TAROT_DECK } from '@/lib/tarot'
import type { RandomU32 } from '@/lib/random'

function xorshift(seed: number): RandomU32 {
  let x = seed >>> 0
  return () => {
    x ^= x << 13; x >>>= 0
    x ^= x >>> 17
    x ^= x << 5; x >>>= 0
    return x
  }
}

describe('deck', () => {
  it('has 22 unique cards numbered 0..21 with numerals', () => {
    expect(TAROT_DECK).toHaveLength(22)
    expect(new Set(TAROT_DECK.map((c) => c.id)).size).toBe(22)
    expect(new Set(TAROT_DECK.map((c) => c.numeral)).size).toBe(22)
    expect(TAROT_DECK.map((c) => c.number)).toEqual([...Array(22).keys()])
    expect(TAROT_DECK[0]!.numeral).toBe('0')
    expect(TAROT_DECK[21]!.numeral).toBe('XXI')
  })
})

describe('drawing', () => {
  it('spreads never repeat a card', () => {
    const rng = xorshift(2024)
    for (let i = 0; i < 2000; i++) {
      const cards = drawSpread('three', rng)
      expect(cards).toHaveLength(SPREAD_SIZE.three)
      expect(new Set(cards.map((c) => c.card.id)).size).toBe(3)
    }
  })
  it('can draw the whole deck without repeats and clamps larger requests', () => {
    const all = drawCards(50, xorshift(5))
    expect(all).toHaveLength(22)
    expect(new Set(all.map((c) => c.card.id)).size).toBe(22)
  })
  it('single spread draws one card', () => {
    expect(drawSpread('single', xorshift(1))).toHaveLength(1)
  })
  it('orientation is roughly 50/50', () => {
    const rng = xorshift(777)
    let reversed = 0
    const N = 20000
    for (let i = 0; i < N; i++) if (drawCards(1, rng)[0]!.reversed) reversed++
    expect(Math.abs(reversed - N / 2)).toBeLessThan(N * 0.02)
  })
  it('every card appears first at a roughly equal rate', () => {
    const rng = xorshift(31337)
    const counts = new Map<string, number>()
    const N = 44000
    for (let i = 0; i < N; i++) {
      const id = drawCards(1, rng)[0]!.card.id
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    expect(counts.size).toBe(22)
    for (const c of counts.values()) expect(Math.abs(c - N / 22)).toBeLessThan((N / 22) * 0.15)
  })
  it('orientation follows the injected RNG parity', () => {
    // first draw: j = 0 + randomInt(22) -> 0 ; orientation draw: odd -> reversed
    const seqv = [0, 1]
    let i = 0
    const r = drawCards(1, () => seqv[i++]!)
    expect(r[0]).toEqual({ card: TAROT_DECK[0], reversed: true })
  })
})
