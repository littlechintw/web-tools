/**
 * TWQR personal-transfer ("個人轉帳") payload builder.
 *
 *   TWQRP://<any service name>/158/02/V1?D5=<bank>&D6=<16-digit account>[&D1=<amount×100>]&D10=901[&D9=<note>]
 *
 *   158 = ISO 3166 numeric code for Taiwan, 02 = transfer-type transaction
 *   D1  = amount with two implied decimals (XXXXXXX00 — at most 7 integer digits)
 *   D5  = receiving bank code (3 digits)
 *   D6  = receiving account, left-padded with zeros to 16 digits
 *   D9  = note, D10 = ISO 4217 currency (901 = TWD, the default)
 *
 * D-parameters are locked once set: the payer cannot edit them. Leaving D1 out
 * makes the payer's banking app ask for the amount.
 *
 * NOT an official FISC document. Sources:
 *  - community analysis: https://www.ptt.cc/bbs/MobilePay/M.1543779469.A.577.html
 *    (the only source for the type-02 transfer fields D5/D6/D9)
 *  - the MIT-licensed OpenTWQR project (github.com/garyellow/OpenTWQR)
 *  - patent TW M575888 U (臺灣行動支付), Fig. 5: confirms the overall layout
 *    `TWQRP://name/158/<type>/V1?D…&E…&O…`, D1 = amount×100 and D10 = 901, using a
 *    type-01 (purchase) example. It does not cover type 02 or D5/D6.
 *  - FISC's public article (金融資訊 No.91) only describes the overall structure.
 */

const BASE_URI = 'TWQRP://xn--gmqw5ax42ad01c/158/02/V1'

export const MAX_NOTE_LENGTH = 20
/** D1 holds at most 7 integer digits. */
export const MAX_AMOUNT = 9_999_999

/** Strip zero-width / control / bidi-override characters pasted from elsewhere. */
export function removeInvisibleChars(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮﻿]/g, '')
}

/** Digits only, no leading-zero padding, at most 16 digits. */
export function normalizeAccount(account: string): string {
  return removeInvisibleChars(account).replace(/\D/g, '').replace(/^0+/, '').slice(0, 16)
}

export const isValidAccount = (a: string): boolean => /^\d{10,16}$/.test(a)

/** Digits-only but shorter than a bank account (e-wallets may legitimately do this). */
export const isShortAccount = (a: string): boolean => /^\d{1,9}$/.test(a)

/** Show only the last 4 digits, e.g. `•••• •••• 1234`. */
export function maskAccount(account: string): string {
  if (account.length <= 4) return account
  const groups = Math.ceil(account.length / 4) - 1
  return [...Array.from({ length: groups }, () => '••••'), account.slice(-4)].join(' ')
}

/** Full number, padded to a multiple of 4 and grouped: `0012 3456 7890`. */
export function formatAccount(account: string): string {
  if (!account) return ''
  const padded = account.padStart(Math.ceil(account.length / 4) * 4, '0')
  return padded.replace(/(.{4})/g, '$1 ').trim()
}

export interface TwqrInput {
  bankCode: string
  account: string
  /** Whole TWD; omit / 0 to let the payer type it. */
  amount?: number
  note?: string
}

export function isValidAmount(n: number): boolean {
  return Number.isInteger(n) && n > 0 && n <= MAX_AMOUNT
}

/** Returns null when the bank code or account can't make a valid payload. */
export function buildTwqr(input: TwqrInput): string | null {
  const account = normalizeAccount(input.account)
  if (!/^\d{3}$/.test(input.bankCode) || !/^\d{1,16}$/.test(account)) return null
  const q = new URLSearchParams()
  q.append('D5', input.bankCode)
  q.append('D6', account.padStart(16, '0'))
  if (input.amount !== undefined && input.amount !== 0) {
    if (!isValidAmount(input.amount)) return null
    q.append('D1', String(input.amount * 100))
  }
  q.append('D10', '901')
  const note = removeInvisibleChars(input.note ?? '').trim().slice(0, MAX_NOTE_LENGTH)
  if (note) q.append('D9', note)
  return `${BASE_URI}?${q.toString()}`
}

export interface ParsedTwqr {
  bankCode: string
  account: string
  amount: number
  note?: string
}

/** Inverse of buildTwqr (used to verify a payload round-trips). */
export function parseTwqr(text: string): ParsedTwqr | null {
  if (!/^TWQRP:\/\//i.test(text)) return null
  try {
    const params = new URL(text.replace(/^TWQRP:\/\//i, 'https://')).searchParams
    const bankCode = params.get('D5')
    const padded = params.get('D6')
    if (!bankCode || !padded || !/^\d{3}$/.test(bankCode) || !/^\d{16}$/.test(padded)) return null
    const d1 = params.get('D1')
    return {
      bankCode,
      account: padded.replace(/^0+/, '') || '0',
      amount: d1 && /^\d+$/.test(d1) ? Number(d1) / 100 : 0,
      note: params.get('D9') ?? undefined,
    }
  } catch {
    return null
  }
}
