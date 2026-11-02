/**
 * Pure maths behind the savings (compound interest) and loan calculators.
 * No Vue / DOM here so it can be unit-tested directly.
 */

/** How often a quoted rate is expressed: per year, month, week or day. */
export type RateUnit = 'year' | 'month' | 'week' | 'day'

const PERIODS_PER_YEAR: Record<RateUnit, number> = { year: 1, month: 12, week: 52, day: 365 }

/** Convert a rate (decimal, e.g. 0.05) quoted per `unit` to a nominal annual rate. */
export function toNominalAnnual(rate: number, unit: RateUnit): number {
  return rate * PERIODS_PER_YEAR[unit]
}

/**
 * Effective annual rate for a nominal annual rate compounded `perYear` times
 * a year. `perYear === 0` means continuous compounding.
 */
export function effectiveAnnualRate(nominal: number, perYear: number): number {
  if (perYear === 0) return Math.exp(nominal) - 1
  return Math.pow(1 + nominal / perYear, perYear) - 1
}

export interface SavingsInput {
  principal: number
  /** Nominal annual rate as a decimal. */
  nominalAnnual: number
  /** Compounding periods per year; 0 = continuous. Ignored when `simple`. */
  compoundsPerYear: number
  /** Whole months. */
  months: number
  /** Recurring deposit per contribution (0 = none). */
  contribution: number
  /** Contributions per year (12 monthly, 52 weekly, 4, 2, 1). */
  contributionsPerYear: number
  /** Deposit at the start of each period instead of the end. */
  contributeAtStart: boolean
  /** Simple interest (no compounding). */
  simple: boolean
}

export interface SavingsRow {
  /** 1-based year; the last row may cover a partial year. */
  year: number
  /** Cumulative money put in (principal + deposits). */
  deposited: number
  /** Cumulative interest earned. */
  interest: number
  balance: number
}

export interface SavingsResult {
  balance: number
  deposited: number
  interest: number
  /** Effective annual rate (decimal); equals the nominal rate for simple interest. */
  ear: number
  rows: SavingsRow[]
}

const EPS = 1e-9

function growth(input: SavingsInput, ear: number, years: number): number {
  return input.simple ? 1 + input.nominalAnnual * years : Math.pow(1 + ear, years)
}

function balanceAt(input: SavingsInput, ear: number, years: number): { balance: number; deposited: number } {
  const f = input.contributionsPerYear
  let balance = input.principal * growth(input, ear, years)
  let deposited = input.principal
  if (input.contribution > 0 && f > 0) {
    // End-of-period deposits land at k/f once that period has completed;
    // start-of-period deposits land at (k-1)/f as soon as the period begins.
    const n = input.contributeAtStart ? Math.ceil(years * f - EPS) : Math.floor(years * f + EPS)
    for (let k = 1; k <= n; k++) {
      const t = input.contributeAtStart ? (k - 1) / f : k / f
      balance += input.contribution * growth(input, ear, years - t)
      deposited += input.contribution
    }
  }
  return { balance, deposited }
}

/**
 * Project a savings balance. The balance grows by the effective annual rate,
 * so deposits that don't line up with a compounding date still accrue
 * proportionally — a common, easy-to-explain approximation.
 */
export function projectSavings(input: SavingsInput): SavingsResult {
  const ear = input.simple ? input.nominalAnnual : effectiveAnnualRate(input.nominalAnnual, input.compoundsPerYear)
  const totalYears = input.months / 12
  const rows: SavingsRow[] = []
  const lastYear = Math.ceil(totalYears - EPS)
  for (let y = 1; y <= lastYear; y++) {
    const at = Math.min(y, totalYears)
    const { balance, deposited } = balanceAt(input, ear, at)
    rows.push({ year: y, deposited, interest: balance - deposited, balance })
  }
  const end = balanceAt(input, ear, totalYears)
  return {
    balance: end.balance,
    deposited: end.deposited,
    interest: end.balance - end.deposited,
    ear,
    rows,
  }
}

/** Years for money to double at the given effective annual rate (compound). */
export function doublingYears(ear: number): number | null {
  if (!(ear > 0)) return null
  return Math.log(2) / Math.log(1 + ear)
}

export type LoanMethod = 'annuity' | 'principal' | 'interestOnly'

