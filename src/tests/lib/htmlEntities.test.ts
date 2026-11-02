import { describe, it, expect } from 'vitest'
import { codePointToChar, decodeEntities, encodeEntities, ENTITIES } from '@/lib/htmlEntities'

describe('table sanity', () => {
  it('has well-known values and a few hundred names', () => {
    expect(Object.keys(ENTITIES).length).toBeGreaterThan(250)
    expect(ENTITIES.copy).toBe(0xa9)
    expect(ENTITIES.yuml).toBe(0xff)
    expect(ENTITIES.eacute).toBe(0xe9)
    expect(ENTITIES.Omega).toBe(0x3a9)
    expect(ENTITIES.omega).toBe(0x3c9)
    expect(ENTITIES.sigmaf).toBe(0x3c2)
    expect(ENTITIES.euro).toBe(0x20ac)
    expect(ENTITIES.hearts).toBe(0x2665)
    expect(ENTITIES.nbsp).toBe(160)
  })
})

describe('decodeEntities', () => {
  it('decodes named, decimal and hex references', () => {
    expect(decodeEntities('&lt;p&gt;Tom &amp; Jerry&lt;/p&gt;')).toBe('<p>Tom & Jerry</p>')
    expect(decodeEntities('&#65;&#x42;&#X43;')).toBe('ABC')
    expect(decodeEntities('&copy; &eacute; &euro; &mdash; &hearts;')).toBe('© é € — ♥')
    expect(decodeEntities('&apos;&quot;')).toBe('\'"')
  })

  it('decodes astral code points (emoji)', () => {
    expect(decodeEntities('&#128512;')).toBe('😀')
    expect(decodeEntities('&#x1F600;')).toBe('😀')
  })

  it('handles legacy entities without a semicolon, longest prefix', () => {
    expect(decodeEntities('a &amp b')).toBe('a & b')
    expect(decodeEntities('&copy 2024')).toBe('© 2024')
    expect(decodeEntities('&notit;')).toBe('¬it;')
    expect(decodeEntities('&ampfoo')).toBe('&foo')
    // non-legacy names need the semicolon
    expect(decodeEntities('&euro 5')).toBe('&euro 5')
    expect(decodeEntities('&hearts')).toBe('&hearts')
  })

  it('leaves malformed or unknown references untouched', () => {
    expect(decodeEntities('&#xZZ;')).toBe('&#xZZ;')
    expect(decodeEntities('&#;')).toBe('&#;')
    expect(decodeEntities('&;')).toBe('&;')
    expect(decodeEntities('&unknown;')).toBe('&unknown;')
    expect(decodeEntities('R&D & co')).toBe('R&D & co')
    expect(decodeEntities('&constructor;')).toBe('&constructor;')
    expect(decodeEntities('&__proto__;')).toBe('&__proto__;')
  })

  it('replaces invalid code points with U+FFFD', () => {
    expect(decodeEntities('&#0;')).toBe('�')
    expect(decodeEntities('&#xD800;')).toBe('�')
    expect(decodeEntities('&#xDFFF;')).toBe('�')
    expect(decodeEntities('&#x110000;')).toBe('�')
    expect(decodeEntities('&#99999999999999999999;')).toBe('�')
    expect(codePointToChar(-1)).toBe('�')
  })

  it('maps C1 numeric references like browsers (windows-1252)', () => {
    expect(decodeEntities('&#128;')).toBe('€')
    expect(decodeEntities('&#150;')).toBe('–')
  })

  it('accepts numeric references without semicolon', () => {
    expect(decodeEntities('&#65 x')).toBe('A x')
  })

  it('is not double-decoding', () => {
    expect(decodeEntities('&amp;lt;')).toBe('&lt;')
  })
})

describe('encodeEntities', () => {
  it('basic scope only touches & < > " \'', () => {
    expect(encodeEntities('<a href="x">T\'s & é</a>')).toBe('&lt;a href=&quot;x&quot;&gt;T&#39;s &amp; é&lt;/a&gt;')
  })

  it('all scope uses names when known, numeric otherwise', () => {
    expect(encodeEntities('café © 中', { scope: 'all' })).toBe('caf&eacute; &copy; &#20013;')
    expect(encodeEntities('中', { scope: 'all', numeric: 'hex' })).toBe('&#x4E2D;')
    expect(encodeEntities('é', { scope: 'all', named: false })).toBe('&#233;')
  })

  it('encodes emoji as a single astral reference', () => {
    expect(encodeEntities('😀', { scope: 'all' })).toBe('&#128512;')
    expect(encodeEntities('😀', { scope: 'all', numeric: 'hex' })).toBe('&#x1F600;')
  })

  it('does not mangle lone surrogates or empty input', () => {
    expect(encodeEntities('')).toBe('')
    expect(() => encodeEntities('\uD800x', { scope: 'all' })).not.toThrow()
  })

  it('round-trips through decode', () => {
    const s = '<b>"Tom" & \'Jerry\' – café 😀 Ω ≠ 中文</b>'
    for (const scope of ['basic', 'all'] as const) {
      for (const named of [true, false]) {
        expect(decodeEntities(encodeEntities(s, { scope, named }))).toBe(s)
      }
    }
  })
})
