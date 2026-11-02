/**
 * Chinese lunisolar calendar helpers.
 *
 * Gregorian <-> lunar conversion relies on the browser's built-in Intl
 * `chinese` calendar (no tables shipped). The 24 solar terms are computed with
 * a low-precision solar longitude series (Meeus, "Astronomical Algorithms"
 * ch. 25, accuracy about 0.01 degree) solved with Newton iteration; expect
 * results within a few minutes of the published almanac, which is enough to get
 * the calendar date right except when a term falls within minutes of midnight
 * (UTC+8).
 */

export interface LunarDate {
  /** The Gregorian year in which this lunar year begins (e.g. 2024 for 甲辰年). */
  year: number
  /** 1-12 */
  month: number
  leap: boolean
  /** 1-30 */
  day: number
}

const STEMS = '甲乙丙丁戊己庚辛壬癸'
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
const ZODIAC = '鼠牛虎兔龍蛇馬羊猴雞狗豬'
const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '臘']

export function stemBranchYear(lunarYear: number): string {
  const s = (((lunarYear - 4) % 10) + 10) % 10
  const b = (((lunarYear - 4) % 12) + 12) % 12
  return STEMS[s] + BRANCHES[b]
}

export function zodiacOf(lunarYear: number): string {
  return ZODIAC[(((lunarYear - 4) % 12) + 12) % 12]
}

export function lunarMonthName(month: number, leap: boolean): string {
  return (leap ? '閏' : '') + MONTH_NAMES[month - 1] + '月'
}

export function lunarDayName(day: number): string {
  if (day === 10) return '初十'
  if (day === 20) return '二十'
  if (day === 30) return '三十'
  const digit = '日一二三四五六七八九'
  const u = digit[day % 10]
  if (day < 10) return '初' + u
  if (day < 20) return '十' + u
  return '廿' + u
}

/** e.g. 甲辰年正月初一 */
export function formatLunar(d: LunarDate): string {
  return `${stemBranchYear(d.year)}年${lunarMonthName(d.month, d.leap)}${lunarDayName(d.day)}`
}

// ------------------------------------------------------------- Intl-based

