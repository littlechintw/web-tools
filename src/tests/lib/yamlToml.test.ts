import { describe, it, expect } from 'vitest'
import { convert, findNulls, parseText, stringifyValue, toPlain } from '@/lib/yamlToml'

describe('parseText', () => {
  it('parses all three formats', () => {
    expect(parseText('a: 1\nb: [x, y]', 'yaml')).toEqual({ ok: true, value: { a: 1, b: ['x', 'y'] } })
    expect(parseText('a = 1\n[t]\nb = "x"', 'toml')).toEqual({ ok: true, value: { a: 1, t: { b: 'x' } } })
    expect(parseText('{"a":[1,2]}', 'json')).toEqual({ ok: true, value: { a: [1, 2] } })
  })

  it('reports YAML line/column (1-based)', () => {
    const r = parseText('a: [1\nb: 2', 'yaml')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.line).toBe(2)
      expect(r.column).toBeGreaterThan(0)
    }
  })

  it('reports TOML line/column', () => {
    const r = parseText('a = 1\nb = ', 'toml')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.line).toBe(2)
      expect(r.column).toBe(5)
    }
  })

  it('reports JSON errors without throwing', () => {
    const r = parseText('{"a": }', 'json')
    expect(r.ok).toBe(false)
    expect(() => parseText('', 'yaml')).not.toThrow()
  })

  it('rejects code-executing YAML tags and multi-document streams', () => {
    expect(parseText('a: !!js/function "function(){}"', 'yaml').ok).toBe(false)
    expect(parseText('a: !!js/regexp /x/', 'yaml').ok).toBe(false)
    expect(parseText('a: 1\n---\nb: 2', 'yaml').ok).toBe(false)
  })
})

describe('convert', () => {
  const yaml = 'name: app\nversion: 1.5\nenabled: true\ntags:\n  - a\n  - b\nserver:\n  host: localhost\n  port: 8080'
  it('YAML -> TOML -> YAML round trip', () => {
    const toml = convert(yaml, 'yaml', 'toml')
    expect(toml.ok).toBe(true)
    expect(toml.text).toContain('[server]')
    expect(toml.text).toContain('port = 8080')
    const back = convert(toml.text, 'toml', 'yaml')
    expect(parseText(back.text, 'yaml')).toEqual(parseText(yaml, 'yaml'))
  })

  it('YAML -> JSON honours indent', () => {
    expect(convert('a: 1', 'yaml', 'json', 4).text).toBe('{\n    "a": 1\n}')
    expect(convert('a: 1', 'yaml', 'json', 2).text).toBe('{\n  "a": 1\n}')
  })

  it('JSON -> YAML honours indent for nesting', () => {
    expect(convert('{"a":{"b":1}}', 'json', 'yaml', 4).text).toBe('a:\n    b: 1')
    expect(convert('{"a":{"b":1}}', 'json', 'yaml', 2).text).toBe('a:\n  b: 1')
  })

  it('TOML datetimes become ISO strings in JSON', () => {
    const r = convert('d = 1979-05-27T07:32:00Z', 'toml', 'json')
    expect(JSON.parse(r.text)).toEqual({ d: '1979-05-27T07:32:00.000Z' })
  })

  it('reformats within the same format', () => {
    expect(convert('a:    1\nb:   [1,2]', 'yaml', 'yaml').text).toBe('a: 1\nb:\n  - 1\n  - 2')
  })

  it('blank input is ok and empty', () => {
    expect(convert('  \n', 'yaml', 'toml')).toMatchObject({ ok: true, text: '' })
  })

  it('surfaces parse errors with position', () => {
    const r = convert('a = ', 'toml', 'json')
    expect(r.ok).toBe(false)
    expect(r.parseError?.line).toBe(1)
  })
})

describe('TOML limitations', () => {
  it('drops null object members and reports them', () => {
    const r = convert('a: 1\nb: null\nc:\n  d: ~', 'yaml', 'toml')
    expect(r.ok).toBe(true)
    expect(r.droppedNulls).toEqual(['$.b', '$.c.d'])
    expect(r.text).not.toContain('b =')
    expect(r.text).toContain('a = 1')
  })

  it('fails on null inside arrays', () => {
    const r = stringifyValue({ a: [1, null] }, 'toml')
    expect(r.ok).toBe(false)
    expect(r.message).toBe('TOML_NULL_IN_ARRAY')
  })

  it('fails when the top level is not a table', () => {
    expect(stringifyValue([1, 2], 'toml').message).toBe('TOML_TOP_LEVEL')
    expect(stringifyValue('x', 'toml').ok).toBe(false)
  })

  it('findNulls / toPlain helpers', () => {
    expect(findNulls({ a: [null, { b: null }], c: 1 })).toEqual(['$.a[0]', '$.a[1].b'])
    expect(toPlain({ d: new Date('2020-01-02T03:04:05Z') })).toEqual({ d: '2020-01-02T03:04:05.000Z' })
  })
})
