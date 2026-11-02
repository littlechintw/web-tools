// Kinship / relative-title calculator (Taiwan Mandarin + Taiwanese Hokkien).
//
// A relationship is a chain of steps from "me". The chain is normalised with a
// small rewrite system (母的夫 = 父, 兄的父 = 父 ...) and then looked up in the
// hand-written title table (kinshipData.ts). Anything not covered returns
// status 'unsupported' instead of a guess.
//
// Assumptions: first marriages only (no step-parents), and a spouse's child is
// one's own child.

import { TABLE, isAgeEntry, moeUrl, MOE_SEARCH_URL, type Title, type CaveatKey } from './kinshipData'

export { moeUrl, MOE_SEARCH_URL }

export type { Title, CaveatKey }

export type Sex = 'm' | 'f'
export type Age = 'older' | 'younger'
/** f 父, m 母, h 夫, w 妻, eb 兄, yb 弟, es 姊, ys 妹, so 子, d 女 */
export type Step = 'f' | 'm' | 'h' | 'w' | 'eb' | 'yb' | 'es' | 'ys' | 'so' | 'd'
/** Display-only merged steps used by reverse lookup. */
export type DisplayStep = Step | 'sibM' | 'sibF'

export const ALL_STEPS: readonly Step[] = ['f', 'm', 'h', 'w', 'eb', 'yb', 'es', 'ys', 'so', 'd']
export const MAX_DEPTH = 5

export const STEP_SEX: Record<Step, Sex> = { f: 'm', m: 'f', h: 'm', w: 'f', eb: 'm', yb: 'm', es: 'f', ys: 'f', so: 'm', d: 'f' }

const isSibling = (s: Step) => s === 'eb' || s === 'yb' || s === 'es' || s === 'ys'
const isOlderSib = (s: Step) => s === 'eb' || s === 'es'
const isParent = (s: Step) => s === 'f' || s === 'm'
const isChild = (s: Step) => s === 'so' || s === 'd'
const isSpouse = (s: Step) => s === 'h' || s === 'w'

export type UnsupportedReason = 'tooLong' | 'ambiguous' | 'sameSex' | 'unknown'

export type KinshipResult =
  | { status: 'self'; chain: Step[] }
  | { status: 'ok'; chain: Step[]; title: Title; age?: Age }
  | { status: 'needAge'; chain: Step[]; options: { older: Title; younger: Title } }
  | { status: 'unsupported'; reason: UnsupportedReason; chain: Step[] }

/** Whether the person reached after `steps` is male/female. */
export function endSex(steps: readonly Step[], ego: Sex): Sex {
  return steps.length ? STEP_SEX[steps[steps.length - 1]] : ego
}

/** Can `step` follow the chain so far? (spouse steps need the opposite sex) */
export function canAppend(steps: readonly Step[], ego: Sex, step: Step): boolean {
  if (steps.length >= MAX_DEPTH) return false
  const cur = endSex(steps, ego)
  if (step === 'h') return cur === 'f'
  if (step === 'w') return cur === 'm'
  return true
}

/** Rewrite a chain to its canonical form, or explain why it can't be done. */
export function normalize(steps: readonly Step[], ego: Sex): { chain: Step[] } | { reason: UnsupportedReason } {
  if (steps.length > MAX_DEPTH) return { reason: 'tooLong' }
  // Spouse steps must go to the opposite sex.
  let cur = ego
  for (const s of steps) {
    if ((s === 'h' && cur !== 'f') || (s === 'w' && cur !== 'm')) return { reason: 'sameSex' }
    cur = STEP_SEX[s]
  }
  const c: Step[] = [...steps]
  for (let guard = 0; guard < 50; guard++) {
    let changed = false
    for (let i = 0; i + 1 < c.length && !changed; i++) {
      const a = c[i]
      const b = c[i + 1]
      const prevSex = i === 0 ? ego : STEP_SEX[c[i - 1]]
      const replace = (...r: Step[]) => {
        c.splice(i, 2, ...r)
        changed = true
      }
      if (a === 'f' && b === 'w') replace('m')
      else if (a === 'm' && b === 'h') replace('f')
      else if (isSpouse(a) && isSpouse(b)) replace()
      else if (isSibling(a) && isParent(b)) replace(b)
      else if (isChild(a) && isParent(b)) {
        if (STEP_SEX[b] === prevSex) replace()
        else replace(STEP_SEX[b] === 'm' ? 'h' : 'w')
      } else if (isSpouse(a) && isChild(b)) replace(b)
      else if (isSibling(a) && isSibling(b)) {
        if (isOlderSib(a) === isOlderSib(b)) replace(b)
        else return { reason: 'ambiguous' }
      } else if (isParent(a) && isChild(b)) return { reason: 'ambiguous' }
      else if (isSpouse(a) && isSibling(b) && i + 2 < c.length && isChild(c[i + 2])) {
        // spouse's sibling's child = nephew/niece
        c.splice(i, 1)
        changed = true
      }
    }
    if (!changed) break
  }
  return { chain: c }
}

export interface ResolveOptions {
  ego: Sex
  /** Is the *other* person older or younger than me? Only needed for cousins. */
  relativeAge?: Age | null
}

