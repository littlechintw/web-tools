import { describe, expect, it } from 'vitest'
import {
  advance, applyConfig, createState, formatClock, normalizeConfig, nextPhase, pause, phaseMs, remaining, reset,
  skip, start, tick, type PomodoroConfig, type PomodoroState,
} from '@/lib/pomodoro'

const cfg: PomodoroConfig = { focusMin: 25, shortMin: 5, longMin: 15, rounds: 4 }
const MIN = 60_000

describe('config', () => {
  it('normalizes and clamps', () => {
    expect(normalizeConfig({ focusMin: 0, shortMin: 999, longMin: NaN, rounds: 2.6 })).toEqual({
      focusMin: 1, shortMin: 60, longMin: 15, rounds: 3,
    })
    expect(normalizeConfig({})).toEqual(cfg)
  })
  it('phase durations', () => {
    expect(phaseMs(cfg, 'focus')).toBe(25 * MIN)
    expect(phaseMs(cfg, 'long')).toBe(15 * MIN)
  })
})

describe('start / pause / resume arithmetic', () => {
  it('counts down from now', () => {
    const s = start(createState(cfg), 1000)
    expect(s.status).toBe('running')
    expect(remaining(s, 1000)).toBe(25 * MIN)
    expect(remaining(s, 1000 + 10_000)).toBe(25 * MIN - 10_000)
  })
  it('pause freezes, resume continues from the frozen remainder', () => {
    let s = start(createState(cfg), 0)
    s = pause(s, 5 * MIN)
    expect(s.remainingMs).toBe(20 * MIN)
    expect(remaining(s, 999 * MIN)).toBe(20 * MIN) // time passing while paused changes nothing
    s = start(s, 100 * MIN)
    expect(remaining(s, 100 * MIN + 3000)).toBe(20 * MIN - 3000)
    expect(s.endAt).toBe(120 * MIN)
  })
  it('start while running and pause while idle are no-ops', () => {
    const r = start(createState(cfg), 0)
    expect(start(r, 50)).toBe(r)
    const i = createState(cfg)
    expect(pause(i, 50)).toBe(i)
  })
  it('remaining never negative', () => {
    expect(remaining(start(createState(cfg), 0), 99 * MIN)).toBe(0)
  })
})

describe('transitions and long-break cadence', () => {
  it('focus -> short for rounds 1..3, long after round 4, then round resets', () => {
    const seq: string[] = []
    let st: PomodoroState = createState(cfg)
    for (let i = 0; i < 10; i++) {
      seq.push(`${st.phase}${st.phase === 'focus' ? st.round : ''}`)
      st = advance(st, cfg, 0, false)
    }
    expect(seq).toEqual([
      'focus1', 'short', 'focus2', 'short', 'focus3', 'short', 'focus4', 'long', 'focus1', 'short',
    ])
  })
  it('rounds = 1 gives a long break after every focus', () => {
    const c = { ...cfg, rounds: 1 }
    expect(nextPhase({ phase: 'focus', round: 1 }, c).phase).toBe('long')
    expect(nextPhase({ phase: 'long', round: 1 }, c)).toEqual({ phase: 'focus', round: 1 })
  })
  it('tick does nothing before the end', () => {
    const s = start(createState(cfg), 0)
    const r = tick(s, cfg, 25 * MIN - 1, false)
    expect(r.finished).toBeNull()
    expect(r.state).toBe(s)
  })
  it('tick finishes the phase exactly at the end (no autostart)', () => {
    const s = start(createState(cfg), 0)
    const r = tick(s, cfg, 25 * MIN, false)
    expect(r.finished).toBe('focus')
    expect(r.state).toMatchObject({ phase: 'short', status: 'idle', remainingMs: 5 * MIN })
  })
  it('tick with autostart begins the next phase from now', () => {
    const s = start(createState(cfg), 0)
    const r = tick(s, cfg, 26 * MIN, true) // tab was throttled; woke 1 min late
    expect(r.state).toMatchObject({ phase: 'short', status: 'running', endAt: 31 * MIN })
  })
  it('tick ignores paused/idle states', () => {
    const p = pause(start(createState(cfg), 0), 1000)
    expect(tick(p, cfg, 999 * MIN, true).finished).toBeNull()
  })
  it('skip moves on without a finished event, preserving run state', () => {
    const running = start(createState(cfg), 0)
    expect(skip(running, cfg, 3 * MIN)).toMatchObject({ phase: 'short', status: 'running', endAt: 8 * MIN })
    expect(skip(createState(cfg), cfg, 0)).toMatchObject({ phase: 'short', status: 'idle' })
  })
  it('reset returns to focus round 1', () => {
    expect(reset(cfg)).toEqual(createState(cfg))
  })
})

describe('applyConfig', () => {
  it('idle adopts new length, running keeps its clock', () => {
    const next = { ...cfg, focusMin: 50 }
    expect(applyConfig(createState(cfg), next).remainingMs).toBe(50 * MIN)
    const r = start(createState(cfg), 0)
    expect(applyConfig(r, next)).toBe(r)
  })
})

describe('formatClock', () => {
  it('formats and rounds up', () => {
    expect(formatClock(25 * MIN)).toBe('25:00')
    expect(formatClock(1)).toBe('00:01')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(61_000)).toBe('01:01')
    expect(formatClock(90 * MIN)).toBe('1:30:00')
    expect(formatClock(-5)).toBe('00:00')
  })
})
