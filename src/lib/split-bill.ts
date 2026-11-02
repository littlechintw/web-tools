/**
 * Bill splitting in whole currency units (e.g. whole TWD).
 *
 * Each person has paid some amount and carries a weight (1 = a normal share,
 * 0 = did not take part, 2 = a double share…). The total is divided by weight
 * using the largest-remainder method, so the shares always add up to the total
 * exactly; ties are broken by list order (lower index gets the extra unit).
 * Settlement uses the standard greedy matching of the biggest debtor with the
 * biggest creditor, which needs at most (people - 1) transfers.
 */

export interface Person {
  name: string
  /** Whole units the person paid. */
  paid: number
  /** Share weight, >= 0. */
  weight: number
}

export interface Transfer {
  from: number
  to: number
  amount: number
}

export interface SplitResult {
  total: number
  /** Each person's share of the total (sums to `total`). */
  shares: number[]
  /** paid - share: positive = should receive, negative = should pay. Sums to 0. */
  balances: number[]
  transfers: Transfer[]
}

/** Divide `total` by integer-ish weights, remainder by largest fraction, ties by index. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0) return weights.map(() => 0)
  const exact = weights.map((w) => (total * w) / sum)
  const shares = exact.map(Math.floor)
  let left = total - shares.reduce((a, b) => a + b, 0)
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e), w: weights[i] }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; left > 0 && order.length > 0; k = (k + 1) % order.length) {
    shares[order[k].i] += 1
    left -= 1
  }
  return shares
}

/** Greedy minimal settlement of balances that sum to zero. */
export function settle(balances: number[]): Transfer[] {
  const rest = balances.slice()
  const transfers: Transfer[] = []
  for (;;) {
    let to = -1
    let from = -1
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] > 0 && (to < 0 || rest[i] > rest[to])) to = i
      if (rest[i] < 0 && (from < 0 || rest[i] < rest[from])) from = i
    }
    if (to < 0 || from < 0) break
    const amount = Math.min(rest[to], -rest[from])
    transfers.push({ from, to, amount })
    rest[to] -= amount
    rest[from] += amount
  }
  return transfers
}

/** Returns null when the input can't be split (no people, bad numbers, nobody shares a bill that has a total). */
export function splitBill(people: Person[]): SplitResult | null {
  if (people.length === 0) return null
  for (const p of people) {
    if (!Number.isFinite(p.paid) || p.paid < 0 || !Number.isFinite(p.weight) || p.weight < 0) return null
    if (!Number.isSafeInteger(Math.round(p.paid))) return null
  }
  const paid = people.map((p) => Math.round(p.paid))
  const total = paid.reduce((a, b) => a + b, 0)
  if (!Number.isSafeInteger(total) || total > 1e12) return null
  const weights = people.map((p) => p.weight)
  if (total > 0 && weights.every((w) => w === 0)) return null
  const shares = allocate(total, weights)
  const balances = paid.map((p, i) => p - shares[i])
  return { total, shares, balances, transfers: settle(balances) }
}
