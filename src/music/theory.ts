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
 * A chord described relative to the current key. This is what the keyboard
 * produces and what relative custom bindings store, so they transpose with the tonic.
 */
export interface ChordSpec {
  degree: Degree
  flatRoot: boolean
  quality: Quality
  seventh: Seventh | null
  extensions: Extension[]
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
  const flat = flatten(degreeNote)
  // Avoid double flats (bIV in Db would be Gbb) by respelling enharmonically
  const rootName = !spec.flatRoot ? degreeNote : flat.endsWith('bb') ? Note.simplify(flat) : flat
  const exts = sortExtensions(spec.extensions)

  const coreIvls = [...QUALITY_INTERVALS[spec.quality]]
  if (spec.seventh) coreIvls.push(SEVENTH_INTERVAL[spec.seventh])
  const extIvls = exts.map((e) => EXTENSION_INTERVAL[e])

  const addText = exts.map((e) => 'add' + e).join('')
  const upper = spec.quality === 'maj' || spec.quality === 'aug' || spec.quality.startsWith('sus')
  const numeral = ROMAN[spec.degree - 1]

  return {
    symbol: rootName + chordSuffix(spec.quality, spec.seventh) + addText,
    roman: (spec.flatRoot ? '♭' : '') + (upper ? numeral : numeral.toLowerCase()) + romanSuffix(spec.quality, spec.seventh) + addText,
    rootName,
    rootPc: Note.chroma(rootName) ?? 0,
    core: coreIvls.map((i) => Interval.semitones(i) ?? 0),
    extensions: extIvls.map((i) => Interval.semitones(i) ?? 0),
    noteNames: [...coreIvls, ...extIvls].map((i) => Note.transpose(rootName, i)),
  }
}

/** Parse an absolute chord symbol like "G7b9" or "F#m7b5". Returns null if tonal can't read it. */
export function resolveSymbol(symbol: string): ResolvedChord | null {
  const c = Chord.get(symbol.trim())
  if (c.empty || !c.tonic) return null
  const semis = c.intervals.map((i) => Interval.semitones(i) ?? 0)
  return {
    symbol: c.symbol,
    roman: null,
    rootName: c.tonic,
    rootPc: Note.chroma(c.tonic) ?? 0,
    core: semis.filter((s) => s < 12),
    extensions: semis.filter((s) => s >= 12),
    noteNames: c.notes,
  }
}

export function midiToName(midi: number): string {
  return Note.fromMidi(midi)
}
