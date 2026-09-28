import type { Degree, Extension, Seventh } from '../music/theory'

/**
 * Physical key layout, keyed by KeyboardEvent.code so it works regardless of
 * shift state or keyboard language. Left hand plays degrees on the number row,
 * right hand holds modifiers.
 */

export const DEGREE_KEYS: Record<string, Degree> = {
  Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5, Digit6: 6, Digit7: 7,
  Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4, Numpad5: 5, Numpad6: 6, Numpad7: 7,
}

export const QUALITY_KEYS = {
  dim: 'Minus',
  aug: 'Equal',
  sus2: 'Semicolon',
  sus4: 'Quote',
  flatRoot: 'Backquote',
} as const

/** `[` = "natural" 7th (maj→maj7, min→m7), `]` = dominant 7, `\` = diminished 7 */
export const SEVENTH_KEYS: Record<string, Seventh | 'natural'> = {
  BracketLeft: 'natural',
  BracketRight: 'b7',
  Backslash: 'bb7',
}

/**
 * Extension grid under the right hand. Columns are flat / natural / sharp,
 * rows are 9 / 11 / 13:
 *   U b9   I 9    O #9
 *          K 11   L #11
 *   M b13  , 13
 */
export const EXTENSION_KEYS: Record<string, Extension> = {
  KeyU: 'b9', KeyI: '9', KeyO: '#9',
  KeyK: '11', KeyL: '#11',
  KeyM: 'b13', Comma: '13',
}

export const CONTROL_KEYS = {
  sustain: 'Space',
  octaveUp: 'ArrowUp',
  octaveDown: 'ArrowDown',
  tonicPrev: 'ArrowLeft',
  tonicNext: 'ArrowRight',
  voiceLeading: 'Tab',
  bass: 'Enter',
  panic: 'Escape',
} as const

export const MODIFIER_CODES = new Set<string>([
  ...Object.values(QUALITY_KEYS),
  ...Object.keys(SEVENTH_KEYS),
  ...Object.keys(EXTENSION_KEYS),
])

const RESERVED = new Set<string>([
  ...Object.keys(DEGREE_KEYS),
  ...MODIFIER_CODES,
  ...Object.values(CONTROL_KEYS),
])

/** Codes that can never be bound (pure modifier keys) */
export const UNBINDABLE = new Set([
  'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight',
  'CapsLock', 'Escape',
])

/** True if a binding on this combo shadows a built-in key */
export function shadowsBuiltin(code: string, shift: boolean, alt: boolean): boolean {
  if (alt) return false
  if (DEGREE_KEYS[code] !== undefined) return true // shift+digit is also built-in
  return !shift && RESERVED.has(code)
}

export function prettyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6)
  const map: Record<string, string> = {
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';',
    Quote: "'", Backquote: '`', Comma: ',', Period: '.', Slash: '/', Space: 'Space',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  }
  return map[code] ?? code
}

export function comboLabel(code: string, shift: boolean, alt: boolean): string {
  return [alt && 'Alt', shift && 'Shift', prettyCode(code)].filter(Boolean).join(' + ')
}
