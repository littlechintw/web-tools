import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Randomness policy: everything that decides an outcome draws from
 * src/lib/random.ts (crypto.getRandomValues + rejection sampling). Adding a
 * Math.random or a second hand-rolled getRandomValues elsewhere fails here.
 */
const ROOT = join(process.cwd(), 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (relative(ROOT, p).startsWith('tests')) continue
      walk(p, out)
    } else if (/\.(ts|vue)$/.test(name)) out.push(p)
  }
  return out
}
const files = walk(ROOT).map((p) => ({ rel: relative(ROOT, p).replaceAll('\\', '/'), text: readFileSync(p, 'utf8') }))
const stripComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

// Purely cosmetic randomness (particle jitter, audio noise): no outcome depends on it.
const COSMETIC_MATH_RANDOM = new Set([
  'tools/joss-paper/View.vue',
  'tools/satisfying-switch/View.vue',
  'tools/bubble-wrap/View.vue',
])
// The only places allowed to touch crypto.getRandomValues directly.
const CRYPTO_ALLOWED = new Set(['lib/random.ts', 'utils/nanoid.ts'])

describe('randomness policy', () => {
  it('Math.random only appears in allow-listed cosmetic files', () => {
    const offenders = files.filter((f) => /Math\.random\s*\(/.test(stripComments(f.text)) && !COSMETIC_MATH_RANDOM.has(f.rel)).map((f) => f.rel)
    expect(offenders, 'use @/lib/random for anything that decides an outcome').toEqual([])
  })

  it('crypto.getRandomValues is only used by the shared helper (and nanoid)', () => {
    const offenders = files.filter((f) => /getRandomValues\s*\(/.test(stripComments(f.text)) && !CRYPTO_ALLOWED.has(f.rel)).map((f) => f.rel)
    expect(offenders, 'import randomInt/shuffle/... from @/lib/random instead').toEqual([])
  })

  it('the allow-list has no stale entries', () => {
    for (const rel of COSMETIC_MATH_RANDOM) {
      const f = files.find((x) => x.rel === rel)
      expect(f, `${rel} no longer exists`).toBeTruthy()
      expect(/Math\.random\s*\(/.test(stripComments(f!.text)), `${rel} no longer uses Math.random — remove it from the allow-list`).toBe(true)
    }
  })
})
