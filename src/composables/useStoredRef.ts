import { ref, watch, type Ref } from 'vue'

const PREFIX = 'app.tool.'

/**
 * A ref persisted to localStorage, so a tool remembers the user's options
 * (mode, format, quality, …) between visits.
 *
 *   const indent = useStoredRef('json-format.indent', '2', oneOf(['2', '4', 'tab']))
 *
 * Pass a type guard to validate stored values; otherwise the stored value
 * must have the same `typeof` as the default.
 */
export function useStoredRef<T>(key: string, defaultValue: T, validate?: (v: unknown) => v is T): Ref<T> {
  let initial = defaultValue
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw)
      const ok = validate
        ? validate(parsed)
        : parsed !== null && typeof parsed === typeof defaultValue && Array.isArray(parsed) === Array.isArray(defaultValue)
      if (ok) initial = parsed as T
    }
  } catch {
    // Unreadable storage or corrupt JSON: fall back to the default.
  }
  const r = ref(initial) as Ref<T>
  watch(
    r,
    (v) => {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(v))
      } catch {
        // Quota exceeded / storage blocked: the option simply isn't remembered.
      }
    },
    { deep: true },
  )
  return r
}

/** Type guard factory for enum-like string/number options. */
export function oneOf<const T extends readonly (string | number)[]>(values: T) {
  return (v: unknown): v is T[number] => values.includes(v as T[number])
}

export const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Type guard for an integer within [min, max]. */
export const intBetween = (min: number, max: number) => (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'

/** Forget every remembered tool option (Settings → clear local data). */
export function clearStoredRefs(): number {
  let n = 0
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) {
        localStorage.removeItem(k)
        n++
      }
    }
  } catch {
    // ignore
  }
  return n
}
