import { randomRange, type RandomU32, secureU32 } from './random'

export const MAX_DICE = 100
export const MIN_SIDES = 2
export const MAX_SIDES = 1000
export const MAX_MODIFIER = 100000

export const PRESET_SIDES = [4, 6, 8, 10, 12, 20, 100] as const

export type KeepMode = 'highest' | 'lowest'

export interface DiceSpec {
  count: number
  sides: number
  keep?: { mode: KeepMode; n: number }
  modifier: number
}

export type DiceParseError = 'empty' | 'syntax' | 'tooManyDice' | 'badSides' | 'badKeep' | 'badModifier'

export type DiceParseResult = { ok: true; spec: DiceSpec } | { ok: false; error: DiceParseError }

/**
 * Parse "NdS", "dS", "NdS+M", "NdS-M", "NdSkhK", "NdSklK" (case-insensitive,
 * spaces ignored). Input length is bounded before any numeric work.
 */
export function parseDiceNotation(input: string): DiceParseResult {
  if (input.length > 40) return { ok: false, error: 'syntax' }
  if (/\d\s+\d/.test(input)) return { ok: false, error: 'syntax' }
  const s = input.replace(/\s+/g, '').toLowerCase()
  if (!s) return { ok: false, error: 'empty' }
  const m = /^(\d{0,7})d(\d{1,7})(?:k([hl])(\d{1,7}))?(?:([+-])(\d{1,7}))?$/.exec(s)
  if (!m) return { ok: false, error: 'syntax' }
  const count = m[1] === '' ? 1 : Number(m[1])
  const sides = Number(m[2])
  if (count < 1 || count > MAX_DICE) return { ok: false, error: 'tooManyDice' }
  if (sides < MIN_SIDES || sides > MAX_SIDES) return { ok: false, error: 'badSides' }
  const spec: DiceSpec = { count, sides, modifier: 0 }
  if (m[3]) {
    const n = Number(m[4])
    if (n < 1 || n > count) return { ok: false, error: 'badKeep' }
    spec.keep = { mode: m[3] === 'h' ? 'highest' : 'lowest', n }
  }
  if (m[5]) {
    const mod = Number(m[6])
    if (mod > MAX_MODIFIER) return { ok: false, error: 'badModifier' }
    spec.modifier = m[5] === '-' ? -mod : mod
  }
  return { ok: true, spec }
}

/** Canonical notation for a spec, e.g. "4d6kh3+2". */
export function formatDiceNotation(spec: DiceSpec): string {
  let out = `${spec.count}d${spec.sides}`
  if (spec.keep) out += `k${spec.keep.mode === 'highest' ? 'h' : 'l'}${spec.keep.n}`
  if (spec.modifier > 0) out += `+${spec.modifier}`
  else if (spec.modifier < 0) out += `${spec.modifier}`
  return out
}

/** Which of `rolls` are kept (ties resolved by position, earliest first). */
export function keptMask(rolls: readonly number[], keep?: DiceSpec['keep']): boolean[] {
  if (!keep) return rolls.map(() => true)
  const order = rolls
    .map((v, i) => ({ v, i }))
    .sort((a, b) => (keep.mode === 'highest' ? b.v - a.v : a.v - b.v) || a.i - b.i)
  const mask = rolls.map(() => false)
  for (let k = 0; k < keep.n; k++) mask[order[k]!.i] = true
  return mask
}

export interface DiceRoll {
  spec: DiceSpec
  rolls: number[]
  kept: boolean[]
  /** Sum of kept dice, before the modifier. */
  subtotal: number
  total: number
}

export function applyRolls(spec: DiceSpec, rolls: number[]): DiceRoll {
  const kept = keptMask(rolls, spec.keep)
  const subtotal = rolls.reduce((acc, v, i) => (kept[i] ? acc + v : acc), 0)
  return { spec, rolls, kept, subtotal, total: subtotal + spec.modifier }
}

export function rollDice(spec: DiceSpec, rng: RandomU32 = secureU32): DiceRoll {
  const rolls: number[] = []
  for (let i = 0; i < spec.count; i++) rolls.push(randomRange(1, spec.sides, rng))
  return applyRolls(spec, rolls)
}
