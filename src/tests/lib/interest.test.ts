import { describe, it, expect } from 'vitest'
import {
  afterTax,
  annuityPayment,
  realValue,
  requiredContribution,
  buildLoan,
  doublingYears,
  effectiveAnnualRate,
  projectSavings,
  toNominalAnnual,
  type SavingsInput,
} from '@/lib/interest'

const base: SavingsInput = {
  principal: 10000,
  nominalAnnual: 0.05,
  compoundsPerYear: 12,
  months: 120,
  contribution: 0,
  contributionsPerYear: 12,
  contributeAtStart: false,
  simple: false,
}

describe('rates', () => {
  it('converts per-period rates to nominal annual', () => {
    expect(toNominalAnnual(0.01, 'month')).toBeCloseTo(0.12)
    expect(toNominalAnnual(0.05, 'year')).toBe(0.05)
    expect(toNominalAnnual(0.0001, 'day')).toBeCloseTo(0.0365)
  })

  it('computes effective annual rate', () => {
    expect(effectiveAnnualRate(0.12, 12)).toBeCloseTo(0.126825, 6)
    expect(effectiveAnnualRate(0.05, 1)).toBeCloseTo(0.05)
    expect(effectiveAnnualRate(0.05, 0)).toBeCloseTo(Math.exp(0.05) - 1)
  })

  it('doubling time follows the rule of 72 roughly', () => {
    expect(doublingYears(0.06)).toBeCloseTo(11.9, 1)
    expect(doublingYears(0)).toBeNull()
  })
})

describe('projectSavings()', () => {
  it('matches the compound-interest formula for a lump sum', () => {
    const r = projectSavings(base)
    expect(r.balance).toBeCloseTo(10000 * Math.pow(1 + 0.05 / 12, 120), 4)
    expect(r.deposited).toBe(10000)
    expect(r.interest).toBeCloseTo(r.balance - 10000)
    expect(r.rows).toHaveLength(10)
    expect(r.rows[9].balance).toBeCloseTo(r.balance)
  })

  it('simple interest is linear', () => {
    const r = projectSavings({ ...base, simple: true })
    expect(r.balance).toBeCloseTo(15000)
  })

  it('matches the future-value-of-annuity formula (monthly, end of period)', () => {
    const r = projectSavings({ ...base, principal: 0, contribution: 100, compoundsPerYear: 12 })
    const i = 0.05 / 12
    expect(r.balance).toBeCloseTo((100 * (Math.pow(1 + i, 120) - 1)) / i, 4)
    expect(r.deposited).toBe(12000)
  })

  it('annuity-due (start of period) is one period of interest higher', () => {
    const end = projectSavings({ ...base, principal: 0, contribution: 100 })
    const start = projectSavings({ ...base, principal: 0, contribution: 100, contributeAtStart: true })
    expect(start.balance).toBeCloseTo(end.balance * (1 + 0.05 / 12), 4)
    expect(start.deposited).toBe(12000)
  })

  it('handles a partial final year', () => {
    const r = projectSavings({ ...base, months: 18 })
    expect(r.rows).toHaveLength(2)
    expect(r.rows[1].balance).toBeCloseTo(r.balance)
  })

  it('zero rate just sums deposits', () => {
    const r = projectSavings({ ...base, nominalAnnual: 0, contribution: 50 })
    expect(r.balance).toBeCloseTo(10000 + 50 * 120)
    expect(r.interest).toBeCloseTo(0)
  })
})

describe('buildLoan()', () => {
  it('annuity payment matches the standard formula', () => {
    // 1,000,000 at 2% for 30 years
    const pmt = annuityPayment(1_000_000, 0.02 / 12, 360)
    expect(pmt).toBeCloseTo(3696.19, 1)
    const r = buildLoan({ principal: 1_000_000, nominalAnnual: 0.02, months: 360, method: 'annuity', graceMonths: 0 })
    expect(r.rows).toHaveLength(360)
    expect(r.firstPayment).toBeCloseTo(pmt)
    expect(r.rows[359].balance).toBe(0)
    expect(r.totalInterest).toBeCloseTo(pmt * 360 - 1_000_000, 4)
  })

  it('equal principal has a decreasing payment', () => {
    const r = buildLoan({ principal: 120000, nominalAnnual: 0.12, months: 12, method: 'principal', graceMonths: 0 })
    expect(r.firstPayment).toBeCloseTo(10000 + 1200)
    expect(r.lastPayment).toBeCloseTo(10000 + 100)
    expect(r.rows.every((x) => Math.abs(x.principal - 10000) < 1e-6)).toBe(true)
  })

  it('interest-only repays principal in the last period', () => {
    const r = buildLoan({ principal: 100000, nominalAnnual: 0.06, months: 12, method: 'interestOnly', graceMonths: 5 })
    expect(r.rows[0].payment).toBeCloseTo(500)
    expect(r.lastPayment).toBeCloseTo(100500)
    expect(r.totalInterest).toBeCloseTo(6000)
  })

  it('grace period pays interest only, then amortises', () => {
    const r = buildLoan({ principal: 120000, nominalAnnual: 0.12, months: 24, method: 'annuity', graceMonths: 6 })
    expect(r.rows[5].principal).toBeCloseTo(0)
    expect(r.rows[5].balance).toBeCloseTo(120000)
    expect(r.rows[6].principal).toBeGreaterThan(0)
    expect(r.rows[23].balance).toBe(0)
    expect(r.rows[6].payment).toBeCloseTo(annuityPayment(120000, 0.01, 18))
  })

  it('zero-rate loan splits evenly', () => {
    const r = buildLoan({ principal: 1200, nominalAnnual: 0, months: 12, method: 'annuity', graceMonths: 0 })
    expect(r.firstPayment).toBeCloseTo(100)
    expect(r.totalInterest).toBeCloseTo(0)
  })

  it('clamps an oversized grace period', () => {
    const r = buildLoan({ principal: 1200, nominalAnnual: 0.06, months: 3, method: 'annuity', graceMonths: 99 })
    expect(r.rows[2].balance).toBe(0)
  })
})

