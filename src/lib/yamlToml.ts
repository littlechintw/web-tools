// YAML / TOML / JSON parsing, formatting and conversion.
// Uses js-yaml's default (core) schema, which has no code-executing tags, and smol-toml.
import { dump as yamlDump, load as yamlLoad } from 'js-yaml'
import { parse as tomlParse, stringify as tomlStringify } from 'smol-toml'

export const FORMATS = ['yaml', 'toml', 'json'] as const
export type Format = (typeof FORMATS)[number]

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string; line?: number; column?: number }

/** Position inside JSON.parse messages ("at position 12" or "line 2 column 5"). */
function jsonPosition(msg: string, text: string): { line?: number; column?: number } {
  const lc = /line (\d+) column (\d+)/.exec(msg)
  if (lc) return { line: Number(lc[1]), column: Number(lc[2]) }
  const pos = /position (\d+)/.exec(msg)
  if (pos) {
    const upTo = text.slice(0, Number(pos[1]))
    const lines = upTo.split('\n')
    return { line: lines.length, column: lines[lines.length - 1].length + 1 }
  }
  return {}
}

/** Parse text in the given format. Never throws; line/column are 1-based when known. */
export function parseText(text: string, format: Format): ParseResult {
  try {
    if (format === 'json') return { ok: true, value: JSON.parse(text) }
    if (format === 'toml') return { ok: true, value: tomlParse(text) }
    return { ok: true, value: yamlLoad(text) }
  } catch (e) {
    const err = e as Error & { line?: number; column?: number; reason?: string; mark?: { line: number; column: number } }
    if (format === 'json') return { ok: false, message: err.message, ...jsonPosition(err.message, text) }
    if (format === 'toml') {
      return {
        ok: false,
        message: (err.message ?? String(e)).split('\n')[0],
        line: typeof err.line === 'number' ? err.line : undefined,
        column: typeof err.column === 'number' ? err.column : undefined,
      }
    }
    return {
      ok: false,
      message: err.reason ?? err.message ?? String(e),
      line: err.mark ? err.mark.line + 1 : undefined,
      column: err.mark ? err.mark.column + 1 : undefined,
    }
  }
}

/** Convert Date instances (TOML datetimes) to ISO strings so every emitter agrees. */
export function toPlain(v: unknown): unknown {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? String(v) : v.toISOString()
  if (Array.isArray(v)) return v.map(toPlain)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) {
      Object.defineProperty(out, k, { value: toPlain(val), enumerable: true, writable: true, configurable: true })
    }
    return out
  }
  return v
}

/** JSON-pointer-ish paths of every null/undefined value (TOML cannot represent them). */
export function findNulls(v: unknown, path = '$'): string[] {
  if (v === null || v === undefined) return [path]
  if (Array.isArray(v)) return v.flatMap((x, i) => findNulls(x, `${path}[${i}]`))
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    return Object.entries(v).flatMap(([k, x]) => findNulls(x, `${path}.${k}`))
  }
  return []
}

/** Remove null/undefined object members (arrays are left alone: TOML rejects those). */
function dropNullMembers(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(dropNullMembers)
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) {
      if (x === null || x === undefined) continue
      Object.defineProperty(out, k, { value: dropNullMembers(x), enumerable: true, writable: true, configurable: true })
    }
    return out
  }
  return v
}

export interface StringifyResult {
  ok: boolean
  text: string
  /** Why it failed (when ok is false). */
  message: string
  /** Paths of null values that could not be kept (TOML only). */
  droppedNulls: string[]
}

/** Serialise a parsed value. `indent` applies to YAML and JSON; TOML has fixed layout. */
export function stringifyValue(value: unknown, format: Format, indent = 2): StringifyResult {
  const fail = (message: string): StringifyResult => ({ ok: false, text: '', message, droppedNulls: [] })
  try {
    const plain = toPlain(value)
    if (format === 'json') {
      const s = JSON.stringify(plain, null, indent)
      return { ok: true, text: s === undefined ? 'null' : s, message: '', droppedNulls: [] }
    }
    if (format === 'yaml') {
      const s = yamlDump(plain, { indent, lineWidth: 100 })
      return { ok: true, text: s.endsWith('\n') ? s.slice(0, -1) : s, message: '', droppedNulls: [] }
    }
    if (!plain || typeof plain !== 'object' || Array.isArray(plain)) return fail('TOML_TOP_LEVEL')
    const nulls = findNulls(plain)
    const arrayNull = nulls.some((p) => /\[\d+\]$/.test(p))
    if (arrayNull) return fail('TOML_NULL_IN_ARRAY')
    const s = tomlStringify(dropNullMembers(plain) as Record<string, unknown>)
    return { ok: true, text: s.replace(/\n$/, ''), message: '', droppedNulls: nulls }
  } catch (e) {
    return fail((e as Error).message)
  }
}

export interface ConvertResult extends StringifyResult {
  /** Parse failure details, if the input was invalid. */
  parseError?: { message: string; line?: number; column?: number }
}

/** Parse `text` as `from` and write it as `to` (same format = reformat). Blank input gives empty ok output. */
export function convert(text: string, from: Format, to: Format, indent = 2): ConvertResult {
  if (!text.trim()) return { ok: true, text: '', message: '', droppedNulls: [] }
  const p = parseText(text, from)
  if (!p.ok) return { ok: false, text: '', message: p.message, droppedNulls: [], parseError: { message: p.message, line: p.line, column: p.column } }
  return stringifyValue(p.value, to, indent)
}
