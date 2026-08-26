export function maskName(
  name: string,
  pos: 'middle' | 'sides',
  n: number,
  char: string,
): string {
  // Operate on code points so surrogate pairs (rare CJK, emoji) are not split.
  const chars = Array.from(name)
  if (chars.length === 0) return ''
  const count = Math.max(0, Math.floor(n))
  if (count === 0) return name
  if (chars.length === 1) return char
  const safe = Math.min(count, chars.length - 1)
  if (pos === 'middle') {
    const start = Math.floor((chars.length - safe) / 2)
    return chars.slice(0, start).join('') + char.repeat(safe) + chars.slice(start + safe).join('')
  } else {
    const left = Math.floor(safe / 2)
    const right = safe - left
    return char.repeat(left) + chars.slice(left, chars.length - right).join('') + char.repeat(right)
  }
}
