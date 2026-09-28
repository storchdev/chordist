import type { BassSpec, Degree, Extension, Seventh, Tonic } from '../music/theory'

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
 * Extensions under the right hand. 9ths sit on I O P (flat / natural / sharp),
 * 11ths on K L, 13ths on M , (U is taken by the bass keys):
 *   I b9   O 9    P #9
 *   K 11   L #11
 *   M b13  , 13
 */
export const EXTENSION_KEYS: Record<string, Extension> = {
  KeyI: 'b9', KeyO: '9', KeyP: '#9',
  KeyK: '11', KeyL: '#11',
  KeyM: 'b13', Comma: '13',
}

type DegreeBass = Extract<BassSpec, { kind: 'degree' }>
const bass = (degree: Degree, accidental: -1 | 0 | 1 = 0): DegreeBass => ({ kind: 'degree', degree, accidental })

/**
 * One-off bass notes, chromatic from the tonic, laid out like a piano
 * (A S D F G H J = white keys, W E T Y U = black keys; in C: A = C, W = Db, S = D …).
 * Held, they set the bass of any chord played meanwhile. They only sound on their own
 * when the "bass key solo" toggle is on. With `/` held they latch as the pedal instead.
 */
export const BASS_KEYS: Record<string, DegreeBass> = {
  KeyA: bass(1), KeyW: bass(2, -1), KeyS: bass(2), KeyE: bass(3, -1), KeyD: bass(3), KeyF: bass(4),
  KeyT: bass(4, 1), KeyG: bass(5), KeyY: bass(6, -1), KeyH: bass(6), KeyU: bass(7, -1), KeyJ: bass(7),
}

/**
 * Alt + piano row jumps straight to a key: these fixed keys (Alt+A = C, Alt+W = Db … Alt+J = B), or with
 * the "relative modulation" setting, the note the bass key shows in the current key.
 */
export const TONIC_KEYS: Record<string, Tonic> = {
  KeyA: 'C', KeyW: 'Db', KeyS: 'D', KeyE: 'Eb', KeyD: 'E', KeyF: 'F',
  KeyT: 'F#', KeyG: 'G', KeyY: 'Ab', KeyH: 'A', KeyU: 'Bb', KeyJ: 'B',
}

/** One-off octave shift while held; applies to chords and bass notes alike */
export const OCTAVE_KEYS: Record<string, -1 | 1> = { KeyZ: -1, KeyX: 1 }

/** Inversions: hold to put a chord tone in the bass. 8 = 3rd, 9 = 5th, 0 = 7th */
export const INVERSION_KEYS: Record<string, 1 | 2 | 3> = {
  Digit8: 1, Digit9: 2, Digit0: 3,
}

/**
 * Slash bass layer: while held, degree keys silently latch a pedal bass
 * under following chords (`` ` `` flattens, Shift sharpens). Tap alone to clear the pedal.
 */
export const SLASH_KEY = 'Slash'

export const CONTROL_KEYS = {
  sustain: 'Space',
  octaveUp: 'ArrowUp',
  octaveDown: 'ArrowDown',
  tonicPrev: 'ArrowLeft',
  tonicNext: 'ArrowRight',
  voiceLeading: 'Tab',
  bass: 'Enter',
  bassKeysSound: 'KeyQ',
  panic: 'Escape',
} as const

export const MODIFIER_CODES = new Set<string>([
  ...Object.values(QUALITY_KEYS),
  ...Object.keys(SEVENTH_KEYS),
  ...Object.keys(EXTENSION_KEYS),
  ...Object.keys(INVERSION_KEYS),
  ...Object.keys(OCTAVE_KEYS),
  SLASH_KEY,
])

const RESERVED = new Set<string>([
  ...Object.keys(DEGREE_KEYS),
  ...Object.keys(BASS_KEYS),
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
  if (alt) return TONIC_KEYS[code] !== undefined
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
