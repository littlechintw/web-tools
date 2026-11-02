/** Pomodoro state machine. Pure: every function takes `now` (ms) explicitly. */

export type Phase = 'focus' | 'short' | 'long'
export type Status = 'idle' | 'running' | 'paused'

export interface PomodoroConfig {
  focusMin: number
  shortMin: number
  longMin: number
  /** Focus rounds before a long break. */
  rounds: number
}

export interface PomodoroState {
  phase: Phase
  /** 1-based focus round within the current cycle. */
  round: number
  status: Status
  /** Time left; authoritative while idle/paused. */
  remainingMs: number
  /** Absolute end timestamp; only meaningful while running. */
  endAt: number
}

export const DEFAULT_CONFIG: PomodoroConfig = { focusMin: 25, shortMin: 5, longMin: 15, rounds: 4 }

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function normalizeConfig(c: Partial<PomodoroConfig>): PomodoroConfig {
  return {
    focusMin: clampInt(c.focusMin, 1, 180, DEFAULT_CONFIG.focusMin),
    shortMin: clampInt(c.shortMin, 1, 60, DEFAULT_CONFIG.shortMin),
    longMin: clampInt(c.longMin, 1, 120, DEFAULT_CONFIG.longMin),
    rounds: clampInt(c.rounds, 1, 12, DEFAULT_CONFIG.rounds),
  }
}

export function phaseMs(cfg: PomodoroConfig, phase: Phase): number {
  const min = phase === 'focus' ? cfg.focusMin : phase === 'short' ? cfg.shortMin : cfg.longMin
  return min * 60_000
}

export function createState(cfg: PomodoroConfig): PomodoroState {
  return { phase: 'focus', round: 1, status: 'idle', remainingMs: phaseMs(cfg, 'focus'), endAt: 0 }
}

export function remaining(s: PomodoroState, now: number): number {
  return s.status === 'running' ? Math.max(0, s.endAt - now) : s.remainingMs
}

export function start(s: PomodoroState, now: number): PomodoroState {
  if (s.status === 'running') return s
  return { ...s, status: 'running', endAt: now + s.remainingMs }
}

export function pause(s: PomodoroState, now: number): PomodoroState {
  if (s.status !== 'running') return s
  return { ...s, status: 'paused', remainingMs: remaining(s, now), endAt: 0 }
}

/** Phase and round that follow `s` (ignores timing). */
export function nextPhase(s: Pick<PomodoroState, 'phase' | 'round'>, cfg: PomodoroConfig): { phase: Phase; round: number } {
  if (s.phase === 'focus') return { phase: s.round >= cfg.rounds ? 'long' : 'short', round: s.round }
  return { phase: 'focus', round: s.phase === 'long' ? 1 : s.round + 1 }
}

export function advance(s: PomodoroState, cfg: PomodoroConfig, now: number, autoStart: boolean): PomodoroState {
  const n = nextPhase(s, cfg)
  const ms = phaseMs(cfg, n.phase)
  return autoStart
    ? { phase: n.phase, round: n.round, status: 'running', remainingMs: ms, endAt: now + ms }
    : { phase: n.phase, round: n.round, status: 'idle', remainingMs: ms, endAt: 0 }
}

export interface TickResult {
  state: PomodoroState
  /** The phase that just finished naturally, if any. */
  finished: Phase | null
}

/** Call regularly; finishes the phase when the clock has run out. */
export function tick(s: PomodoroState, cfg: PomodoroConfig, now: number, autoStart: boolean): TickResult {
  if (s.status !== 'running' || now < s.endAt) return { state: s, finished: null }
  return { state: advance(s, cfg, now, autoStart), finished: s.phase }
}

/** Skip to the next phase without it counting as completed. Keeps running if it was running. */
export function skip(s: PomodoroState, cfg: PomodoroConfig, now: number): PomodoroState {
  return advance(s, cfg, now, s.status === 'running')
}

export function reset(cfg: PomodoroConfig): PomodoroState {
  return createState(cfg)
}

/** Apply edited durations: an idle timer adopts the new length immediately. */
export function applyConfig(s: PomodoroState, cfg: PomodoroConfig): PomodoroState {
  return s.status === 'idle' ? { ...s, remainingMs: phaseMs(cfg, s.phase) } : s
}

/** mm:ss (or h:mm:ss), rounding up so 0:00 only shows when really done. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`
}
