export function maskName(
  name: string,
  pos: 'middle' | 'sides',
  n: number,
  char: string,
): string {
  if (name.length <= 1) return char
  const safe = Math.min(n, name.length - 1)
  if (pos === 'middle') {
    const start = Math.floor((name.length - safe) / 2)
    return name.slice(0, start) + char.repeat(safe) + name.slice(start + safe)
  } else {
    const left = Math.floor(safe / 2)
    const right = safe - left
    return char.repeat(left) + name.slice(left, name.length - right) + char.repeat(right)
  }
}
