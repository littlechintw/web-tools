import { describe, it, expect } from 'vitest'
import { buildTwqr, formatAccount, isShortAccount, isValidAccount, maskAccount, normalizeAccount, parseTwqr } from '@/lib/twqr'
import { TW_BANKS, bankName } from '@/lib/twBanks'

describe('buildTwqr()', () => {
  it('pads the account to 16 digits and omits the amount when unset', () => {
    expect(buildTwqr({ bankCode: '822', account: '1234567890' })).toBe(
      'TWQRP://xn--gmqw5ax42ad01c/158/02/V1?D5=822&D6=0000001234567890&D10=901',
    )
  })

  it('encodes the amount in cents', () => {
    expect(buildTwqr({ bankCode: '822', account: '1234567890', amount: 150 })).toContain('&D1=15000&')
  })

  it('caps the amount at 7 integer digits (D1 = XXXXXXX00)', () => {
    expect(buildTwqr({ bankCode: '822', account: '1234567890', amount: 9_999_999 })).toContain('&D1=999999900&')
    expect(buildTwqr({ bankCode: '822', account: '1234567890', amount: 10_000_000 })).toBeNull()
  })

  it('matches the published example (bank 001, account 598759875987, 3254)', () => {
    // From the PTT analysis; only the free-form service-name part differs.
    const q = buildTwqr({ bankCode: '001', account: '598759875987', amount: 3254 })!
    expect(q.split('?')[0].endsWith('/158/02/V1')).toBe(true)
    const params = new URLSearchParams(q.split('?')[1])
    expect(params.get('D1')).toBe('325400')
    expect(params.get('D5')).toBe('001')
    expect(params.get('D6')).toBe('0000598759875987')
  })

  it('treats amount 0 as "not set"', () => {
    expect(buildTwqr({ bankCode: '822', account: '1234567890', amount: 0 })).not.toContain('D1=')
  })

  it('rejects invalid amounts, banks and accounts', () => {
    expect(buildTwqr({ bankCode: '822', account: '1234567890', amount: -5 })).toBeNull()
    expect(buildTwqr({ bankCode: '822', account: '1234567890', amount: 1.5 })).toBeNull()
    expect(buildTwqr({ bankCode: '82', account: '1234567890' })).toBeNull()
    expect(buildTwqr({ bankCode: '822', account: 'abc' })).toBeNull()
  })

  it('cleans pasted account numbers (spaces, dashes, zero-width chars)', () => {
    const a = buildTwqr({ bankCode: '822', account: '0012-3456 7890​' })
    expect(a).toBe(buildTwqr({ bankCode: '822', account: '1234567890' }))
  })

  it('round-trips through parseTwqr, including a Chinese note', () => {
    const q = buildTwqr({ bankCode: '004', account: '123456789012', amount: 250, note: '午餐 AA' })!
    expect(parseTwqr(q)).toEqual({ bankCode: '004', account: '123456789012', amount: 250, note: '午餐 AA' })
  })

  it('truncates long notes', () => {
    const q = buildTwqr({ bankCode: '004', account: '123456789012', note: 'x'.repeat(50) })!
    expect(parseTwqr(q)!.note).toHaveLength(20)
  })
})

describe('parseTwqr()', () => {
  it('rejects non-TWQR text', () => {
    expect(parseTwqr('https://example.com')).toBeNull()
    expect(parseTwqr('TWQRP://x/158/02/V1?D5=12&D6=1')).toBeNull()
  })
})

describe('account helpers', () => {
  it('normalizes', () => {
    expect(normalizeAccount('000-123 456')).toBe('123456')
    expect(normalizeAccount('1'.repeat(30))).toHaveLength(16)
  })
  it('validates', () => {
    expect(isValidAccount('1234567890')).toBe(true)
    expect(isValidAccount('123456789')).toBe(false)
    expect(isShortAccount('123456789')).toBe(true)
  })
  it('masks and formats', () => {
    expect(maskAccount('1234567890')).toBe('•••• •••• 7890')
    expect(formatAccount('1234567890')).toBe('0012 3456 7890')
  })
})

describe('bank list', () => {
  it('has unique 3-digit codes', () => {
    expect(TW_BANKS.length).toBeGreaterThan(50)
    const codes = TW_BANKS.map(([c]) => c)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.every((c) => /^\d{3}$/.test(c))).toBe(true)
  })
  it('looks up names', () => {
    expect(bankName('004')).toBe('臺灣銀行')
    expect(bankName('000')).toBe('')
  })
})
