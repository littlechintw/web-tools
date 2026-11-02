// Pure helpers for the CSV viewer: parsing, sorting and serialisation.
import Papa from 'papaparse'

export const DELIMITER_OPTIONS = ['auto', 'comma', 'tab', 'semicolon', 'pipe'] as const
export type DelimiterOption = (typeof DELIMITER_OPTIONS)[number]

/** Map a UI option to a papaparse delimiter ('' = auto-detect). */
export function delimiterFromOption(opt: DelimiterOption): string {
  switch (opt) {
    case 'comma':
      return ','
    case 'tab':
      return '\t'
    case 'semicolon':
      return ';'
    case 'pipe':
      return '|'
    default:
      return ''
  }
}

export interface ParsedCsv {
  rows: string[][]
  /** Delimiter that was actually used (detected or chosen). */
  delimiter: string
  /** First parser warning/error message, if any (rows are still returned). */
  error: string
}

/** Parse CSV/TSV text into a rectangular string matrix. Never throws. */
export function parseCsv(text: string, option: DelimiterOption = 'auto'): ParsedCsv {
  if (!text.trim()) return { rows: [], delimiter: ',', error: '' }
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const res = Papa.parse<string[]>(src, {
    delimiter: delimiterFromOption(option),
    skipEmptyLines: 'greedy',
    header: false,
  })
  const rows = normalizeRows(res.data.filter((r) => Array.isArray(r)))
  // Papa reports "UndetectableDelimiter" for single-column data; that is fine.
  const err = res.errors.find((e) => e.code !== 'UndetectableDelimiter')
  return { rows, delimiter: res.meta.delimiter || ',', error: err ? err.message : '' }
}

/** Pad short rows so every row has the same width. */
export function normalizeRows(rows: string[][]): string[][] {
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0)
  return rows.map((r) => (r.length === width ? r : [...r, ...Array<string>(width - r.length).fill('')]))
}

/** Header names + body rows, with generated names when there is no header row. */
export function splitHeader(rows: string[][], hasHeader: boolean): { header: string[]; body: string[][] } {
  if (!rows.length) return { header: [], body: [] }
  if (hasHeader) return { header: rows[0].map((h, i) => (h.trim() ? h : `col${i + 1}`)), body: rows.slice(1) }
  return { header: rows[0].map((_, i) => `col${i + 1}`), body: rows }
}

const NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/

function asNumber(s: string): number | null {
  const v = s.trim().replace(/,/g, '')
  if (!v || !NUM_RE.test(v)) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Numeric-aware comparison: numbers by value, otherwise natural text order; empty cells last. */
export function compareCells(a: string, b: string): number {
  const ea = a.trim() === ''
  const eb = b.trim() === ''
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1
  const na = asNumber(a)
  const nb = asNumber(b)
  if (na !== null && nb !== null) return na - nb
  if (na !== null) return -1
  if (nb !== null) return 1
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/** Stable sort of rows by a column; returns a new array. Empty cells stay last in both directions. */
export function sortRows(rows: string[][], col: number, dir: 'asc' | 'desc'): string[][] {
  const sign = dir === 'asc' ? 1 : -1
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      const a = x.r[col] ?? ''
      const b = y.r[col] ?? ''
      const ea = a.trim() === ''
      const eb = b.trim() === ''
      const c = ea || eb ? compareCells(a, b) : sign * compareCells(a, b)
      return c || x.i - y.i
    })
    .map((x) => x.r)
}

/** Make header names unique (a, a -> a, a_2) so they can be JSON keys. */
export function uniqueHeaders(header: string[]): string[] {
  const seen = new Map<string, number>()
  return header.map((h) => {
    const n = (seen.get(h) ?? 0) + 1
    seen.set(h, n)
    return n === 1 ? h : `${h}_${n}`
  })
}

export function toJson(header: string[], body: string[][], asObjects: boolean): string {
  if (!asObjects) return JSON.stringify(body, null, 2)
  const keys = uniqueHeaders(header)
  const objs = body.map((r) => {
    const o: Record<string, string> = {}
    keys.forEach((k, i) => {
      Object.defineProperty(o, k, { value: r[i] ?? '', enumerable: true, writable: true, configurable: true })
    })
    return o
  })
  return JSON.stringify(objs, null, 2)
}

function tsvCell(s: string): string {
  return /[\t\r\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** TSV with RFC-4180 style quoting for cells containing tabs, newlines or quotes. */
export function toTsv(rows: string[][]): string {
  return rows.map((r) => r.map(tsvCell).join('\t')).join('\n')
}

function mdCell(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r\n|\r|\n/g, '<br>')
}

/** GitHub-flavoured Markdown table. */
export function toMarkdown(header: string[], body: string[][]): string {
  if (!header.length) return ''
  const line = (cells: string[]) => `| ${cells.map(mdCell).join(' | ')} |`
  return [line(header), line(header.map(() => '---')), ...body.map((r) => line(header.map((_, i) => r[i] ?? '')))].join('\n')
}
