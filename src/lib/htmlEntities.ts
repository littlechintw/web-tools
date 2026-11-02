// HTML entity encoding/decoding with a self-written table.
// NOTE: this is NOT the full HTML5 entity list (2,231 names). It covers the
// HTML 4 set (Latin-1, symbols, Greek, math, arrows, punctuation) plus a few
// common HTML5 additions - roughly 300 names. Unknown names stay untouched.
// Decoding never uses innerHTML / DOMParser, so it cannot execute markup.

const LATIN1 =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'.split(
    ' ',
  )
const GREEK_UPPER = 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho'.split(' ')
const GREEK_UPPER2 = 'Sigma Tau Upsilon Phi Chi Psi Omega'.split(' ')
const GREEK_LOWER = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigmaf sigma tau upsilon phi chi psi omega'.split(' ')

// name:codepoint pairs (decimal)
const SYMBOLS =
  'quot:34 amp:38 lt:60 gt:62 OElig:338 oelig:339 Scaron:352 scaron:353 Yuml:376 fnof:402 circ:710 tilde:732 ' +
  'thetasym:977 upsih:978 piv:982 ensp:8194 emsp:8195 thinsp:8201 zwnj:8204 zwj:8205 lrm:8206 rlm:8207 ' +
  'ndash:8211 mdash:8212 lsquo:8216 rsquo:8217 sbquo:8218 ldquo:8220 rdquo:8221 bdquo:8222 dagger:8224 Dagger:8225 ' +
  'bull:8226 hellip:8230 permil:8240 prime:8242 Prime:8243 lsaquo:8249 rsaquo:8250 oline:8254 frasl:8260 euro:8364 ' +
  'image:8465 weierp:8472 real:8476 trade:8482 alefsym:8501 larr:8592 uarr:8593 rarr:8594 darr:8595 harr:8596 crarr:8629 ' +
  'lArr:8656 uArr:8657 rArr:8658 dArr:8659 hArr:8660 forall:8704 part:8706 exist:8707 empty:8709 nabla:8711 isin:8712 ' +
  'notin:8713 ni:8715 prod:8719 sum:8721 minus:8722 lowast:8727 radic:8730 prop:8733 infin:8734 ang:8736 and:8743 or:8744 ' +
  'cap:8745 cup:8746 int:8747 there4:8756 sim:8764 cong:8773 asymp:8776 ne:8800 equiv:8801 le:8804 ge:8805 sub:8834 ' +
  'sup:8835 nsub:8836 sube:8838 supe:8839 oplus:8853 otimes:8855 perp:8869 sdot:8901 lceil:8968 rceil:8969 lfloor:8970 ' +
  'rfloor:8971 lang:10216 rang:10217 loz:9674 spades:9824 clubs:9827 hearts:9829 diams:9830 ' +
  'check:10003 star:9734 starf:9733 phone:9742 female:9792 male:9794 copysr:8471 hyphen:8208 dash:8208 ' +
  'larrhk:8617 rarrhk:8618 map:8614 hookleftarrow:8617 hookrightarrow:8618 leftarrow:8592 rightarrow:8594 uparrow:8593 downarrow:8595 ' +
  'bullet:8226 hellip:8230 mldr:8230 nldr:8229 half:189 laquo:171 raquo:187 half:189 incare:8453 numero:8470 ' +
  'cir:9675 squ:9633 square:9633 blacksquare:9642 utri:9653 dtri:9663 ltri:9667 rtri:9657 phone:9742 sung:9834 flat:9837 natural:9838 sharp:9839 ' +
  'checkmark:10003 cross:10007 malt:10016 sext:10038 lbbrk:10098 rbbrk:10099'

// HTML5-only aliases: decoded, but never produced when encoding.
const ASCII_EXTRAS: Record<string, number> = {
  apos: 39, Tab: 9, NewLine: 10, excl: 33, num: 35, dollar: 36, percnt: 37, lpar: 40, rpar: 41, ast: 42, plus: 43,
  comma: 44, period: 46, sol: 47, colon: 58, semi: 59, equals: 61, quest: 63, commat: 64, lsqb: 91, lbrack: 91,
  bsol: 92, rsqb: 93, rbrack: 93, Hat: 94, lowbar: 95, grave: 96, lcub: 123, lbrace: 123, verbar: 124, vert: 124,
  rcub: 125, rbrace: 125, AMP: 38, LT: 60, GT: 62, QUOT: 34, COPY: 169, REG: 174,
}

/** name -> code point. */
export const ENTITIES: Readonly<Record<string, number>> = (() => {
  const m: Record<string, number> = {}
  LATIN1.forEach((n, i) => (m[n] = 160 + i))
  GREEK_UPPER.forEach((n, i) => (m[n] = 913 + i))
  GREEK_UPPER2.forEach((n, i) => (m[n] = 931 + i))
  GREEK_LOWER.forEach((n, i) => (m[n] = 945 + i))
  for (const pair of SYMBOLS.split(' ')) {
    const [n, c] = pair.split(':')
    m[n] = Number(c)
  }
  Object.assign(m, ASCII_EXTRAS)
  return m
})()

