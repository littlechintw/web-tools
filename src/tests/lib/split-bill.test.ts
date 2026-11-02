import { describe, it, expect } from 'vitest'
import { allocate, settle, splitBill } from '@/lib/split-bill'

const P = (paid: number, weight = 1) => ({ name: '', paid, weight })

function apply(balances: number[], transfers: { from: number; to: number; amount: number }[]) {
  const b = balances.slice()
  for (const t of transfers) {
    b[t.from] += t.amount
    b[t.to] -= t.amount
  }
  return b
}

describe('allocate', () => {
  it('splits evenly when divisible', () => {
    expect(allocate(300, [1, 1, 1])).toEqual([100, 100, 100])
  })
  it('gives the remainder to the earliest people on ties', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(allocate(101, [1, 1, 1])).toEqual([34, 34, 33])
  })
  it('respects weights and zero weight', () => {
    expect(allocate(300, [2, 1, 0])).toEqual([200, 100, 0])
    expect(allocate(10, [1, 0, 1])).toEqual([5, 0, 5])
  })
  it('largest remainder wins over order', () => {
    // exact: 3.33, 3.33, 3.33 -> same; use 1:2 weights of 10 -> 3.33, 6.67
    expect(allocate(10, [1, 2])).toEqual([3, 7])
  })
  it('always sums to the total', () => {
    for (const total of [0, 1, 7, 99, 1001]) {
      expect(allocate(total, [1, 3, 2, 5]).reduce((a, b) => a + b, 0)).toBe(total)
    }
  })
})

describe('settle', () => {
  it('handles a single debtor and creditor', () => {
    expect(settle([50, -50])).toEqual([{ from: 1, to: 0, amount: 50 }])
  })
  it('empty when everyone is even', () => {
    expect(settle([0, 0, 0])).toEqual([])
  })
  it('matches largest with largest', () => {
    // +70, +30, -60, -40
    expect(settle([70, 30, -60, -40])).toEqual([
      { from: 2, to: 0, amount: 60 },
      { from: 3, to: 1, amount: 30 },
      { from: 3, to: 0, amount: 10 },
    ])
  })
  it('zeroes balances and uses at most n-1 transfers (randomised)', () => {
    let seed = 12345
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    for (let run = 0; run < 200; run++) {
      const n = 2 + Math.floor(rnd() * 7)
      const b = Array.from({ length: n - 1 }, () => Math.round((rnd() - 0.5) * 1000))
      b.push(-b.reduce((a, c) => a + c, 0))
      const tr = settle(b)
      expect(tr.length).toBeLessThanOrEqual(n - 1)
      expect(apply(b, tr).every((x) => x === 0)).toBe(true)
      expect(tr.every((t) => t.amount > 0 && t.from !== t.to)).toBe(true)
    }
  })
})

describe('splitBill', () => {
  it('computes the classic 3-person example', () => {
    // A paid 900, B paid 300, C paid 0: total 1200, share 400 each
    const r = splitBill([P(900), P(300), P(0)])!
    expect(r.total).toBe(1200)
    expect(r.shares).toEqual([400, 400, 400])
    expect(r.balances).toEqual([500, -100, -400])
    expect(r.transfers).toEqual([
      { from: 2, to: 0, amount: 400 },
      { from: 1, to: 0, amount: 100 },
    ])
  })
  it('handles remainder exactly (100 among 3)', () => {
    const r = splitBill([P(100), P(0), P(0)])!
    expect(r.shares).toEqual([34, 33, 33])
    expect(r.balances.reduce((a, b) => a + b, 0)).toBe(0)
    expect(apply(r.balances, r.transfers).every((x) => x === 0)).toBe(true)
  })
  it('excludes people with weight 0', () => {
    const r = splitBill([P(200), P(0, 0), P(0)])!
    expect(r.shares).toEqual([100, 0, 100])
    expect(r.transfers).toEqual([{ from: 2, to: 0, amount: 100 }])
  })
  it('zero total needs no transfers', () => {
    const r = splitBill([P(0), P(0)])!
    expect(r.total).toBe(0)
    expect(r.transfers).toEqual([])
  })
  it('rejects bad input', () => {
    expect(splitBill([])).toBeNull()
    expect(splitBill([P(-5), P(10)])).toBeNull()
    expect(splitBill([P(NaN), P(10)])).toBeNull()
    expect(splitBill([P(100, 0), P(0, 0)])).toBeNull()
    expect(splitBill([P(10, -1), P(0)])).toBeNull()
  })
  it('transfers never exceed people - 1', () => {
    const r = splitBill([P(1234), P(50), P(0), P(999), P(7)])!
    expect(r.transfers.length).toBeLessThanOrEqual(4)
    expect(apply(r.balances, r.transfers).every((x) => x === 0)).toBe(true)
  })
})
