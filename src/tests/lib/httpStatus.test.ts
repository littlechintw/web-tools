import { describe, it, expect } from 'vitest'
import { classOf, LANGS, searchStatus, STATUS_CODES } from '@/lib/httpStatus'

const by = (c: number) => STATUS_CODES.find((s) => s.code === c)

describe('STATUS_CODES data', () => {
  it('every code is unique and in range', () => {
    const codes = STATUS_CODES.map((s) => s.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.every((c) => c >= 100 && c <= 599)).toBe(true)
  })

  it('contains the notable codes', () => {
    for (const c of [100, 101, 103, 200, 204, 206, 301, 304, 307, 308, 400, 401, 403, 404, 418, 421, 422, 425, 426, 428, 429, 431, 451, 500, 502, 503, 504, 511]) {
      expect(by(c), String(c)).toBeDefined()
    }
    expect(by(418)?.name).toBe("I'm a teapot")
    expect(by(404)?.name).toBe('Not Found')
  })

  it('has non-empty text in all four languages for every code', () => {
    for (const s of STATUS_CODES) {
      for (const l of LANGS) {
        expect(s.meaning[l]?.trim(), `${s.code} meaning ${l}`).toBeTruthy()
        expect(s.when[l]?.trim(), `${s.code} when ${l}`).toBeTruthy()
      }
    }
  })

  it('is sorted ascending and derives the class from the code', () => {
    const codes = STATUS_CODES.map((s) => s.code)
    expect(codes).toEqual([...codes].sort((a, b) => a - b))
    expect(classOf(103)).toBe(1)
    expect(classOf(226)).toBe(2)
    expect(classOf(308)).toBe(3)
    expect(classOf(451)).toBe(4)
    expect(classOf(511)).toBe(5)
    for (const s of STATUS_CODES) expect(s.cls).toBe(Math.floor(s.code / 100))
  })
})

describe('searchStatus', () => {
  it('returns everything for an empty query', () => {
    expect(searchStatus(STATUS_CODES, '  ')).toHaveLength(STATUS_CODES.length)
  })

  it('matches by exact code and code prefix', () => {
    expect(searchStatus(STATUS_CODES, '404').map((s) => s.code)).toEqual([404])
    const p = searchStatus(STATUS_CODES, '40').map((s) => s.code)
    expect(p).toContain(400)
    expect(p).toContain(408)
    expect(p.every((c) => String(c).startsWith('40'))).toBe(true)
    expect(p).not.toContain(410)
  })

  it('matches by name case-insensitively and by localized keyword', () => {
    expect(searchStatus(STATUS_CODES, 'teapot').map((s) => s.code)).toEqual([418])
    expect(searchStatus(STATUS_CODES, '茶壺').map((s) => s.code)).toContain(418)
    expect(searchStatus(STATUS_CODES, 'レート制限').map((s) => s.code)).toContain(429)
    expect(searchStatus(STATUS_CODES, 'captive').map((s) => s.code)).toContain(511)
  })

  it('combines tokens with AND and filters by class', () => {
    expect(searchStatus(STATUS_CODES, 'not found').map((s) => s.code)).toContain(404)
    expect(searchStatus(STATUS_CODES, 'teapot timeout')).toEqual([])
    const only5 = searchStatus(STATUS_CODES, '', 5)
    expect(only5.length).toBeGreaterThan(5)
    expect(only5.every((s) => s.cls === 5)).toBe(true)
    expect(searchStatus(STATUS_CODES, 'timeout', 5).map((s) => s.code)).toEqual([504])
  })

  it('returns nothing for gibberish', () => {
    expect(searchStatus(STATUS_CODES, 'zzzzqqq')).toEqual([])
  })
})
