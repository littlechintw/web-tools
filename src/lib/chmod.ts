// Unix file mode helpers. A mode is a number 0..0o7777:
// setuid 0o4000, setgid 0o2000, sticky 0o1000, then rwx for user/group/other.

export type Who = 'user' | 'group' | 'other'
export const WHO: readonly Who[] = ['user', 'group', 'other']
export const SETUID = 0o4000
export const SETGID = 0o2000
export const STICKY = 0o1000
const SHIFT: Record<Who, number> = { user: 6, group: 3, other: 0 }

export interface Rwx {
  r: boolean
  w: boolean
  x: boolean
}

export function getPerm(mode: number, who: Who): Rwx {
  const bits = (mode >> SHIFT[who]) & 7
  return { r: !!(bits & 4), w: !!(bits & 2), x: !!(bits & 1) }
}

/** Return a new mode with one permission bit switched on or off. */
export function setPerm(mode: number, who: Who, bit: 'r' | 'w' | 'x', on: boolean): number {
  const mask = (bit === 'r' ? 4 : bit === 'w' ? 2 : 1) << SHIFT[who]
  return on ? mode | mask : mode & ~mask
}

export function setSpecial(mode: number, flag: typeof SETUID | typeof SETGID | typeof STICKY, on: boolean): number {
  return on ? mode | flag : mode & ~flag
}

/** "755", or "4755" when a special bit is set. */
export function modeToOctal(mode: number): string {
  const m = mode & 0o7777
  return m > 0o777 ? m.toString(8).padStart(4, '0') : m.toString(8).padStart(3, '0')
}

/** Parse 1-4 octal digits ("755", "0755", "4755"). Returns null when invalid. */
export function octalToMode(text: string): number | null {
  const s = text.trim()
  if (!/^[0-7]{1,4}$/.test(s)) return null
  return parseInt(s, 8)
}

function triad(mode: number, who: Who): string {
  const p = getPerm(mode, who)
  const special = who === 'user' ? mode & SETUID : who === 'group' ? mode & SETGID : mode & STICKY
  let x: string
  if (who === 'other') x = special ? (p.x ? 't' : 'T') : p.x ? 'x' : '-'
  else x = special ? (p.x ? 's' : 'S') : p.x ? 'x' : '-'
  return `${p.r ? 'r' : '-'}${p.w ? 'w' : '-'}${x}`
}

/** 9-character symbolic form such as rwxr-xr-x, rwsr-xr-x or rwxrwxrwt. */
export function modeToSymbolic(mode: number): string {
  return WHO.map((w) => triad(mode, w)).join('')
}

/**
 * Parse the symbolic form. Accepts 9 characters, or 10 when prefixed with a file type
 * character as in `ls -l` output ("-rwxr-xr-x", "drwxrwxrwt"). Returns null when invalid.
 */
export function symbolicToMode(text: string): number | null {
  let s = text.trim()
  if (s.length === 10 && /^[-dlcbpsD?]/.test(s)) s = s.slice(1)
  if (s.length !== 9) return null
  let mode = 0
  for (let i = 0; i < 3; i++) {
    const [r, w, x] = [s[i * 3], s[i * 3 + 1], s[i * 3 + 2]]
    const who = WHO[i]
    if (r !== 'r' && r !== '-') return null
    if (w !== 'w' && w !== '-') return null
    const allowed = who === 'other' ? 'xtT-' : 'xsS-'
    if (!allowed.includes(x)) return null
    if (r === 'r') mode = setPerm(mode, who, 'r', true)
    if (w === 'w') mode = setPerm(mode, who, 'w', true)
    if (x === 'x' || x === 's' || x === 't') mode = setPerm(mode, who, 'x', true)
    if (x === 's' || x === 'S') mode |= who === 'user' ? SETUID : SETGID
    if (x === 't' || x === 'T') mode |= STICKY
  }
  return mode
}

/** Symbolic-clause form for chmod, e.g. "u=rwx,g=rx,o=rx" (special bits become s / t). */
export function modeToClauses(mode: number): string {
  const part = (who: Who, letter: string) => {
    const p = getPerm(mode, who)
    let s = (p.r ? 'r' : '') + (p.w ? 'w' : '') + (p.x ? 'x' : '')
    if (who === 'user' && mode & SETUID) s += 's'
    if (who === 'group' && mode & SETGID) s += 's'
    if (who === 'other' && mode & STICKY) s += 't'
    return `${letter}=${s}`
  }
  return [part('user', 'u'), part('group', 'g'), part('other', 'o')].join(',')
}

export function chmodCommand(mode: number, target = 'file', symbolic = false): string {
  return `chmod ${symbolic ? modeToClauses(mode) : modeToOctal(mode)} ${target}`
}

/** Parse a umask such as "022" or "0077". Returns null when invalid (permission bits only). */
export function parseUmask(text: string): number | null {
  const s = text.trim()
  if (!/^[0-7]{1,4}$/.test(s)) return null
  const v = parseInt(s, 8)
  return v & 0o777
}

export function formatUmask(umask: number): string {
  return (umask & 0o777).toString(8).padStart(4, '0')
}

/** Default modes created under a umask: files start from 666, directories from 777. */
export function applyUmask(umask: number): { file: number; dir: number } {
  const u = umask & 0o777
  return { file: 0o666 & ~u, dir: 0o777 & ~u }
}

/** Is the mode the "own" classes only (nothing granted to group/other)? Handy for explanations. */
export function isWorldWritable(mode: number): boolean {
  return !!(mode & 0o002)
}
