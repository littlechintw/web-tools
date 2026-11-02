import { describe, it, expect } from 'vitest'
import {
  currentSolarTerm, formatLunar, gregorianToLunar, lunarDayName, lunarMonths, lunarToGregorian, lunarSupported,
  solarTerms, stemBranchYear, zodiacOf,
} from '@/lib/lunar'

describe('year naming', () => {
  it('stem-branch and zodiac (checked against 甲子 = 1984, 庚子 = 2020)', () => {
    expect(stemBranchYear(1984)).toBe('甲子')
    expect(stemBranchYear(2020)).toBe('庚子')
    expect(stemBranchYear(2024)).toBe('甲辰')
    expect(stemBranchYear(2025)).toBe('乙巳')
    expect(zodiacOf(2024)).toBe('龍')
    expect(zodiacOf(2025)).toBe('蛇')
    expect(zodiacOf(1984)).toBe('鼠')
  })
  it('day names', () => {
    expect([1, 10, 11, 20, 21, 29, 30].map(lunarDayName)).toEqual(['初一', '初十', '十一', '二十', '廿一', '廿九', '三十'])
  })
})

describe('Gregorian -> lunar via Intl', () => {
  it('is supported in this runtime', () => expect(lunarSupported()).toBe(true))
  it('2024-02-10 = 甲辰年正月初一', () => {
    expect(gregorianToLunar(2024, 2, 10)).toEqual({ year: 2024, month: 1, day: 1, leap: false })
    expect(formatLunar(gregorianToLunar(2024, 2, 10)!)).toBe('甲辰年正月初一')
  })
  it('2025-01-29 = 乙巳年正月初一', () => {
    expect(formatLunar(gregorianToLunar(2025, 1, 29)!)).toBe('乙巳年正月初一')
  })
  it('the day before new year still belongs to the old lunar year (除夕)', () => {
    expect(formatLunar(gregorianToLunar(2024, 2, 9)!)).toBe('癸卯年臘月三十')
  })
  it('2023 has 閏二月 (starting 2023-03-22)', () => {
    expect(formatLunar(gregorianToLunar(2023, 3, 22)!)).toBe('癸卯年閏二月初一')
    expect(formatLunar(gregorianToLunar(2023, 3, 21)!)).toBe('癸卯年二月三十')
    expect(formatLunar(gregorianToLunar(2023, 4, 20)!)).toBe('癸卯年三月初一')
  })
  it('Mid-Autumn 2024-09-17 = 八月十五', () => {
    expect(gregorianToLunar(2024, 9, 17)).toMatchObject({ month: 8, day: 15, leap: false })
  })
  it('rejects invalid dates', () => {
    expect(gregorianToLunar(2023, 2, 29)).toBeNull()
    expect(gregorianToLunar(2023, 13, 1)).toBeNull()
    expect(gregorianToLunar(1800, 1, 1)).toBeNull()
    expect(gregorianToLunar(NaN, 1, 1)).toBeNull()
  })
})

describe('lunar -> Gregorian', () => {
  it('inverts known dates', () => {
    expect(lunarToGregorian({ year: 2024, month: 1, day: 1, leap: false })).toEqual({ y: 2024, m: 2, d: 10 })
    expect(lunarToGregorian({ year: 2025, month: 1, day: 1, leap: false })).toEqual({ y: 2025, m: 1, d: 29 })
    expect(lunarToGregorian({ year: 2023, month: 2, day: 1, leap: true })).toEqual({ y: 2023, m: 3, d: 22 })
    expect(lunarToGregorian({ year: 2023, month: 12, day: 30, leap: false })).toEqual({ y: 2024, m: 2, d: 9 })
  })
  it('returns null for nonexistent dates', () => {
    expect(lunarToGregorian({ year: 2024, month: 3, day: 1, leap: true })).toBeNull() // no leap 3rd month in 2024
    expect(lunarToGregorian({ year: 2023, month: 2, day: 31, leap: true })).toBeNull()
  })
  it('round-trips every day of a few years', () => {
    for (const y of [2000, 2023, 2024]) {
      for (let m = 1; m <= 12; m++) {
        const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
        for (const d of [1, 15, last]) {
          const l = gregorianToLunar(y, m, d)!
          expect(lunarToGregorian(l)).toEqual({ y, m, d })
        }
      }
    }
  })
  it('lists months with the leap month', () => {
    const ms = lunarMonths(2023)
    expect(ms).toHaveLength(13)
    expect(ms[2]).toMatchObject({ month: 2, leap: true })
    expect(lunarMonths(2024)).toHaveLength(12)
    expect(ms.every((m) => m.days === 29 || m.days === 30)).toBe(true)
  })
})

describe('solar terms', () => {
  // Published almanac times, UTC+8; we accept +-15 minutes.
  const known: [number, string, string][] = [
    [2024, '立春', '2024-02-04T16:27'],
    [2024, '春分', '2024-03-20T11:06'],
    [2024, '夏至', '2024-06-21T04:51'],
    [2024, '冬至', '2024-12-21T17:21'],
    [2025, '清明', '2025-04-04T20:48'],
  ]
  for (const [y, name, iso] of known) {
    it(`${y} ${name} ~ ${iso}`, () => {
      const t = solarTerms(y).find((x) => x.name === name)!
      const want = Date.parse(iso + ':00+08:00')
      expect(Math.abs(t.instant.getTime() - want)).toBeLessThan(15 * 60e3)
      expect(`${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`).toBe(iso.slice(0, 10))
    })
  }
  it('returns 24 increasing terms', () => {
    for (const y of [1999, 2024, 2050]) {
      const ts = solarTerms(y)
      expect(ts).toHaveLength(24)
      expect(ts[0].name).toBe('小寒')
      expect(ts[23].name).toBe('冬至')
      for (let i = 1; i < 24; i++) {
        const gap = (ts[i].instant.getTime() - ts[i - 1].instant.getTime()) / 86400e3
        expect(gap).toBeGreaterThan(13.5)
        expect(gap).toBeLessThan(16.5)
      }
    }
  })
  it('out of range -> empty', () => expect(solarTerms(1500)).toEqual([]))
  it('current term in force', () => {
    expect(currentSolarTerm(2024, 2, 4)).toMatchObject({ name: '立春', isTermDay: true })
    expect(currentSolarTerm(2024, 2, 5)).toMatchObject({ name: '立春', isTermDay: false })
    expect(currentSolarTerm(2024, 1, 1)?.name).toBe('冬至') // previous year's 冬至 (Dec 21)
    expect(currentSolarTerm(2024, 2, 30)).toBeNull()
  })
})
