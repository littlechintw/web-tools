/**
 * Number <-> Chinese financial (大寫) numerals.
 *
 * Works on decimal *strings* so large amounts never go through floating point.
 * Supported range: integer part up to 16 digits (9999兆 ...), decimals rounded
 * half-up to 2 places (角 / 分).
 */

const UPPER = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖']
const SMALL_UNITS = ['', '拾', '佰', '仟']
const BIG_UNITS = ['', '萬', '億', '兆']

export interface ToUpperOptions {
  /** Prefix "新台幣". */
  twd?: boolean
  /** Currency unit character: 元 (default) or 圓 (traditional on cheques). */
  unit?: '元' | '圓'
}

/** Normalise a user-typed amount to `{ int, frac }` digit strings, or null. */
export function normalizeAmount(input: string): { int: string; frac: string } | null {
  const s = input.trim().replace(/[,，\s_]/g, '').replace(/^(?:NT\$|NTD|\$)/i, '')
  const m = /^(\d*)(?:\.(\d*))?$/.exec(s)
  if (!m || (m[1] === '' && !m[2])) return null
  let int = m[1].replace(/^0+(?=\d)/, '') || '0'
  let frac = (m[2] ?? '').padEnd(3, '0')
  // Round half up on the third decimal.
  let cents = frac.slice(0, 2)
  if (frac[2] >= '5') {
    const n = String(Number(cents) + 1).padStart(2, '0')
    if (n.length > 2) {
      int = (BigInt(int) + 1n).toString()
      cents = '00'
    } else cents = n
  }
  frac = cents
  if (int.length > 16) return null
  return { int, frac }
}

function integerToUpper(int: string): string {
  const digits = int.padStart(Math.ceil(int.length / 4) * 4, '0')
  const len = digits.length
  let out = ''
  let zeroPending = false
  for (let i = 0; i < len; i++) {
    const pos = len - 1 - i
    const d = digits.charCodeAt(i) - 48
    if (d === 0) {
      if (out !== '') zeroPending = true
    } else {
      if (zeroPending) out += '零'
      zeroPending = false
      out += UPPER[d] + SMALL_UNITS[pos % 4]
    }
    // Close a 4-digit group with 萬 / 億 / 兆 when the group is not all zeros.
    if (pos % 4 === 0 && pos >= 4 && digits.slice(i - 3, i + 1) !== '0000') out += BIG_UNITS[pos / 4]
  }
  return out
}

/** Amount -> 國字大寫, e.g. "123456" -> 壹拾貳萬參仟肆佰伍拾陸元整. Null for invalid input. */
export function toChineseUpper(input: string, opts: ToUpperOptions = {}): string | null {
  const n = normalizeAmount(input)
  if (!n) return null
  const unit = opts.unit ?? '元'
  const jiao = Number(n.frac[0])
  const fen = Number(n.frac[1])
  const intZero = n.int === '0'
  let out = opts.twd ? '新台幣' : ''
  if (intZero && jiao === 0 && fen === 0) return out + '零' + unit + '整'
  if (!intZero) out += integerToUpper(n.int) + unit
  if (jiao > 0) out += UPPER[jiao] + '角'
  else if (fen > 0 && !intZero) out += '零'
  if (fen > 0) out += UPPER[fen] + '分'
  else out += '整'
  return out
}

// ---------------------------------------------------------------- reverse

const DIGITS: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 壹: 1, 二: 2, 貳: 2, 贰: 2, 兩: 2, 两: 2, 三: 3, 參: 3, 叁: 3, 参: 3, 四: 4, 肆: 4,
  五: 5, 伍: 5, 六: 6, 陸: 6, 陆: 6, 七: 7, 柒: 7, 八: 8, 捌: 8, 九: 9, 玖: 9,
}
const SMALL: Record<string, number> = { 十: 10, 拾: 10, 百: 100, 佰: 100, 千: 1000, 仟: 1000 }
const BIG: Record<string, number> = { 萬: 4, 万: 4, 億: 8, 亿: 8, 兆: 12 }

/** Parse the integer part (no decimals). Returns a decimal string or null. */
function parseInteger(s: string): string | null {
  if (s === '') return '0'
  const chars = [...s]
  if (chars.every((c) => c in DIGITS)) return BigInt(chars.map((c) => DIGITS[c]).join('')).toString() // 二〇二四
  let total = 0n
  let section = 0
  let num = -1
  let lastSmall = Infinity
  let lastBig = Infinity
  let sawAny = false
  for (const c of chars) {
    if (c in DIGITS) {
      if (num > 0 && DIGITS[c] > 0 && num !== 0) return null // two digits in a row without unit
      num = DIGITS[c]
      sawAny = true
    } else if (c in SMALL) {
      const u = SMALL[c]
      if (u >= lastSmall) return null
      if (num < 0 && c !== '十' && c !== '拾') return null
      section += (num < 0 ? 1 : num) * u
      if (num === 0) return null // 零十 etc. makes no sense
      lastSmall = u
      num = -1
      sawAny = true
    } else if (c in BIG) {
      const rank = BIG[c]
      if (rank >= lastBig) return null
      const val = section + (num > 0 ? num : 0)
      if (val === 0) return null
      total += BigInt(val) * 10n ** BigInt(rank)
      section = 0
      num = -1
      lastSmall = Infinity
      lastBig = rank
      sawAny = true
    } else return null
  }
  if (!sawAny) return null
  total += BigInt(section + (num > 0 ? num : 0))
  return total.toString()
}

/**
 * 國字（大寫或小寫）-> decimal string, e.g. 壹拾貳萬參仟肆佰伍拾陸元整 -> "123456",
 * 三點一四 -> "3.14", 伍角 -> "0.5". Null when it can't be understood.
 */
export function parseChinese(input: string): string | null {
  let s = input.replace(/[\s,，]/g, '').replace(/^(?:新台幣|新臺幣|新台币|NT\$|NTD)/i, '')
  s = s.replace(/[整正]$/, '')
  if (s === '') return null
  let int: string
  let frac = ''
  const dot = s.search(/[點点]/)
  if (dot >= 0) {
    int = s.slice(0, dot)
    const fd = [...s.slice(dot + 1)]
    if (fd.length === 0 || !fd.every((c) => c in DIGITS)) return null
    frac = fd.map((c) => DIGITS[c]).join('')
  } else {
    const y = s.search(/[元圓圆塊块]/)
    let rest: string
    if (y >= 0) {
      int = s.slice(0, y)
      rest = s.slice(y + 1)
    } else if (/[角分]/.test(s)) {
      int = ''
      rest = s
    } else {
      int = s
      rest = ''
    }
    if (rest !== '') {
      const m = /^(?:([^角分])角)?(?:零?([^角分])分)?$/.exec(rest)
      if (!m || (!m[1] && !m[2]) || (m[1] && !(m[1] in DIGITS)) || (m[2] && !(m[2] in DIGITS))) return null
      frac = String(m[1] ? DIGITS[m[1]] : 0) + (m[2] ? String(DIGITS[m[2]]) : '')
      frac = frac.replace(/0+$/, '')
    }
  }
  if (int === '' && frac === '') return null
  const i = parseInteger(int)
  if (i === null) return null
  return frac === '' ? i : `${i}.${frac}`
}
