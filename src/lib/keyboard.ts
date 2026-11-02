/** Key labelling and ANSI layout data for the keyboard tester (framework-free). */

export interface KeyDef {
  code: string
  label: string
  /** width in key units */
  w: number
}
/** `{ gap: n }` is an empty spacer of n units. */
export type LayoutItem = KeyDef | { gap: number }
export const isGap = (i: LayoutItem): i is { gap: number } => 'gap' in i

const k = (code: string, label: string, w = 1): KeyDef => ({ code, label, w })
const letters = (s: string) => [...s].map((c) => k(`Key${c}`, c))
const fkeys = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => k(`F${from + i}`, `F${from + i}`))

export const MAIN_LAYOUT: LayoutItem[][] = [
  [k('Escape', 'Esc'), { gap: 1 }, ...fkeys(1, 4), { gap: 0.5 }, ...fkeys(5, 8), { gap: 0.5 }, ...fkeys(9, 12)],
  [
    k('Backquote', '`'),
    ...[...'1234567890'].map((c) => k(`Digit${c}`, c)),
    k('Minus', '-'), k('Equal', '='), k('Backspace', '⌫', 2),
  ],
  [k('Tab', 'Tab', 1.5), ...letters('QWERTYUIOP'), k('BracketLeft', '['), k('BracketRight', ']'), k('Backslash', '\\', 1.5)],
  [k('CapsLock', 'Caps', 1.75), ...letters('ASDFGHJKL'), k('Semicolon', ';'), k('Quote', "'"), k('Enter', 'Enter', 2.25)],
  [k('ShiftLeft', 'Shift', 2.25), ...letters('ZXCVBNM'), k('Comma', ','), k('Period', '.'), k('Slash', '/'), k('ShiftRight', 'Shift', 2.75)],
  [
    k('ControlLeft', 'Ctrl', 1.25), k('MetaLeft', 'Win', 1.25), k('AltLeft', 'Alt', 1.25), k('Space', 'Space', 6.25),
    k('AltRight', 'Alt', 1.25), k('MetaRight', 'Win', 1.25), k('ContextMenu', 'Menu', 1.25), k('ControlRight', 'Ctrl', 1.25),
  ],
]

export const NAV_LAYOUT: LayoutItem[][] = [
  [k('PrintScreen', 'PrtSc'), k('ScrollLock', 'ScrLk'), k('Pause', 'Pause')],
  [k('Insert', 'Ins'), k('Home', 'Home'), k('PageUp', 'PgUp')],
  [k('Delete', 'Del'), k('End', 'End'), k('PageDown', 'PgDn')],
  [{ gap: 3 }],
  [{ gap: 1 }, k('ArrowUp', '↑')],
  [k('ArrowLeft', '←'), k('ArrowDown', '↓'), k('ArrowRight', '→')],
]

export const NUMPAD_LAYOUT: LayoutItem[][] = [
  [k('NumLock', 'Num'), k('NumpadDivide', '/'), k('NumpadMultiply', '*'), k('NumpadSubtract', '-')],
  [k('Numpad7', '7'), k('Numpad8', '8'), k('Numpad9', '9'), k('NumpadAdd', '+')],
  [k('Numpad4', '4'), k('Numpad5', '5'), k('Numpad6', '6'), { gap: 1 }],
  [k('Numpad1', '1'), k('Numpad2', '2'), k('Numpad3', '3'), k('NumpadEnter', 'Ent')],
  [k('Numpad0', '0', 2), k('NumpadDecimal', '.'), { gap: 1 }],
]

export function layoutCodes(): string[] {
  return [MAIN_LAYOUT, NAV_LAYOUT, NUMPAD_LAYOUT].flatMap((l) => l.flat()).filter((i): i is KeyDef => !isGap(i)).map((i) => i.code)
}

/** Human-readable name for `KeyboardEvent.key`. */
export function keyDisplay(key: string): string {
  if (key === ' ') return 'Space'
  if (key === '') return '(empty)'
  if (key === 'Unidentified') return 'Unidentified'
  return key
}

export const LOCATION_NAMES = ['standard', 'left', 'right', 'numpad'] as const
export function locationName(location: number): (typeof LOCATION_NAMES)[number] | 'unknown' {
  return LOCATION_NAMES[location] ?? 'unknown'
}

export interface KeyEventInfo {
  type: string
  key: string
  code: string
  location: number
  keyCode: number
  repeat: boolean
}

export function describeEvent(e: { type: string; key: string; code: string; location: number; keyCode: number; repeat?: boolean }): KeyEventInfo {
  return {
    type: e.type,
    key: e.key,
    code: e.code || '(none)',
    location: e.location,
    keyCode: e.keyCode,
    repeat: !!e.repeat,
  }
}

/** Plain-text line for copying a log entry. */
export function formatEvent(i: KeyEventInfo): string {
  return `${i.type} key=${JSON.stringify(i.key)} code=${i.code} location=${i.location}(${locationName(i.location)}) keyCode=${i.keyCode}${i.repeat ? ' repeat' : ''}`
}
