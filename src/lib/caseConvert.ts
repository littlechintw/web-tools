/** Split arbitrary text into normalized lowercase words. */
export function words(s: string): string[] {
  return (
    s
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((w) => w.toLowerCase())
  )
}

export const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1)

export interface CaseRow {
  key: string
  value: string
}

export function toCases(input: string): CaseRow[] {
  const w = words(input)
  const sentence = w.length ? cap(w.join(' ')) : ''
  return [
    { key: 'camelCase', value: w.map((x, i) => (i ? cap(x) : x)).join('') },
    { key: 'PascalCase', value: w.map(cap).join('') },
    { key: 'snake_case', value: w.join('_') },
    { key: 'kebab-case', value: w.join('-') },
    { key: 'CONSTANT_CASE', value: w.join('_').toUpperCase() },
    { key: 'dot.case', value: w.join('.') },
    { key: 'Title Case', value: w.map(cap).join(' ') },
    { key: 'lowercase', value: input.toLowerCase() },
    { key: 'UPPERCASE', value: input.toUpperCase() },
    { key: 'Sentence case', value: sentence },
  ]
}