/** Entities that may be written without a trailing semicolon (HTML legacy set). */
const LEGACY = new Set<string>([
  ...LATIN1,
  'amp', 'lt', 'gt', 'quot', 'AMP', 'LT', 'GT', 'QUOT', 'COPY', 'REG',
])
const MAX_LEGACY_LEN = Math.max(...[...LEGACY].map((s) => s.length))

/** code point -> preferred name, used for encoding (only names from the HTML4 set). */
const PREFERRED: Map<number, string> = (() => {
  const m = new Map<number, string>()
  const skip = new Set([
    ...Object.keys(ASCII_EXTRAS),
    'hyphen', 'dash', 'larrhk', 'rarrhk', 'map', 'hookleftarrow', 'hookrightarrow', 'leftarrow', 'rightarrow', 'uparrow',
    'downarrow', 'bullet', 'mldr', 'nldr', 'half', 'incare', 'numero', 'cir', 'squ', 'square', 'blacksquare', 'utri',
    'dtri', 'ltri', 'rtri', 'sung', 'flat', 'natural', 'sharp', 'checkmark', 'cross', 'malt', 'sext', 'lbbrk', 'rbbrk',
    'check', 'star', 'starf', 'phone', 'female', 'male', 'copysr',
  ])
  for (const [n, c] of Object.entries(ENTITIES)) if (!skip.has(n) && !m.has(c)) m.set(c, n)
  return m
})()

// Windows-1252 remapping of C1 numeric references (0x80-0x9F), per the HTML spec.
const C1: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6,
  0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c,
  0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
}

/** Resolve a numeric reference to a character; invalid values become U+FFFD. */
export function codePointToChar(cp: number): string {
  if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '�'
  return String.fromCodePoint(C1[cp] ?? cp)
}

const REF_RE = /&(?:#[xX]([0-9a-fA-F]+);?|#([0-9]+);?|([A-Za-z][A-Za-z0-9]*);?)/g

/** Decode named, decimal and hexadecimal character references. Unknown/malformed ones stay as written. */
export function decodeEntities(input: string): string {
  return input.replace(REF_RE, (match, hex: string | undefined, dec: string | undefined, name: string | undefined) => {
    if (hex !== undefined || dec !== undefined) {
      const digits = hex ?? (dec as string)
      // Absurdly long digit strings are out of range anyway; avoid precision issues.
      const cp = digits.replace(/^0+/, '').length > 8 ? Infinity : parseInt(digits, hex !== undefined ? 16 : 10)
      return codePointToChar(cp)
    }
    const n = name as string
    if (match.endsWith(';') && Object.prototype.hasOwnProperty.call(ENTITIES, n)) return String.fromCodePoint(ENTITIES[n])
    // Unknown name or no semicolon: only legacy entities, longest prefix wins (as browsers do).
    for (let len = Math.min(n.length, MAX_LEGACY_LEN); len >= 2; len--) {
      const prefix = n.slice(0, len)
      if (LEGACY.has(prefix)) return String.fromCodePoint(ENTITIES[prefix]) + match.slice(1 + len)
    }
    return match
  })
}

export interface EncodeOptions {
  /** 'basic' = & < > " ' only; 'all' = also every non-ASCII character. */
  scope: 'basic' | 'all'
  /** Use a named entity when one is known. */
  named: boolean
  /** Numeric style for anything without a name (or when named is off). */
  numeric: 'decimal' | 'hex'
}

export const DEFAULT_ENCODE: EncodeOptions = { scope: 'basic', named: true, numeric: 'decimal' }

function numericRef(cp: number, style: 'decimal' | 'hex'): string {
  return style === 'hex' ? `&#x${cp.toString(16).toUpperCase()};` : `&#${cp};`
}

/** Encode text as HTML entities (iterates by code point, so emoji become one reference). */
export function encodeEntities(input: string, opts: Partial<EncodeOptions> = {}): string {
  const o = { ...DEFAULT_ENCODE, ...opts }
  let out = ''
  for (const ch of input) {
    const cp = ch.codePointAt(0) as number
    if (ch === '&') out += '&amp;'
    else if (ch === '<') out += '&lt;'
    else if (ch === '>') out += '&gt;'
    else if (ch === '"') out += o.named ? '&quot;' : numericRef(cp, o.numeric)
    else if (ch === "'") out += numericRef(cp, o.numeric === 'hex' ? 'hex' : 'decimal') // &#39; (not &apos;: HTML4-safe)
    else if (cp > 127 && o.scope === 'all') {
      const name = o.named ? PREFERRED.get(cp) : undefined
      out += name ? `&${name};` : numericRef(cp, o.numeric)
    } else out += ch
  }
  return out
}