let fmt: Intl.DateTimeFormat | null = null
function chineseFormatter(): Intl.DateTimeFormat | null {
  if (fmt) return fmt
  try {
    fmt = new Intl.DateTimeFormat('en-u-ca-chinese', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric' })
    if (!fmt.formatToParts(new Date(0)).some((p) => (p.type as string) === 'relatedYear')) fmt = null
  } catch {
    fmt = null
  }
  return fmt
}

/** Whether this browser can do lunar conversions. */
export function lunarSupported(): boolean {
  return chineseFormatter() !== null
}

/** Noon (Taipei) of a Gregorian calendar date, as an instant. */
function noonTaipei(y: number, m: number, d: number): Date {
  const dt = new Date(Date.UTC(2000, m - 1, d, 4))
  dt.setUTCFullYear(y)
  return dt
}

function validGregorian(y: number, m: number, d: number): boolean {
  if (![y, m, d].every(Number.isInteger) || y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return false
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate() // day 0 of next month = last day
}

function lunarFromInstant(t: Date, f: Intl.DateTimeFormat): LunarDate | null {
  let year = NaN
  let month = NaN
  let leap = false
  let day = NaN
  for (const p of f.formatToParts(t)) {
    const type = p.type as string // 'relatedYear' is missing from the DOM typings
    if (type === 'relatedYear') year = Number(p.value)
    else if (type === 'month') {
      month = parseInt(p.value, 10)
      leap = /\D/.test(p.value)
    } else if (type === 'day') day = Number(p.value)
  }
  return Number.isFinite(year + month + day) ? { year, month, leap, day } : null
}

/** Gregorian y-m-d (1900-2100) -> lunar date; null if invalid or unsupported. */
export function gregorianToLunar(y: number, m: number, d: number): LunarDate | null {
  const f = chineseFormatter()
  if (!f || !validGregorian(y, m, d)) return null
  return lunarFromInstant(noonTaipei(y, m, d), f)
}

export interface LunarDay extends LunarDate {
  /** Gregorian date of this lunar day. */
  g: { y: number; m: number; d: number }
}

/** Every day of lunar year `year` (begins that Gregorian year, ends before ~Mar of the next). */
export function lunarYearDays(year: number): LunarDay[] {
  const f = chineseFormatter()
  if (!f || !Number.isInteger(year) || year < 1900 || year > 2100) return []
  const out: LunarDay[] = []
  const cur = noonTaipei(year, 1, 1)
  for (let i = 0; i < 430; i++) {
    const l = lunarFromInstant(cur, f)
    if (l && l.year === year) {
      const g = new Date(cur.getTime() + 8 * 3600e3) // Taipei wall clock read via UTC getters
      out.push({ ...l, g: { y: g.getUTCFullYear(), m: g.getUTCMonth() + 1, d: g.getUTCDate() } })
    } else if (l && l.year > year) break
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

/** The months of a lunar year with their length, in calendar order (leap month after its twin). */
export function lunarMonths(year: number): { month: number; leap: boolean; days: number }[] {
  const res: { month: number; leap: boolean; days: number }[] = []
  for (const d of lunarYearDays(year)) {
    const last = res[res.length - 1]
    if (last && last.month === d.month && last.leap === d.leap) last.days = d.day
    else res.push({ month: d.month, leap: d.leap, days: d.day })
  }
  return res
}

/** Lunar date -> Gregorian y-m-d; null when that lunar date does not exist. */
export function lunarToGregorian(l: LunarDate): { y: number; m: number; d: number } | null {
  const hit = lunarYearDays(l.year).find((x) => x.month === l.month && x.leap === l.leap && x.day === l.day)
  return hit ? hit.g : null
}

// ------------------------------------------------------------ solar terms

/** Terms in calendar order starting with 小寒; `lon` is the Sun's ecliptic longitude. */
export const SOLAR_TERMS: { name: string; lon: number }[] = [
  { name: '小寒', lon: 285 }, { name: '大寒', lon: 300 }, { name: '立春', lon: 315 }, { name: '雨水', lon: 330 },
  { name: '驚蟄', lon: 345 }, { name: '春分', lon: 0 }, { name: '清明', lon: 15 }, { name: '穀雨', lon: 30 },
  { name: '立夏', lon: 45 }, { name: '小滿', lon: 60 }, { name: '芒種', lon: 75 }, { name: '夏至', lon: 90 },
  { name: '小暑', lon: 105 }, { name: '大暑', lon: 120 }, { name: '立秋', lon: 135 }, { name: '處暑', lon: 150 },
  { name: '白露', lon: 165 }, { name: '秋分', lon: 180 }, { name: '寒露', lon: 195 }, { name: '霜降', lon: 210 },
  { name: '立冬', lon: 225 }, { name: '小雪', lon: 240 }, { name: '大雪', lon: 255 }, { name: '冬至', lon: 270 },
]

const rad = (d: number) => (d * Math.PI) / 180

/** Julian date of a UTC instant. */
const toJD = (ms: number) => ms / 86400000 + 2440587.5
const fromJD = (jd: number) => (jd - 2440587.5) * 86400000

/** Approximate ΔT = TT - UT in seconds (Espenak/Meeus polynomial fits). */
export function deltaT(year: number): number {
  if (year >= 2005 && year < 2050) {
    const t = year - 2000
    return 62.92 + 0.32217 * t + 0.005589 * t * t
  }
  if (year >= 1986 && year < 2005) {
    const t = year - 2000
    return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5
  }
  const u = (year - 1820) / 100
  return -20 + 32 * u * u
}

/** Apparent geocentric longitude of the Sun in degrees [0, 360) at a Julian ephemeris day. */
export function sunLongitude(jde: number): number {
  const T = (jde - 2451545) / 36525
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T
  const M = rad(357.52911 + 35999.05029 * T - 0.0001537 * T * T)
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M)
  const omega = rad(125.04 - 1934.136 * T)
  const lon = L0 + C - 0.00569 - 0.00478 * Math.sin(omega)
  return ((lon % 360) + 360) % 360
}

/** UTC instant (ms) when the Sun reaches `lon` degrees, near the given guess (ms). */
function solveLongitude(lon: number, guessMs: number, year: number): number {
  const dT = deltaT(year) / 86400
  let jd = toJD(guessMs) + dT
  for (let i = 0; i < 8; i++) {
    let diff = lon - sunLongitude(jd)
    diff = ((((diff + 180) % 360) + 360) % 360) - 180
    jd += diff / 0.9856474
    if (Math.abs(diff) < 1e-7) break
  }
  return fromJD(jd - dT)
}

export interface SolarTermTime {
  name: string
  lon: number
  /** UTC instant. */
  instant: Date
  /** Date and time in UTC+8 (Taiwan / China). */
  y: number
  m: number
  d: number
  hh: number
  mm: number
}

/** The 24 solar terms of a Gregorian year (小寒 ... 冬至), with UTC+8 wall-clock dates. */
export function solarTerms(year: number): SolarTermTime[] {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return []
  const eq = Date.UTC(2000, 2, 20, 12)
  const base = new Date(eq)
  base.setUTCFullYear(year)
  return SOLAR_TERMS.map(({ name, lon }) => {
    const rel = lon >= 285 ? lon - 360 : lon // 285..345 happen in Jan-Mar, before the equinox
    const ms = solveLongitude(lon, base.getTime() + (rel / 0.9856474) * 86400000, year)
    const w = new Date(ms + 8 * 3600e3)
    return {
      name,
      lon,
      instant: new Date(ms),
      y: w.getUTCFullYear(),
      m: w.getUTCMonth() + 1,
      d: w.getUTCDate(),
      hh: w.getUTCHours(),
      mm: w.getUTCMinutes(),
    }
  })
}

/** The solar term in force on a date (the latest term starting on or before it, UTC+8 days). */
export function currentSolarTerm(y: number, m: number, d: number): { name: string; startsOn: { y: number; m: number; d: number }; isTermDay: boolean } | null {
  if (!validGregorian(y, m, d)) return null
  const key = (a: { y: number; m: number; d: number }) => a.y * 10000 + a.m * 100 + a.d
  const target = key({ y, m, d })
  const all = [...solarTerms(y - 1).slice(-2), ...solarTerms(y)]
  let best: SolarTermTime | null = null
  for (const t of all) if (key(t) <= target) best = t
  return best ? { name: best.name, startsOn: { y: best.y, m: best.m, d: best.d }, isTermDay: key(best) === target } : null
}
