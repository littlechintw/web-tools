import { describe, it, expect } from 'vitest'
import {
  allZones, buildTimeline, cityLabel, formatClock, formatDate, formatOffset, isValidZone, offsetMinutes,
  overlapWindows, viewInZone, wallClock, zonedTimeToInstant,
} from '@/lib/world-clock'

const T = Date.parse('2024-01-15T12:00:00Z')

describe('wallClock / offsets', () => {
  it('reads wall clocks in several zones', () => {
    expect(formatClock(wallClock(T, 'Asia/Taipei'))).toBe('20:00')
    expect(formatClock(wallClock(T, 'America/New_York'))).toBe('07:00')
    expect(formatClock(wallClock(T, 'UTC'))).toBe('12:00')
    expect(formatClock(wallClock(T, 'Asia/Kolkata'))).toBe('17:30')
  })
  it('midnight is hour 0, not 24', () => {
    expect(wallClock(Date.parse('2024-01-15T16:00:00Z'), 'Asia/Taipei')).toMatchObject({ d: 16, hh: 0, mm: 0 })
  })
  it('DST changes the offset by Intl, not by hand', () => {
    expect(offsetMinutes(Date.parse('2024-01-15T12:00:00Z'), 'America/New_York')).toBe(-300)
    expect(offsetMinutes(Date.parse('2024-07-15T12:00:00Z'), 'America/New_York')).toBe(-240)
    expect(offsetMinutes(Date.parse('2024-07-15T12:00:00Z'), 'Europe/London')).toBe(60)
    expect(offsetMinutes(Date.parse('2024-07-15T12:00:00Z'), 'Asia/Taipei')).toBe(480)
    expect(offsetMinutes(Date.parse('2024-01-15T12:00:00Z'), 'Asia/Kathmandu')).toBe(345)
  })
  it('formats offsets', () => {
    expect(formatOffset(0)).toBe('UTC')
    expect(formatOffset(480)).toBe('UTC+8')
    expect(formatOffset(-210)).toBe('UTC-3:30')
    expect(formatOffset(345)).toBe('UTC+5:45')
  })
  it('formats date', () => expect(formatDate(wallClock(T, 'Asia/Tokyo'))).toBe('2024-01-15'))
})

describe('zonedTimeToInstant', () => {
  it('converts plain times', () => {
    expect(zonedTimeToInstant(2024, 1, 15, 20, 0, 'Asia/Taipei').toISOString()).toBe('2024-01-15T12:00:00.000Z')
    expect(zonedTimeToInstant(2024, 7, 1, 9, 30, 'America/New_York').toISOString()).toBe('2024-07-01T13:30:00.000Z')
  })
  it('handles the DST gap (2024-03-10 02:30 New York does not exist)', () => {
    const i = zonedTimeToInstant(2024, 3, 10, 2, 30, 'America/New_York')
    // Lands after the gap: 03:30 EDT = 07:30Z
    expect(i.toISOString()).toBe('2024-03-10T07:30:00.000Z')
  })
  it('handles the DST overlap (2024-11-03 01:30 New York happens twice; earlier chosen)', () => {
    expect(zonedTimeToInstant(2024, 11, 3, 1, 30, 'America/New_York').toISOString()).toBe('2024-11-03T05:30:00.000Z')
  })
  it('round trips through wallClock', () => {
    for (const z of ['Asia/Tokyo', 'Europe/Berlin', 'Australia/Lord_Howe', 'Pacific/Auckland']) {
      const i = zonedTimeToInstant(2024, 10, 5, 14, 15, z)
      expect(wallClock(i, z)).toMatchObject({ y: 2024, m: 10, d: 5, hh: 14, mm: 15 })
    }
  })
})

describe('labels and validation', () => {
  it('city labels', () => {
    expect(cityLabel('America/New_York')).toBe('New York')
    expect(cityLabel('America/Argentina/Buenos_Aires')).toBe('Buenos Aires')
    expect(cityLabel('UTC')).toBe('UTC')
  })
  it('validates zones', () => {
    expect(isValidZone('Asia/Taipei')).toBe(true)
    expect(isValidZone('Mars/Olympus')).toBe(false)
  })
  it('zone list includes UTC and common zones', () => {
    const z = allZones()
    expect(z).toContain('UTC')
    expect(z).toContain('Asia/Taipei')
  })
})

describe('viewInZone', () => {
  it('reports day difference vs the reference zone', () => {
    const v = viewInZone(Date.parse('2024-01-15T20:00:00Z'), 'Asia/Taipei', 'America/New_York')
    expect(v).toMatchObject({ offset: 480, dayDiff: 1 })
    expect(viewInZone(Date.parse('2024-01-15T02:00:00Z'), 'America/New_York', 'Asia/Taipei').dayDiff).toBe(-1)
    expect(viewInZone(T, 'Asia/Tokyo', 'Asia/Taipei').dayDiff).toBe(0)
  })
})

describe('buildTimeline / overlap', () => {
  const day = { y: 2024, m: 1, d: 15 }
  it('Taipei + Tokyo (1h apart) overlap 10-18 Taipei', () => {
    const slots = buildTimeline(day, 'Asia/Taipei', ['Asia/Taipei', 'Asia/Tokyo'])
    expect(slots).toHaveLength(24)
    // Tokyo is 09-18 when Taipei is 08-17; both working: Taipei 09..17 (Tokyo 10..18)
    expect(overlapWindows(slots)).toEqual([[9, 17]])
  })
  it('Taipei + London (8h apart in winter) have no overlap', () => {
    // London 09:00 = Taipei 17:00 (one shared hour: Taipei 17 -> London 9)
    const slots = buildTimeline(day, 'Asia/Taipei', ['Asia/Taipei', 'Europe/London'])
    expect(overlapWindows(slots)).toEqual([[17, 18]])
  })
  it('Taipei + New York has no overlap', () => {
    const slots = buildTimeline(day, 'Asia/Taipei', ['Asia/Taipei', 'America/New_York'])
    expect(overlapWindows(slots)).toEqual([])
  })
  it('DST shifts the overlap: London summer is only 7h behind Taipei', () => {
    const slots = buildTimeline({ y: 2024, m: 7, d: 15 }, 'Asia/Taipei', ['Asia/Taipei', 'Europe/London'])
    expect(overlapWindows(slots)).toEqual([[16, 18]])
  })
  it('reports local hours and day shifts per cell', () => {
    const slots = buildTimeline(day, 'Asia/Taipei', ['Asia/Taipei', 'America/New_York'])
    expect(slots[9].cells[1]).toMatchObject({ hh: 20, mm: 0, dayDiff: -1, working: false })
    expect(slots[23].cells[1]).toMatchObject({ hh: 10, dayDiff: 0, working: true })
  })
  it('half-hour zones: Kolkata local minute 30', () => {
    const slots = buildTimeline(day, 'Asia/Taipei', ['Asia/Kolkata'])
    expect(slots[12].cells[0]).toMatchObject({ hh: 9, mm: 30, working: true })
  })
  it('no zones -> never all-working', () => {
    expect(overlapWindows(buildTimeline(day, 'Asia/Taipei', []))).toEqual([])
  })
})