describe('prepayment', () => {
  const loan = { principal: 1_000_000, nominalAnnual: 0.03, months: 240, method: 'annuity' as const, graceMonths: 0 }

  it('extra monthly payment shortens the term and saves interest', () => {
    const plain = buildLoan(loan)
    const fast = buildLoan({ ...loan, extraMonthly: 5000 })
    expect(fast.rows.length).toBeLessThan(plain.rows.length)
    expect(fast.totalInterest).toBeLessThan(plain.totalInterest)
    expect(fast.rows[fast.rows.length - 1].balance).toBe(0)
    expect(fast.rows[0].extra).toBe(5000)
  })

  it('a lump sum lowers the balance but keeps the payment', () => {
    const plain = buildLoan(loan)
    const lump = buildLoan({ ...loan, lumpSum: 200000, lumpMonth: 12 })
    expect(lump.rows[11].extra).toBe(200000)
    expect(lump.rows[11].balance).toBeLessThan(plain.rows[11].balance - 199000)
    expect(lump.rows[0].payment).toBeCloseTo(plain.rows[0].payment)
    expect(lump.rows.length).toBeLessThan(plain.rows.length)
  })

  it('reducePayment keeps the term and lowers later payments', () => {
    const plain = buildLoan(loan)
    const r = buildLoan({ ...loan, lumpSum: 200000, lumpMonth: 12, prepayMode: 'reducePayment' })
    expect(r.rows).toHaveLength(240)
    expect(r.rows[12].payment).toBeLessThan(plain.rows[12].payment)
    expect(r.rows[239].balance).toBe(0)
    expect(r.rows[12].payment).toBeCloseTo(annuityPayment(r.rows[11].balance, 0.03 / 12, 228))
    expect(r.totalInterest).toBeLessThan(plain.totalInterest)
  })

  it('reducePayment works for equal-principal loans', () => {
    const r = buildLoan({ principal: 120000, nominalAnnual: 0, months: 12, method: 'principal', graceMonths: 0, lumpSum: 30000, lumpMonth: 6, prepayMode: 'reducePayment' })
    expect(r.rows).toHaveLength(12)
    expect(r.rows[6].principal).toBeCloseTo(5000, 4)
  })

  it('an oversized prepayment closes the loan without overpaying', () => {
    const r = buildLoan({ ...loan, lumpSum: 5_000_000, lumpMonth: 3 })
    expect(r.rows).toHaveLength(3)
    expect(r.rows[2].balance).toBe(0)
    expect(r.rows[2].principal).toBeCloseTo(r.rows[1].balance)
  })
})

describe('tax & inflation', () => {
  it('taxes only the interest', () => {
    const r = afterTax(10000, 2000, 0.1)
    expect(r.tax).toBeCloseTo(200)
    expect(r.balance).toBeCloseTo(11800)
  })
  it('discounts by inflation', () => {
    expect(realValue(1000, 0.02, 10)).toBeCloseTo(820.35, 1)
    expect(realValue(1000, 0, 10)).toBe(1000)
  })
})

describe('requiredContribution()', () => {
  const { contribution: _c, ...input } = { ...base, principal: 5000 }
  void _c

  it('reaching the target with the solved deposit', () => {
    const c = requiredContribution(input, 100000)!
    expect(c).toBeGreaterThan(0)
    expect(projectSavings({ ...input, contribution: c }).balance).toBeCloseTo(100000, 4)
  })

  it('is zero when the lump sum already gets there', () => {
    expect(requiredContribution(input, 6000)).toBe(0)
  })

  it('with no interest it is a straight division', () => {
    const c = requiredContribution({ ...input, nominalAnnual: 0, principal: 0 }, 12000)!
    expect(c).toBeCloseTo(100) // 120 monthly deposits
  })
})
