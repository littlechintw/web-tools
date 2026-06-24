export const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

export function parseToBigInt(str: string, base: number): bigint {
  let s = str.trim().toLowerCase()
  if (!s) throw new Error('empty')
  let neg = false
  if (s.startsWith('-')) {
    neg = true
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }
  if (!s) throw new Error('empty')
  const bigBase = BigInt(base)
  let result = 0n
  for (const ch of s) {
    const d = DIGITS.indexOf(ch)
    if (d < 0 || d >= base) throw new Error('invalid digit')
    result = result * bigBase + BigInt(d)
  }
  return neg ? -result : result
}

export function bigIntToBase(value: bigint, base: number): string {
  if (value === 0n) return '0'
  const neg = value < 0n
  let v = neg ? -value : value
  const bigBase = BigInt(base)
  let out = ''
  while (v > 0n) {
    const rem = Number(v % bigBase)
    out = DIGITS[rem] + out
    v = v / bigBase
  }
  return (neg ? '-' : '') + out
}

/** Convert a number string from one base to all standard bases. Returns null if invalid. */
export function convertAll(
  input: string,
  fromBase: number,
): { bin: string; oct: string; dec: string; hex: string } | null {
  try {
    const n = parseToBigInt(input, fromBase)
    return {
      bin: bigIntToBase(n, 2),
      oct: bigIntToBase(n, 8),
      dec: bigIntToBase(n, 10),
      hex: bigIntToBase(n, 16),
    }
  } catch {
    return null
  }
}
