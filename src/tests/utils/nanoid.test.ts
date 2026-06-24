import { describe, it, expect } from 'vitest'
import { nanoid } from '@/utils/nanoid'

const URL_SAFE = /^[A-Za-z0-9_-]+$/

describe('nanoid', () => {
  it('default length is 21', () => {
    expect(nanoid().length).toBe(21)
  })

  it('custom length', () => {
    expect(nanoid(10).length).toBe(10)
    expect(nanoid(36).length).toBe(36)
  })

  it('only URL-safe characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(nanoid()).toMatch(URL_SAFE)
    }
  })

  it('produces unique IDs', () => {
    const ids = new Set(Array.from({ length: 500 }, () => nanoid()))
    expect(ids.size).toBe(500)
  })

  it('returns a string', () => {
    expect(typeof nanoid()).toBe('string')
  })
})
