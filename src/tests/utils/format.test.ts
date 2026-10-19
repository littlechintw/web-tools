import { describe, it, expect } from 'vitest'
import { formatBytes, stripExtension } from '@/utils/format'

describe('formatBytes()', () => {
  it('picks units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(999)).toBe('999 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB')
    expect(formatBytes(2.5 * 1024 ** 3)).toBe('2.50 GB')
  })
  it('is defensive about bad input', () => {
    expect(formatBytes(NaN)).toBe('0 B')
    expect(formatBytes(-5)).toBe('0 B')
  })
})

describe('stripExtension()', () => {
  it('removes only the last extension', () => {
    expect(stripExtension('report.final.pdf')).toBe('report.final')
    expect(stripExtension('noext')).toBe('noext')
    expect(stripExtension('.hidden')).toBe('.hidden')
    expect(stripExtension('dir.v2/file')).toBe('dir.v2/file')
  })
})
