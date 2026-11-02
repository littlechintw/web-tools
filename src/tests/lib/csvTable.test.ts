import { describe, it, expect } from 'vitest'
import {
  compareCells,
  delimiterFromOption,
  normalizeRows,
  parseCsv,
  sortRows,
  splitHeader,
  toJson,
  toMarkdown,
  toTsv,
  uniqueHeaders,
} from '@/lib/csvTable'

describe('parseCsv', () => {
  it('handles quoted fields with commas, quotes and newlines', () => {
    const r = parseCsv('a,b\n"x, y","line1\nline2"\n"say ""hi""",3')
    expect(r.rows).toEqual([
      ['a', 'b'],
      ['x, y', 'line1\nline2'],
      ['say "hi"', '3'],
    ])
    expect(r.delimiter).toBe(',')
  })

  it('auto-detects tab, semicolon and pipe', () => {
    expect(parseCsv('a\tb\n1\t2').delimiter).toBe('\t')
    expect(parseCsv('a;b\n1;2').rows[1]).toEqual(['1', '2'])
    expect(parseCsv('a|b\n1|2').rows[0]).toEqual(['a', 'b'])
  })

  it('respects an explicit delimiter', () => {
    expect(parseCsv('a;b,c\n1;2,3', 'semicolon').rows[0]).toEqual(['a', 'b,c'])
  })

  it('pads ragged rows, drops blank lines, strips BOM', () => {
    const r = parseCsv('﻿a,b,c\n1\n\n4,5,6')
    expect(r.rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '', ''],
      ['4', '5', '6'],
    ])
  })

  it('returns empty for blank input and does not throw on garbage', () => {
    expect(parseCsv('  \n ').rows).toEqual([])
    expect(() => parseCsv('"unterminated,1\n2')).not.toThrow()
  })

  it('maps delimiter options', () => {
    expect(delimiterFromOption('auto')).toBe('')
    expect(delimiterFromOption('tab')).toBe('\t')
  })
})

describe('header / sort', () => {
  const rows = [['n', 'v'], ['a', '10'], ['b', '9'], ['c', ''], ['d', '-2.5'], ['e', 'x']]
  it('splits header, generating names when absent or blank', () => {
    expect(splitHeader(rows, true).body).toHaveLength(5)
    expect(splitHeader(rows, false).header).toEqual(['col1', 'col2'])
    expect(splitHeader([['', 'z']], true).header).toEqual(['col1', 'z'])
    expect(splitHeader([], true)).toEqual({ header: [], body: [] })
  })

  it('compares numerically, not lexically', () => {
    expect(compareCells('9', '10')).toBeLessThan(0)
    expect(compareCells('1,000', '999')).toBeGreaterThan(0)
    expect(compareCells('file2', 'file10')).toBeLessThan(0)
    expect(compareCells('5', 'abc')).toBeLessThan(0)
  })

  it('sorts ascending/descending with empties last and is stable', () => {
    const body = splitHeader(rows, true).body
    expect(sortRows(body, 1, 'asc').map((r) => r[0])).toEqual(['d', 'b', 'a', 'e', 'c'])
    expect(sortRows(body, 1, 'desc').map((r) => r[0])).toEqual(['e', 'a', 'b', 'd', 'c'])
    expect(body[0][0]).toBe('a') // input untouched
    expect(sortRows([['x', '1'], ['y', '1']], 1, 'desc').map((r) => r[0])).toEqual(['x', 'y'])
  })

  it('normalizeRows pads', () => {
    expect(normalizeRows([['a'], ['b', 'c']])).toEqual([['a', ''], ['b', 'c']])
  })
})

describe('serialisation', () => {
  const header = ['name', 'note']
  const body = [['Ann', 'a|b'], ['Bob', 'l1\nl2']]

  it('markdown escapes pipes and newlines', () => {
    expect(toMarkdown(header, body)).toBe(
      '| name | note |\n| --- | --- |\n| Ann | a\\|b |\n| Bob | l1<br>l2 |',
    )
    expect(toMarkdown([], [])).toBe('')
  })

  it('tsv quotes tabs, quotes and newlines', () => {
    expect(toTsv([['a', 'b\tc'], ['d"e', 'f\ng']])).toBe('a\t"b\tc"\n"d""e"\t"f\ng"')
  })

  it('json as objects with unique keys, or arrays', () => {
    const parsed = JSON.parse(toJson(['a', 'a', '__proto__'], [['1', '2', '3']], true))
    expect(Object.keys(parsed[0])).toEqual(['a', 'a_2', '__proto__'])
    expect(parsed[0].a_2).toBe('2')
    expect(JSON.parse(toJson(header, body, false))).toEqual(body)
    expect(uniqueHeaders(['x', 'x', 'x'])).toEqual(['x', 'x_2', 'x_3'])
  })

  it('round-trips through tsv parse', () => {
    const rows = [['a', 'b'], ['x\ty', 'q"r\ns']]
    expect(parseCsv(toTsv(rows), 'tab').rows).toEqual(rows)
  })
})
