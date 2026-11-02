/**
 * The one place randomness comes from. Anything that decides an OUTCOME (who
 * wins, which card, a password, a test ID…) must use these helpers; a test
 * (src/tests/lib/randomPolicy.test.ts) enforces it. The source is a function
 * returning a uniformly distributed unsigned 32-bit integer; production uses
 * crypto.getRandomValues, tests inject a deterministic one.
 *
 * Purely cosmetic jitter (particles, audio noise) may still use Math.random —
 * those files are allow-listed in the policy test.
 */
export type RandomU32 = () => number

const TWO_32 = 0x100000000

export const secureU32: RandomU32 = () => {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0]!
}

/** Uniform integer in [0, max) using rejection sampling (no modulo bias). */
export function randomInt(max: number, rng: RandomU32 = secureU32): number {
  if (!Number.isInteger(max) || max < 1 || max > TWO_32) {
    throw new RangeError('max must be an integer in [1, 2^32]')
  }
  if (max === 1) return 0
  const limit = TWO_32 - (TWO_32 % max) // largest multiple of max <= 2^32
  for (;;) {
    const v = rng()
    if (v < limit) return v % max
  }
}

/** Uniform integer in [min, max] inclusive. */
export function randomRange(min: number, max: number, rng: RandomU32 = secureU32): number {
  return min + randomInt(max - min + 1, rng)
}

/** Uniform float in [0, 1) with 32 bits of resolution. */
export function randomFloat(rng: RandomU32 = secureU32): number {
  return rng() / TWO_32
}

/**
 * Index chosen with probability proportional to integer weights (each >= 1 is
 * typical; 0 means never). Exactly uniform per weight unit, no float rounding.
 */
export function randomWeighted(weights: readonly number[], rng: RandomU32 = secureU32): number {
  const total = weights.reduce((s, w) => s + w, 0)
  if (!Number.isInteger(total) || total < 1) throw new RangeError('weights must be integers with a positive sum')
  let r = randomInt(total, rng)
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]!) return i
    r -= weights[i]!
  }
  return weights.length - 1
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rng: RandomU32 = secureU32): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng)
    const tmp = a[i]!
    a[i] = a[j]!
    a[j] = tmp
  }
  return a
}

/** Does the user prefer reduced motion? Safe outside the browser. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
