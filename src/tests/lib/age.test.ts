import { describe, expect, it } from 'vitest'
import {
  addMonths, animalForLunarYear, chineseZodiac, daysBetween, daysLived, exactAge, minguoYear,
  nextBirthday, parseYMD, weekday, westernSign,
} from '@/lib/age'

const D = (s: string) => parseYMD(s)!

describe('parseYMD', () => {
  it('accepts valid and rejects invalid dates', () => {
    expect(parseYMD('2000-02-29')).toEqual({ y: 2000, m: 2, d: 29 })
    expect(parseYMD('1900-02-29')).toBeNull()
    expect(parseYMD('2023-13-01')).toBeNull()
    expect(parseYMD('')).toBeNull()
    expect(parseYMD('2023-4-1')).toBeNull()
  })
})

describe('exactAge', () => {
  it('basic', () => {
    expect(exactAge(D('1990-05-15'), D('2024-03-10'))).toEqual({ years: 33, months: 9, days: 24 })
    expect(exactAge(D('1990-05-15'), D('2024-05-15'))).toEqual({ years: 34, months: 0, days: 0 })
    expect(exactAge(D('2024-03-10'), D('2024-03-10'))).toEqual({ years: 0, months: 0, days: 0 })
  })
  it('month-end clamping', () => {
    // Jan 31 -> Mar 1: one month (Feb 28) plus 1 day
    expect(exactAge(D('2023-01-31'), D('2023-03-01'))).toEqual({ years: 0, months: 1, days: 1 })
  })
  it('leap-day birthday observed on Feb 28 in common years', () => {
    expect(exactAge(D('2000-02-29'), D('2023-02-27'))).toEqual({ years: 22, months: 11, days: 29 })
    expect(exactAge(D('2000-02-29'), D('2023-02-28'))).toEqual({ years: 23, months: 0, days: 0 })
    expect(exactAge(D('2000-02-29'), D('2024-02-29'))).toEqual({ years: 24, months: 0, days: 0 })
  })
  it('future birth date -> null', () => {
    expect(exactAge(D('2030-01-01'), D('2024-01-01'))).toBeNull()
    expect(daysLived(D('2030-01-01'), D('2024-01-01'))).toBeNull()
  })
})

describe('days and weekdays', () => {
  it('days lived', () => {
    expect(daysLived(D('2000-01-01'), D('2000-01-02'))).toBe(1)
    expect(daysLived(D('2000-01-01'), D('2001-01-01'))).toBe(366)
    expect(daysBetween(D('1970-01-01'), D('2000-01-01'))).toBe(10957)
  })
  it('weekday', () => {
    expect(weekday(D('2000-01-01'))).toBe(6) // Saturday
    expect(weekday(D('1970-01-01'))).toBe(4) // Thursday
  })
  it('addMonths clamps', () => {
    expect(addMonths(D('2000-02-29'), 12)).toEqual({ y: 2001, m: 2, d: 28 })
    expect(addMonths(D('2000-01-31'), 1)).toEqual({ y: 2000, m: 2, d: 29 })
  })
})

describe('nextBirthday', () => {
  it('later this year', () => {
    const n = nextBirthday(D('1990-12-25'), D('2024-12-01'))!
    expect(n.date).toEqual({ y: 2024, m: 12, d: 25 })
    expect(n.daysUntil).toBe(24)
    expect(n.turning).toBe(34)
    expect(n.weekday).toBe(3) // Wednesday
  })
  it('today is the birthday', () => {
    expect(nextBirthday(D('1990-05-15'), D('2024-05-15'))!.daysUntil).toBe(0)
  })
  it('already passed this year', () => {
    const n = nextBirthday(D('1990-01-10'), D('2024-06-01'))!
    expect(n.date).toEqual({ y: 2025, m: 1, d: 10 })
    expect(n.turning).toBe(35)
  })
  it('leap-day birthday', () => {
    const a = nextBirthday(D('2000-02-29'), D('2023-03-01'))!
    expect(a.date).toEqual({ y: 2024, m: 2, d: 29 })
    const b = nextBirthday(D('2000-02-29'), D('2022-12-01'))!
    expect(b.date).toEqual({ y: 2023, m: 2, d: 28 })
    expect(b.daysUntil).toBe(89)
  })
})

describe('minguo', () => {
  it('converts', () => {
    expect(minguoYear(2024)).toEqual({ before: false, year: 113 })
    expect(minguoYear(1912)).toEqual({ before: false, year: 1 })
    expect(minguoYear(1911)).toEqual({ before: true, year: 1 })
  })
})

describe('zodiac', () => {
  it('western boundaries', () => {
    expect(westernSign(12, 21)).toBe('sagittarius')
    expect(westernSign(12, 22)).toBe('capricorn')
    expect(westernSign(1, 19)).toBe('capricorn')
    expect(westernSign(1, 20)).toBe('aquarius')
    expect(westernSign(3, 20)).toBe('pisces')
    expect(westernSign(3, 21)).toBe('aries')
    expect(westernSign(7, 22)).toBe('cancer')
    expect(westernSign(7, 23)).toBe('leo')
    expect(westernSign(2, 29)).toBe('pisces')
  })
  it('animal by lunar year', () => {
    expect(animalForLunarYear(1984)).toBe('rat')
    expect(animalForLunarYear(2024)).toBe('dragon')
    expect(animalForLunarYear(2000)).toBe('dragon')
    expect(animalForLunarYear(1999)).toBe('rabbit')
  })
  it('flips at Lunar New Year (Intl chinese calendar)', () => {
    // CNY 2000 = Feb 5; CNY 2024 = Feb 10
    expect(chineseZodiac(D('2000-02-04')).animal).toBe('rabbit')
    expect(chineseZodiac(D('2000-02-05')).animal).toBe('dragon')
    expect(chineseZodiac(D('2024-02-09')).animal).toBe('rabbit')
    expect(chineseZodiac(D('2024-02-10')).animal).toBe('dragon')
    expect(chineseZodiac(D('2024-02-10')).approximate).toBe(false)
  })
})
