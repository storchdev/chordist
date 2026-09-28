import { Chord, Interval, Key, Note } from 'tonal'

/** All tonics are major keys. Spelled the way musicians usually pick them. */
export const TONICS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'] as const
export type Tonic = (typeof TONICS)[number]

export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type Quality = 'maj' | 'min' | 'dim' | 'aug' | 'sus2' | 'sus4'
/** maj7 = major 7th (11 st), b7 = minor 7th (10 st), bb7 = diminished 7th (9 st) */
export type Seventh = 'maj7' | 'b7' | 'bb7'
export type Extension = 'b9' | '9' | '#9' | '11' | '#11' | 'b13' | '13'

export const EXTENSIONS: Extension[] = ['b9', '9', '#9', '11', '#11', 'b13', '13']

/**
 * Custom bass note. `chordTone` = inversion (index into the core chord tones: 1 = 3rd/sus, 2 = 5th, 3 = 7th).
 * `degree` = any scale degree of the key, optionally flattened/sharpened (pedal points, passing basses).
 */
export type BassSpec = { kind: 'chordTone'; index: 1 | 2 | 3 } | { kind: 'degree'; degree: Degree; accidental: -1 | 0 | 1 }

/**
 * A chord described relative to the current key. This is what the keyboard
 * produces and what relative custom bindings store, so they transpose with the tonic.
 */
export interface ChordSpec {
  degree: Degree
  flatRoot: boolean
  quality: Quality
  seventh: Seventh | null
  extensions: Extension[]
  /** Optional since relative bindings saved before bass support don't have it */
  bass?: BassSpec | null
}

export interface ResolvedChord {
  symbol: string
  /** Roman numeral relative to the key, or null for absolute chords */
  roman: string | null
  rootName: string
  rootPc: number
  /** Core chord tones (root, 3rd/sus, 5th, 7th) in semitones above the root */
  core: number[]
  /** Extensions in semitones above the root (13+) */
  extensions: number[]
  noteNames: string[]
  /** Slash bass, null when the bass is just the root */
  bassName: string | null
  bassPc: number | null
}

export const DIATONIC_QUALITY: Record<Degree, Quality> = {
  1: 'maj', 2: 'min', 3: 'min', 4: 'maj', 5: 'maj', 6: 'min', 7: 'dim',
}