export function resolve(steps: readonly Step[], opts: ResolveOptions): KinshipResult {
  const n = normalize(steps, opts.ego)
  if ('reason' in n) return { status: 'unsupported', reason: n.reason, chain: [...steps] }
  const chain = n.chain
  if (chain.length === 0) return { status: 'self', chain }
  const e = TABLE.get(chain.join(' '))
  if (!e) return { status: 'unsupported', reason: 'unknown', chain }
  if (isAgeEntry(e)) {
    if (!opts.relativeAge) return { status: 'needAge', chain, options: e }
    return { status: 'ok', chain, title: e[opts.relativeAge], age: opts.relativeAge }
  }
  return { status: 'ok', chain, title: e }
}

/** The chain seen from the other person back to me. */
export function invert(chain: readonly Step[], ego: Sex): Step[] {
  const out: Step[] = []
  let a = ego
  for (const s of chain) {
    let inv: Step
    if (isParent(s)) inv = a === 'm' ? 'so' : 'd'
    else if (isChild(s)) inv = a === 'm' ? 'f' : 'm'
    else if (s === 'h') inv = 'w'
    else if (s === 'w') inv = 'h'
    else if (isOlderSib(s)) inv = a === 'm' ? 'yb' : 'ys'
    else inv = a === 'm' ? 'eb' : 'es'
    out.unshift(inv)
    a = STEP_SEX[s]
  }
  return out
}

export interface ReverseView {
  inverse: Step[]
  otherSex: Sex
  result: KinshipResult
}

/** What does the other person call me? */
export function resolveReverse(steps: readonly Step[], opts: ResolveOptions): KinshipResult & { inverse: Step[] } {
  const n = normalize(steps, opts.ego)
  if ('reason' in n) return { status: 'unsupported', reason: n.reason, chain: [...steps], inverse: [] }
  const inverse = invert(n.chain, opts.ego)
  const otherSex = endSex(n.chain, opts.ego)
  const flipped: Age | null = opts.relativeAge ? (opts.relativeAge === 'older' ? 'younger' : 'older') : null
  const r = resolve(inverse, { ego: otherSex, relativeAge: flipped })
  return { ...r, inverse }
}

// --- reverse lookup (title -> chains) ------------------------------------

export interface ReversePath {
  steps: DisplayStep[]
  /** Speaker sex required by the chain (spouse chains), if any. */
  ego?: Sex
  /** Relative age of the cousin, when the title depends on it. */
  age?: Age
}
export interface ReverseGroup {
  title: Title
  paths: ReversePath[]
}

function mergePaths(paths: ReversePath[]): ReversePath[] {
  let list = paths.map((p) => ({ ...p, steps: [...p.steps] }))
  let again = true
  while (again) {
    again = false
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        if (a.steps.length !== b.steps.length || a.ego !== b.ego || a.age !== b.age) continue
        const diff = a.steps.map((_, k) => k).filter((k) => a.steps[k] !== b.steps[k])
        if (diff.length !== 1) continue
        const k = diff[0]
        const pair = [a.steps[k], b.steps[k]].sort().join()
        const merged = pair === 'eb,yb' ? 'sibM' : pair === 'es,ys' ? 'sibF' : null
        if (!merged) continue
        const steps = [...a.steps]
        steps[k] = merged
        list = list.filter((_, x) => x !== i && x !== j)
        list.push({ ...a, steps })
        again = true
        break outer
      }
    }
  }
  return list
}

const norm = (s: string) => s.trim().replace(/[姐]/g, '姊')

const names = (t: Title) => [t.zh, ...t.zhAlt, t.tw, ...t.twAlt.map((x) => x.split(' ')[0])]

/** All titles users can pick for the reverse lookup (Mandarin names + aliases). */
export function titleOptions(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (s: string) => {
    if (!seen.has(s)) {
      seen.add(s)
      out.push(s)
    }
  }
  for (const e of TABLE.values()) {
    for (const t of isAgeEntry(e) ? [e.older, e.younger] : [e]) {
      push(t.zh)
    }
  }
  for (const e of TABLE.values()) {
    for (const t of isAgeEntry(e) ? [e.older, e.younger] : [e]) t.zhAlt.forEach(push)
  }
  return out
}

/** Which chains does a title stand for? Matches Mandarin names/aliases and Hokkien Han forms. */
export function lookupTitle(query: string): ReverseGroup[] {
  const q = norm(query)
  if (!q) return []
  const groups = new Map<string, { title: Title; paths: ReversePath[] }>()
  for (const [key, e] of TABLE) {
    const steps = key.split(' ') as Step[]
    const ego: Sex | undefined = steps[0] === 'h' ? 'f' : steps[0] === 'w' ? 'm' : undefined
    const variants: { t: Title; age?: Age }[] = isAgeEntry(e)
      ? [
          { t: e.older, age: 'older' },
          { t: e.younger, age: 'younger' },
        ]
      : [{ t: e }]
    for (const { t, age } of variants) {
      if (!names(t).some((n) => norm(n) === q)) continue
      const gk = `${t.zh}|${t.tw}`
      const g = groups.get(gk) ?? { title: t, paths: [] }
      g.paths.push({ steps, ego, age })
      groups.set(gk, g)
    }
  }
  return [...groups.values()].map((g) => ({ title: g.title, paths: mergePaths(g.paths) }))
}

/** Every Title in the table (for tests / tooling). */
export function allTitles(): Title[] {
  const out: Title[] = []
  for (const e of TABLE.values()) out.push(...(isAgeEntry(e) ? [e.older, e.younger] : [e]))
  return out
}
