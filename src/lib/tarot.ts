import { randomInt, type RandomU32, secureU32 } from './random'

/** The 22 Major Arcana. Text lives in locales under tools.tarot.cards.<id>. */
export interface TarotCard {
  id: string
  /** 0..21 */
  number: number
  numeral: string
}

const IDS = [
  'fool', 'magician', 'highPriestess', 'empress', 'emperor', 'hierophant', 'lovers',
  'chariot', 'strength', 'hermit', 'wheel', 'justice', 'hangedMan', 'death',
  'temperance', 'devil', 'tower', 'star', 'moon', 'sun', 'judgement', 'world',
] as const

const ROMAN = [
  '0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI',
  'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI',
]

export const TAROT_DECK: readonly TarotCard[] = IDS.map((id, number) => ({
  id,
  number,
  numeral: ROMAN[number]!,
}))

export type SpreadKind = 'single' | 'three'

export const SPREAD_SIZE: Record<SpreadKind, number> = { single: 1, three: 3 }

export interface DrawnCard {
  card: TarotCard
  reversed: boolean
}

/**
 * Draw `count` distinct cards: a partial Fisher-Yates over the deck, then an
 * independent fair coin per card for orientation.
 */
export function drawCards(count: number, rng: RandomU32 = secureU32): DrawnCard[] {
  const n = Math.min(TAROT_DECK.length, Math.max(1, Math.floor(count)))
  const pool = TAROT_DECK.slice()
  const out: DrawnCard[] = []
  for (let i = 0; i < n; i++) {
    const j = i + randomInt(pool.length - i, rng)
    const tmp = pool[i]!
    pool[i] = pool[j]!
    pool[j] = tmp
    out.push({ card: pool[i]!, reversed: randomInt(2, rng) === 1 })
  }
  return out
}

export function drawSpread(kind: SpreadKind, rng: RandomU32 = secureU32): DrawnCard[] {
  return drawCards(SPREAD_SIZE[kind], rng)
}