const QUALITY_INTERVALS: Record<Quality, string[]> = {
  maj: ['1P', '3M', '5P'],
  min: ['1P', '3m', '5P'],
  dim: ['1P', '3m', '5d'],
  aug: ['1P', '3M', '5A'],
  sus2: ['1P', '2M', '5P'],
  sus4: ['1P', '4P', '5P'],
}
const SEVENTH_INTERVAL: Record<Seventh, string> = { maj7: '7M', b7: '7m', bb7: '7d' }
const EXTENSION_INTERVAL: Record<Extension, string> = {
  b9: '9m', '9': '9M', '#9': '9A', '11': '11P', '#11': '11A', b13: '13m', '13': '13M',
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export function scaleOf(tonic: Tonic): readonly string[] {
  return Key.majorKey(tonic).scale
}

function flatten(note: string): string {
  return note.endsWith('#') ? note.slice(0, -1) : note + 'b'
}

function sharpen(note: string): string {
  return note.endsWith('b') && note.length > 1 ? note.slice(0, -1) : note + '#'
}

/** Apply an accidental, respelling enharmonically to avoid double flats/sharps */
function alter(note: string, accidental: -1 | 0 | 1): string {
  if (accidental === 0) return note
  const out = accidental < 0 ? flatten(note) : sharpen(note)
  return /(bb|##)$/.test(out) ? Note.simplify(out) : out
}

export function accidentalText(accidental: -1 | 0 | 1): string {
  return accidental < 0 ? '♭' : accidental > 0 ? '♯' : ''
}

/** Name of a bass degree in a key, e.g. degree 4 sharp in C → F# */
export function bassDegreeName(tonic: Tonic, degree: Degree, accidental: -1 | 0 | 1): string {
  return alter(scaleOf(tonic)[degree - 1], accidental)
}

/** Scale-degree label for a pitch class in a major key, e.g. Bb in C → "♭7" */
function degreeLabel(tonic: Tonic, pc: number): string {
  const scalePcs = scaleOf(tonic).map((n) => Note.chroma(n) ?? 0)
  const exact = scalePcs.indexOf(pc)
  if (exact >= 0) return String(exact + 1)
  const flatOf = scalePcs.indexOf((pc + 1) % 12)
  return flatOf >= 0 ? `♭${flatOf + 1}` : `♯${scalePcs.indexOf((pc + 11) % 12) + 1}`
}

const TRIAD_FIGURES: Record<number, string> = { 1: '⁶', 2: '⁶₄' }
const SEVENTH_FIGURES: Record<number, string> = { 1: '⁶₅', 2: '⁴₃', 3: '⁴₂' }

function chordSuffix(q: Quality, s: Seventh | null): string {
  switch (q) {
    case 'maj': return s === 'maj7' ? 'maj7' : s === 'b7' ? '7' : ''
    case 'min': return s === 'maj7' ? 'm(maj7)' : s === 'b7' ? 'm7' : 'm'
    case 'dim': return s === 'bb7' ? 'dim7' : s === 'b7' ? 'm7b5' : s === 'maj7' ? 'dim(maj7)' : 'dim'
    case 'aug': return s === 'maj7' ? 'maj7#5' : s === 'b7' ? '7#5' : 'aug'
    case 'sus2':
    case 'sus4': return (s === 'maj7' ? 'maj7' : s === 'b7' ? '7' : '') + q
  }
}

function romanSuffix(q: Quality, s: Seventh | null): string {
  switch (q) {
    case 'maj': return s === 'maj7' ? 'maj7' : s === 'b7' ? '7' : ''
    case 'min': return s === 'maj7' ? '(maj7)' : s === 'b7' ? '7' : ''
    case 'dim': return s === 'bb7' ? '°7' : s === 'b7' ? 'ø7' : s === 'maj7' ? '°(maj7)' : '°'
    case 'aug': return '+' + (s === 'maj7' ? 'maj7' : s === 'b7' ? '7' : '')
    case 'sus2':
    case 'sus4': return (s === 'maj7' ? 'maj7' : s === 'b7' ? '7' : '') + q
  }
}

function sortExtensions(exts: Extension[]): Extension[] {
  return EXTENSIONS.filter((e) => exts.includes(e))
}

export function resolveSpec(spec: ChordSpec, tonic: Tonic): ResolvedChord {
  const degreeNote = scaleOf(tonic)[spec.degree - 1]
  const rootName = alter(degreeNote, spec.flatRoot ? -1 : 0)
  const exts = sortExtensions(spec.extensions)

  const coreIvls = [...QUALITY_INTERVALS[spec.quality]]
  if (spec.seventh) coreIvls.push(SEVENTH_INTERVAL[spec.seventh])
  const extIvls = exts.map((e) => EXTENSION_INTERVAL[e])

  const addText = exts.map((e) => 'add' + e).join('')
  const upper = spec.quality === 'maj' || spec.quality === 'aug' || spec.quality.startsWith('sus')
  const numeral = ROMAN[spec.degree - 1]

  const noteNames = [...coreIvls, ...extIvls].map((i) => Note.transpose(rootName, i))
  const rootPc = Note.chroma(rootName) ?? 0

  let bassName: string | null = null
  if (spec.bass?.kind === 'chordTone') bassName = spec.bass.index < coreIvls.length ? noteNames[spec.bass.index] : null
  else if (spec.bass?.kind === 'degree') bassName = bassDegreeName(tonic, spec.bass.degree, spec.bass.accidental)
  const bassPc = bassName === null ? null : (Note.chroma(bassName) ?? 0)
  const slash = bassPc !== null && bassPc !== rootPc

  let romanText = (spec.flatRoot ? '♭' : '') + (upper ? numeral : numeral.toLowerCase()) + romanSuffix(spec.quality, spec.seventh)
  if (slash) {
    // Figured bass when the bass is a chord tone of a triad/7th chord, otherwise the bass scale degree: IV/(♭7)
    const toneIndex = coreIvls.findIndex((_, i) => (Note.chroma(noteNames[i]) ?? -1) === bassPc)
    const figure = spec.quality.startsWith('sus') ? undefined : (spec.seventh ? SEVENTH_FIGURES : TRIAD_FIGURES)[toneIndex]
    if (figure) romanText = spec.seventh ? romanText.replace(/7(?!.*7)/, figure) : romanText + figure
    else
      romanText +=
        spec.bass?.kind === 'degree'
          ? `/(${accidentalText(spec.bass.accidental)}${spec.bass.degree})`
          : `/(${degreeLabel(tonic, bassPc)})`
  }

  return {
    symbol: rootName + chordSuffix(spec.quality, spec.seventh) + addText + (slash ? '/' + bassName : ''),
    roman: romanText + addText,
    rootName,
    rootPc,
    core: coreIvls.map((i) => Interval.semitones(i) ?? 0),
    extensions: extIvls.map((i) => Interval.semitones(i) ?? 0),
    noteNames,
    bassName: slash ? bassName : null,
    bassPc: slash ? bassPc : null,
  }
}

/** Parse an absolute chord symbol like "G7b9" or "F#m7b5". Returns null if tonal can't read it. */
export function resolveSymbol(symbol: string): ResolvedChord | null {
  // Parse the slash bass ourselves: tonal rotates slash chords, which would put the root up an octave
  const [head, bassPart, ...rest] = symbol.trim().split('/')
  if (rest.length) return null
  const c = Chord.get(head)
  if (c.empty || !c.tonic) return null
  const bass = bassPart === undefined ? null : Note.pitchClass(bassPart)
  if (bass === '') return null
  const rootPc = Note.chroma(c.tonic) ?? 0
  const bassPc = bass === null ? null : (Note.chroma(bass) ?? null)
  const slash = bassPc !== null && bassPc !== rootPc
  const semis = c.intervals.map((i) => Interval.semitones(i) ?? 0)
  return {
    symbol: c.symbol + (slash ? '/' + bass : ''),
    roman: null,
    rootName: c.tonic,
    rootPc,
    core: semis.filter((s) => s < 12),
    extensions: semis.filter((s) => s >= 12),
    noteNames: c.notes,
    bassName: slash ? bass : null,
    bassPc: slash ? bassPc : null,
  }
}

export function midiToName(midi: number): string {
  return Note.fromMidi(midi)
}