export type PrepayMode = 'shortenTerm' | 'reducePayment'

export interface LoanInput {
  principal: number
  /** Nominal annual rate as a decimal. */
  nominalAnnual: number
  months: number
  method: LoanMethod
  /** Interest-only months at the start (annuity / equal-principal only). */
  graceMonths: number
  /** Extra principal paid every month on top of the schedule (0 = none). */
  extraMonthly?: number
  /** One-off prepayment of principal (0 = none) made in month `lumpMonth`. */
  lumpSum?: number
  lumpMonth?: number
  /** After a prepayment: keep the payment and finish sooner, or keep the end date and pay less. */
  prepayMode?: PrepayMode
}

export interface LoanRow {
  period: number
  payment: number
  principal: number
  interest: number
  balance: number
  /** Part of `principal` that is a prepayment beyond the schedule. */
  extra: number
}

export interface LoanResult {
  rows: LoanRow[]
  totalInterest: number
  totalPaid: number
  firstPayment: number
  lastPayment: number
}

/** Level payment that amortises `principal` over `n` periods at rate `i` per period. */
export function annuityPayment(principal: number, i: number, n: number): number {
  if (n <= 0) return 0
  if (i === 0) return principal / n
  return (principal * i) / (1 - Math.pow(1 + i, -n))
}

/**
 * Build a repayment schedule. By default prepayments keep the scheduled payment
 * and shorten the term (the schedule may end before `months`); with
 * `prepayMode: 'reducePayment'` the term stays and the payment drops.
 */
export function buildLoan(input: LoanInput): LoanResult {
  const { principal, months, method } = input
  const i = input.nominalAnnual / 12
  const grace = method === 'interestOnly' ? 0 : Math.min(Math.max(Math.floor(input.graceMonths), 0), months - 1)
  const amortMonths = months - grace
  const rows: LoanRow[] = []
  let balance = principal
  let level = method === 'annuity' ? annuityPayment(principal, i, amortMonths) : 0
  let principalSlice = principal / Math.max(amortMonths, 1)
  const extraMonthly = Math.max(input.extraMonthly ?? 0, 0)
  const lumpSum = Math.max(input.lumpSum ?? 0, 0)
  const lumpMonth = Math.floor(input.lumpMonth ?? 0)

  for (let p = 1; p <= months; p++) {
    const interest = balance * i
    let scheduled: number
    if (method === 'interestOnly' || p <= grace) scheduled = interest
    else if (method === 'annuity') scheduled = level
    else scheduled = principalSlice + interest
    const extra = extraMonthly + (p === lumpMonth ? lumpSum : 0)
    let princ = Math.max(scheduled - interest, 0) + extra
    let paidExtra = extra
    // Final period (or paid off early): absorb drift and close at exactly zero.
    const closing = p === months || princ >= balance - 0.005
    if (closing) {
      paidExtra = Math.max(Math.min(extra, balance), 0)
      princ = balance
    }
    balance = closing ? 0 : balance - princ
    if (!closing && extra > 0 && input.prepayMode === 'reducePayment') {
      // Re-amortise what is left over the periods that remain, keeping the end date.
      const remaining = months - Math.max(p, grace)
      if (remaining > 0) {
        level = annuityPayment(balance, i, remaining)
        principalSlice = balance / remaining
      }
    }
    rows.push({ period: p, payment: princ + interest, principal: princ, interest, balance, extra: Math.min(paidExtra, princ) })
    if (closing) break
  }

  const totalPaid = rows.reduce((s, r) => s + r.payment, 0)
  return {
    rows,
    totalPaid,
    totalInterest: totalPaid - principal,
    firstPayment: rows[0]?.payment ?? 0,
    lastPayment: rows[rows.length - 1]?.payment ?? 0,
  }
}

/** Interest after tax, taxing the total interest earned at `taxRate` (decimal). */
export function afterTax(deposited: number, interest: number, taxRate: number): { tax: number; balance: number } {
  const tax = Math.max(interest, 0) * Math.min(Math.max(taxRate, 0), 1)
  return { tax, balance: deposited + interest - tax }
}

/** Express a future amount in today's purchasing power at `inflation` (decimal / year). */
export function realValue(amount: number, inflation: number, years: number): number {
  return amount / Math.pow(1 + inflation, years)
}
