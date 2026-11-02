import { describe, it, expect } from 'vitest'
import {
  applyUmask,
  chmodCommand,
  formatUmask,
  getPerm,
  modeToClauses,
  modeToOctal,
  modeToSymbolic,
  octalToMode,
  parseUmask,
  setPerm,
  setSpecial,
  SETGID,
  SETUID,
  STICKY,
  symbolicToMode,
} from '@/lib/chmod'

describe('octal <-> symbolic', () => {
  const cases: Array<[string, string]> = [
    ['755', 'rwxr-xr-x'],
    ['644', 'rw-r--r--'],
    ['600', 'rw-------'],
    ['777', 'rwxrwxrwx'],
    ['000', '---------'],
    ['4755', 'rwsr-xr-x'],
    ['2755', 'rwxr-sr-x'],
    ['1777', 'rwxrwxrwt'],
    ['7777', 'rwsrwsrwt'],
    ['4644', 'rwSr--r--'],
    ['2644', 'rw-r-Sr--'],
    ['1644', 'rw-r--r-T'],
    ['6755', 'rwsr-sr-x'],
  ]
  for (const [oct, sym] of cases) {
    it(`${oct} <-> ${sym}`, () => {
      expect(modeToSymbolic(octalToMode(oct) as number)).toBe(sym)
      expect(modeToOctal(symbolicToMode(sym) as number)).toBe(oct)
    })
  }

  it('accepts ls -l style type prefix', () => {
    expect(symbolicToMode('-rwxr-xr-x')).toBe(0o755)
    expect(symbolicToMode('drwxrwxrwt')).toBe(0o1777)
  })

  it('rejects invalid input', () => {
    for (const s of ['', 'rwx', 'rwxr-xr-', 'rwxr-xr-xx', 'rwtr-xr-x', 'rwxr-xr-s', 'rwxr-tr-x', 'rwxrwxrwa', 'xwrxwrxwr']) {
      expect(symbolicToMode(s), s).toBeNull()
    }
    for (const s of ['', '8', '999', '12345', '-1', '7a7', '7 5']) expect(octalToMode(s), s).toBeNull()
  })

  it('parses short and zero-prefixed octal', () => {
    expect(octalToMode('0755')).toBe(0o755)
    expect(octalToMode('7')).toBe(7)
    expect(modeToOctal(7)).toBe('007')
    expect(modeToOctal(0)).toBe('000')
  })

  it('exhaustive round trip over all 4096 modes', () => {
    for (let m = 0; m <= 0o7777; m++) {
      expect(symbolicToMode(modeToSymbolic(m))).toBe(m)
      expect(octalToMode(modeToOctal(m))).toBe(m)
    }
  })
})

describe('bit helpers', () => {
  it('reads and writes permissions', () => {
    expect(getPerm(0o754, 'user')).toEqual({ r: true, w: true, x: true })
    expect(getPerm(0o754, 'group')).toEqual({ r: true, w: false, x: true })
    expect(getPerm(0o754, 'other')).toEqual({ r: true, w: false, x: false })
    expect(setPerm(0o644, 'user', 'x', true)).toBe(0o744)
    expect(setPerm(0o777, 'other', 'w', false)).toBe(0o775)
    expect(setPerm(0o000, 'group', 'r', true)).toBe(0o040)
  })

  it('toggles special bits', () => {
    expect(setSpecial(0o755, SETUID, true)).toBe(0o4755)
    expect(setSpecial(0o755, SETGID, true)).toBe(0o2755)
    expect(setSpecial(0o777, STICKY, true)).toBe(0o1777)
    expect(setSpecial(0o7777, SETUID, false)).toBe(0o3777)
  })
})

describe('commands and umask', () => {
  it('builds chmod commands', () => {
    expect(chmodCommand(0o755, 'run.sh')).toBe('chmod 755 run.sh')
    expect(chmodCommand(0o4755)).toBe('chmod 4755 file')
    expect(chmodCommand(0o750, 'x', true)).toBe('chmod u=rwx,g=rx,o= x')
    expect(modeToClauses(0o1777)).toBe('u=rwx,g=rwx,o=rwxt')
    expect(modeToClauses(0o6000)).toBe('u=s,g=s,o=')
  })

  it('umask 022 / 077 / 002 / 027', () => {
    expect(applyUmask(0o022)).toEqual({ file: 0o644, dir: 0o755 })
    expect(applyUmask(0o077)).toEqual({ file: 0o600, dir: 0o700 })
    expect(applyUmask(0o002)).toEqual({ file: 0o664, dir: 0o775 })
    expect(applyUmask(0o027)).toEqual({ file: 0o640, dir: 0o750 })
    expect(applyUmask(0)).toEqual({ file: 0o666, dir: 0o777 })
    expect(applyUmask(0o777)).toEqual({ file: 0, dir: 0 })
  })

  it('parses umask text', () => {
    expect(parseUmask('022')).toBe(0o22)
    expect(parseUmask('0077')).toBe(0o77)
    expect(parseUmask('088')).toBeNull()
    expect(parseUmask('')).toBeNull()
    expect(formatUmask(0o22)).toBe('0022')
  })
})
