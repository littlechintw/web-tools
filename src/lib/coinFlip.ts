import { randomInt, type RandomU32, secureU32 } from './random'

export const MAX_COINS = 100

export type Side = 'heads' | 'tails'

export function flipCoins(count: number, rng: RandomU32 = secureU32): Side[] {
  const n = Math.min(MAX_COINS, Math.max(1, Math.floor(count)))
  const out: Side[] = []
  for (let i = 0; i < n; i++) out.push(randomInt(2, rng) === 0 ? 'heads' : 'tails')
  return out
}

export interface Streak {
  side: Side | null
  length: number
}

/** Streak ending at the last element. */
export function currentStreak(flips: readonly Side[]): Streak {
  if (flips.length === 0) return { side: null, length: 0 }
  const last = flips[flips.length - 1]!
  let length = 0
  for (let i = flips.length - 1; i >= 0 && flips[i] === last; i--) length++
  return { side: last, length }
}

/** Longest run anywhere in the sequence (first one wins on ties). */
export function longestStreak(flips: readonly Side[]): Streak {
  let best: Streak = { side: null, length: 0 }
  let run = 0
  for (let i = 0; i < flips.length; i++) {
    run = i > 0 && flips[i] === flips[i - 1] ? run + 1 : 1
    if (run > best.length) best = { side: flips[i]!, length: run }
  }
  return best
}

export interface CoinStats {
  total: number
  heads: number
  tails: number
  /** Share of heads, 0..1 (0 when no flips). */
  headsRatio: number
  current: Streak
  longest: Streak
}

export function computeStats(flips: readonly Side[]): CoinStats {
  const heads = flips.filter((f) => f === 'heads').length
  const total = flips.length
  return {
    total,
    heads,
    tails: total - heads,
    headsRatio: total ? heads / total : 0,
    current: currentStreak(flips),
    longest: longestStreak(flips),
  }
}

/** Pick one of two options by a fair flip. */
export function decide(rng: RandomU32 = secureU32): 0 | 1 {
  return randomInt(2, rng) as 0 | 1
}
