/**
 * Time-zone helpers built purely on Intl (never manual offsets, so DST is
 * handled by the platform's tz database).
 */

export interface WallClock {
  y: number
  m: number
  d: number
  hh: number
  mm: number
  ss: number
}

const cache = new Map<string, Intl.DateTimeFormat>()
function partsFormatter(zone: string): Intl.DateTimeFormat {
  let f = cache.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    })
    cache.set(zone, f)
  }
  return f
}

export function isValidZone(zone: string): boolean {
  try {
    partsFormatter(zone)
    return true
  } catch {
    return false
  }
}

/** Wall-clock fields of an instant in a zone. */
export function wallClock(instant: Date | number, zone: string): WallClock {
  const out: WallClock = { y: 0, m: 0, d: 0, hh: 0, mm: 0, ss: 0 }
  for (const p of partsFormatter(zone).formatToParts(instant)) {
    const v = Number(p.value)
    if (p.type === 'year') out.y = v
    else if (p.type === 'month') out.m = v
    else if (p.type === 'day') out.d = v
    else if (p.type === 'hour') out.hh = v % 24
    else if (p.type === 'minute') out.mm = v
    else if (p.type === 'second') out.ss = v
  }
  return out
}

const wallAsUtc = (w: WallClock) => {
  const d = new Date(Date.UTC(2000, w.m - 1, w.d, w.hh, w.mm, w.ss))
  d.setUTCFullYear(w.y)
  return d.getTime()
}

/** Offset from UTC in minutes (east positive) at an instant. */
export function offsetMinutes(instant: Date | number, zone: string): number {
  const t = typeof instant === 'number' ? instant : instant.getTime()
  const trunc = Math.floor(t / 1000) * 1000
  return Math.round((wallAsUtc(wallClock(trunc, zone)) - trunc) / 60000)
}

/** "UTC+8", "UTC-3:30", "UTC". */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return 'UTC'
  const sign = minutes > 0 ? '+' : '-'
  const a = Math.abs(minutes)
  const h = Math.floor(a / 60)
  const m = a % 60
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`
}

/**
 * The instant at which the wall clock in `zone` reads the given fields.
 * In a DST gap (nonexistent time) the result lands after the gap; in an
 * overlap (ambiguous time) the earlier instant is returned.
 */
export function zonedTimeToInstant(y: number, m: number, d: number, hh: number, mm: number, zone: string): Date {
  const naive = wallAsUtc({ y, m, d, hh, mm, ss: 0 })
  let guess = naive - offsetMinutes(naive, zone) * 60000
  // Re-evaluate the offset at the guess (twice, to settle around transitions).
  for (let i = 0; i < 2; i++) guess = naive - offsetMinutes(guess, zone) * 60000
  // Ambiguous time: prefer the earlier of the two valid instants.
  const earlier = guess - 3600e3
  const w = wallClock(earlier, zone)
  if (w.y === y && w.m === m && w.d === d && w.hh === hh && w.mm === mm) return new Date(earlier)
  return new Date(guess)
}

/** Last path segment as a friendly city name: "America/New_York" -> "New York". */
export function cityLabel(zone: string): string {
  const seg = zone.split('/').pop() ?? zone
  return seg.replace(/_/g, ' ')
}

/** Region part of the id: "America/Argentina/Buenos_Aires" -> "America / Argentina". */
export function regionLabel(zone: string): string {
  const parts = zone.split('/')
  return parts.slice(0, -1).join(' / ')
}

export interface ZoneView {
  zone: string
  wall: WallClock
  offset: number
  /** Whole calendar days relative to the reference zone's date. */
  dayDiff: number
}

export function viewInZone(instant: Date | number, zone: string, refZone: string): ZoneView {
  const wall = wallClock(instant, zone)
  const ref = wallClock(instant, refZone)
  const dayDiff = Math.round((Date.UTC(wall.y, wall.m - 1, wall.d) - Date.UTC(ref.y, ref.m - 1, ref.d)) / 86400000)
  return { zone, wall, offset: offsetMinutes(instant, zone), dayDiff }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const formatClock = (w: WallClock, seconds = false) => `${pad(w.hh)}:${pad(w.mm)}${seconds ? ':' + pad(w.ss) : ''}`
export const formatDate = (w: WallClock) => `${w.y}-${pad(w.m)}-${pad(w.d)}`

export interface TimelineCell {
  /** Local hour (0-23) and minute in this zone at the slot start. */
  hh: number
  mm: number
  working: boolean
  /** Local calendar day differs from the reference zone's day of the timeline. */
  dayDiff: number
}

export interface TimelineSlot {
  /** Slot start instant: `hour` o'clock in the reference zone. */
  instant: Date
  hour: number
  cells: TimelineCell[]
  /** Every zone is within working hours at this slot. */
  allWorking: boolean
}

/**
 * 24 hourly slots of one calendar day in `refZone`, showing for each zone the
 * local time and whether it is inside working hours [workStart, workEnd).
 */
export function buildTimeline(
  date: { y: number; m: number; d: number },
  refZone: string,
  zones: string[],
  workStart = 9,
  workEnd = 18,
): TimelineSlot[] {
  const slots: TimelineSlot[] = []
  const refDay = Date.UTC(date.y, date.m - 1, date.d)
  for (let hour = 0; hour < 24; hour++) {
    const instant = zonedTimeToInstant(date.y, date.m, date.d, hour, 0, refZone)
    const cells = zones.map((z) => {
      const w = wallClock(instant, z)
      const mins = w.hh * 60 + w.mm
      return {
        hh: w.hh,
        mm: w.mm,
        working: mins >= workStart * 60 && mins < workEnd * 60,
        dayDiff: Math.round((Date.UTC(w.y, w.m - 1, w.d) - refDay) / 86400000),
      }
    })
    slots.push({ instant, hour, cells, allWorking: cells.length > 0 && cells.every((c) => c.working) })
  }
  return slots
}

/** Contiguous runs of all-working slots as [startHour, endHourExclusive] in the reference zone. */
export function overlapWindows(slots: TimelineSlot[]): [number, number][] {
  const out: [number, number][] = []
  let start = -1
  for (const s of slots) {
    if (s.allWorking && start < 0) start = s.hour
    if (!s.allWorking && start >= 0) {
      out.push([start, s.hour])
      start = -1
    }
  }
  if (start >= 0) out.push([start, 24])
  return out
}

/** Zones known to the runtime (plus UTC, which some engines omit). */
export function allZones(): string[] {
  let list: string[] = []
  try {
    const sv = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    if (sv) list = sv('timeZone')
  } catch {
    list = []
  }
  if (list.length === 0) list = ['Asia/Taipei', 'Asia/Tokyo', 'Asia/Seoul', 'Europe/London', 'America/New_York', 'America/Los_Angeles']
  return list.includes('UTC') ? list : ['UTC', ...list]
}

export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
