/**
 * Taiwan identifiers: 身分證字號 / 居留證統一證號 (letter + 9 chars) and
 * 統一編號 (8-digit business number).
 *
 * ID / ARC checksum (10 chars):
 *   - letter A-Z maps to a two digit code n1 n2 (A=10 ... Z=33, with the
 *     irregular I=34, O=35, W=32 ...), contributing n1*1 + n2*9;
 *   - the 2nd char is a gender digit (1/2 national, 8/9 new ARC, 6/7 mainland /
 *     HK / Macau residents) weighted 8, or, for the OLD ARC format, a letter
 *     A-D whose code's last digit is used instead (A=0 B=1 C=2 D=3);
 *   - digits 3-9 are weighted 7..1 and the final check digit is weighted 1;
 *   - valid when the weighted sum is divisible by 10.
 *
 * 統一編號 (8 digits): weights 1 2 1 2 1 2 4 1; each product's digits are
 * added together (e.g. 28 -> 2 + 8). Legacy rule: sum % 10 == 0, or, when the
 * 7th digit is 7, (sum + 1) % 10 == 0. Since 2023-04-01 the Ministry of Finance
 * uses divisor 5 instead of 10 (sum % 5 == 0, or (sum + 1) % 5 == 0 when the
 * 7th digit is 7) to enlarge the number pool. We report validity under the new
 * rule and additionally whether the number also passes the legacy rule.
 */

import { randomInt } from './random'

const LETTER_CODES: Record<string, number> = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18, K: 19, L: 20, M: 21,
  N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27, U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33,
}
export const ID_LETTERS = Object.keys(LETTER_CODES)

export type IdKind = 'national' | 'arc-new' | 'arc-old'
export type Gender = 'male' | 'female'

export interface IdResult {
  valid: boolean
  kind: IdKind | null
  gender: Gender | null
  /** Why it is invalid: 'format' | 'checksum'. */
  reason?: 'format' | 'checksum'
}

function idChecksum(letter: string, second: number, digits: string): number {
  const code = LETTER_CODES[letter]
  let sum = Math.floor(code / 10) + (code % 10) * 9 + second * 8
  for (let i = 0; i < 7; i++) sum += Number(digits[i]) * (7 - i)
  sum += Number(digits[7]) // check digit
  return sum
}

/** Validate a 身分證字號 / 居留證統一證號 (case-insensitive, whitespace trimmed). */
export function validateId(input: string): IdResult {
  const s = input.trim().toUpperCase()
  const bad: IdResult = { valid: false, kind: null, gender: null, reason: 'format' }
  if (s.length !== 10 || !(s[0] in LETTER_CODES)) return bad
  const letter = s[0]
  const c2 = s[1]
  let kind: IdKind
  let gender: Gender
  let second: number
  if (/^\d$/.test(c2)) {
    if (c2 === '1' || c2 === '2') kind = 'national'
    else if ('6789'.includes(c2)) kind = 'arc-new'
    else return bad
    gender = c2 === '1' || c2 === '7' || c2 === '8' ? 'male' : 'female'
    second = Number(c2)
  } else if ('ABCD'.includes(c2)) {
    kind = 'arc-old'
    gender = c2 === 'A' || c2 === 'C' ? 'male' : 'female'
    second = LETTER_CODES[c2] % 10
  } else return bad
  const rest = s.slice(2)
  if (!/^\d{8}$/.test(rest)) return bad
  const ok = idChecksum(letter, second, rest) % 10 === 0
  return { valid: ok, kind, gender, reason: ok ? undefined : 'checksum' }
}

/** Weighted digit-sum of a 統一編號; null unless exactly 8 digits. */
export function businessSum(s: string): number | null {
  if (!/^\d{8}$/.test(s)) return null
  const w = [1, 2, 1, 2, 1, 2, 4, 1]
  let sum = 0
  for (let i = 0; i < 8; i++) {
    const p = Number(s[i]) * w[i]
    sum += Math.floor(p / 10) + (p % 10)
  }
  return sum
}

export interface BusinessResult {
  /** Passes the rule in force since 2023-04-01 (divisor 5). */
  valid: boolean
  /** Also passes the pre-2023 rule (divisor 10). */
  legacyValid: boolean
  reason?: 'format' | 'checksum'
}

export function validateBusinessNo(input: string): BusinessResult {
  const s = input.trim()
  const sum = businessSum(s)
  if (sum === null) return { valid: false, legacyValid: false, reason: 'format' }
  const seven = s[6] === '7'
  const pass = (d: number) => sum % d === 0 || (seven && (sum + 1) % d === 0)
  const valid = pass(5)
  return { valid, legacyValid: pass(10), reason: valid ? undefined : 'checksum' }
}

/** Random integer in [0, max) from a caller-supplied source (defaults to Web Crypto). */
export type RandInt = (max: number) => number
export const cryptoRandInt: RandInt = (max) => randomInt(max)

/** Generate a random checksum-valid ID for TESTING ONLY. */
export function generateTestId(kind: IdKind, randInt: RandInt = cryptoRandInt): string {
  const letter = ID_LETTERS[randInt(ID_LETTERS.length)]
  let second: string
  let secondVal: number
  if (kind === 'arc-old') {
    second = 'ABCD'[randInt(4)]
    secondVal = LETTER_CODES[second] % 10
  } else {
    second = kind === 'national' ? String(1 + randInt(2)) : String(8 + randInt(2))
    secondVal = Number(second)
  }
  let digits = ''
  for (let i = 0; i < 7; i++) digits += String(randInt(10))
  // Pick the check digit that makes the sum divisible by 10.
  const partial = idChecksum(letter, secondVal, digits + '0')
  const check = (10 - (partial % 10)) % 10
  return letter + second + digits + String(check)
}

/** Generate a random 8-digit 統一編號 valid under both the legacy and the new rule (TESTING ONLY). */
export function generateTestBusinessNo(randInt: RandInt = cryptoRandInt): string {
  let head = ''
  for (let i = 0; i < 7; i++) head += String(randInt(10))
  for (let d = 0; d < 10; d++) {
    const s = head + String(d)
    if (validateBusinessNo(s).legacyValid) return s
  }
  return head + '0' // unreachable: the last digit has weight 1, so exactly one d works
}
