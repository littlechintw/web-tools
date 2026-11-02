/** Age / birthday / zodiac maths on plain calendar dates (no time zones involved). */

export interface YMD {
  y: number
  m: number // 1-12
  d: number // 1-31
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
}

export function parseYMD(s: string): YMD | null {
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!mt) return null
  const v = { y: +mt[1], m: +mt[2], d: +mt[3] }
  if (v.y < 1 || v.m < 1 || v.m > 12 || v.d < 1 || v.d > daysInMonth(v.y, v.m)) return null
  return v
}

const dayNumber = (a: YMD) => Math.round(Date.UTC(a.y, a.m - 1, a.d) / 86400000)
// Date.UTC maps years 0-99 to 1900+; fine since we only accept sensible years, but guard anyway.

export function cmpYMD(a: YMD, b: YMD): number {
  return a.y - b.y || a.m - b.m || a.d - b.d
}

export function daysBetween(a: YMD, b: YMD): number {
  return dayNumber(b) - dayNumber(a)
}

/** Weekday 0 (Sunday) - 6 (Saturday). */
export function weekday(a: YMD): number {
  return new Date(Date.UTC(a.y, a.m - 1, a.d)).getUTCDay()
}

/**
 * Add whole months, clamping to the end of the target month.
 * This is the leap-day rule: a Feb 29 birthday is observed on Feb 28 in
 * non-leap years (matches Taiwan Civil Code art. 121: when the month has no
 * corresponding day, the last day of that month applies).
 */
export function addMonths(a: YMD, months: number): YMD {
  const total = a.y * 12 + (a.m - 1) + months
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return { y, m, d: Math.min(a.d, daysInMonth(y, m)) }
}

export interface ExactAge {
  years: number
  months: number
  days: number
}

/** Exact age; null when the birth date is after today. */
export function exactAge(birth: YMD, today: YMD): ExactAge | null {
  if (cmpYMD(birth, today) > 0) return null
  let total = (today.y - birth.y) * 12 + (today.m - birth.m)
  while (total > 0 && cmpYMD(addMonths(birth, total), today) > 0) total--
  return { years: Math.floor(total / 12), months: total % 12, days: daysBetween(addMonths(birth, total), today) }
}

export function daysLived(birth: YMD, today: YMD): number | null {
  return cmpYMD(birth, today) > 0 ? null : daysBetween(birth, today)
}

export interface NextBirthday {
  date: YMD
  daysUntil: number
  turning: number
  weekday: number
}

/** Next birthday on or after today (0 days when today is the birthday). */
export function nextBirthday(birth: YMD, today: YMD): NextBirthday | null {
  if (cmpYMD(birth, today) > 0) return null
  let turning = today.y - birth.y
  let date = addMonths(birth, turning * 12)
  if (cmpYMD(date, today) < 0) {
    turning++
    date = addMonths(birth, turning * 12)
  }
  return { date, daysUntil: daysBetween(today, date), turning, weekday: weekday(date) }
}

/** Republic of China (民國) year; `before` is true for 民前 years (Gregorian <= 1911). */
export function minguoYear(y: number): { before: boolean; year: number } {
  return y >= 1912 ? { before: false, year: y - 1911 } : { before: true, year: 1912 - y }
}

export const WESTERN_SIGNS = [
  'capricorn', 'aquarius', 'pisces', 'aries', 'taurus', 'gemini',
  'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius',
] as const
export type WesternSign = (typeof WESTERN_SIGNS)[number]

// First day of each sign, by month (index 0 = January) : the sign that starts on that day.
const SIGN_START: readonly [number, WesternSign][] = [
  [20, 'aquarius'], [19, 'pisces'], [21, 'aries'], [20, 'taurus'], [21, 'gemini'], [21, 'cancer'],
  [23, 'leo'], [23, 'virgo'], [23, 'libra'], [23, 'scorpio'], [22, 'sagittarius'], [22, 'capricorn'],
]

export function westernSign(m: number, d: number): WesternSign {
  const [startDay, sign] = SIGN_START[m - 1]
  if (d >= startDay) return sign
  // Before this month's cut-over: the previous month's sign still applies.
  return SIGN_START[(m + 10) % 12][1]
}

export const CHINESE_ANIMALS = [
  'rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig',
] as const
export type ChineseAnimal = (typeof CHINESE_ANIMALS)[number]

/** Animal for a Chinese-calendar year, given as the Gregorian year in which it starts. */
export function animalForLunarYear(relatedYear: number): ChineseAnimal {
  return CHINESE_ANIMALS[(((relatedYear - 4) % 12) + 12) % 12]
}

/**
 * The Chinese zodiac animal of a date. The year flips at Lunar New Year, so we
 * ask the browser's Chinese calendar (Intl `relatedYear`). If Intl lacks the
 * calendar we fall back to the Gregorian year and flag `approximate`.
 */
export function chineseZodiac(a: YMD): { animal: ChineseAnimal; lunarYear: number; approximate: boolean } {
  try {
    const dt = new Date(Date.UTC(a.y, a.m - 1, a.d, 12))
    const parts = new Intl.DateTimeFormat('en-u-ca-chinese', { timeZone: 'UTC', year: 'numeric' }).formatToParts(dt)
    // 'relatedYear' is missing from TypeScript's DateTimeFormatPartTypes.
    const ry = Number(parts.find((p) => (p.type as string) === 'relatedYear')?.value)
    if (Number.isInteger(ry) && ry > 0) return { animal: animalForLunarYear(ry), lunarYear: ry, approximate: false }
  } catch {
    // fall through
  }
  return { animal: animalForLunarYear(a.y), lunarYear: a.y, approximate: true }
}
