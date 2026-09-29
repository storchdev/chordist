import { Chord, ChordType as TonalChordType, Interval, Key, Note } from 'tonal'

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
/** A chord shape without a root (from a symbol like "m7b5" or intervals like "1 b3 b5 b7") */
export interface ChordType {
  /** Symbol suffix, e.g. "m7b5" ('' for a major triad) */
  name: string
  /** Tonal interval names from the root, ascending, e.g. ["1P", "3m", "5d", "7m"] */
  intervals: string[]
  /** The chord's own bass: the first interval as written ("5 1 3" → 5P). Missing → the lowest interval */
  bass?: string
}

export interface ChordSpec {
  degree: Degree
  flatRoot: boolean
  quality: Quality
  seventh: Seventh | null
  extensions: Extension[]
  /** Overrides quality + seventh with a custom shape (held chord-type bind) */
  chordType?: ChordType | null
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
  /** The slash bass comes from the chord type itself, so like the root it only sounds with the bass toggle on */
  bassOptional?: boolean
  /** Interval-list type on its own bass: while the bass sounds, the upper voices don't repeat it */
  soleBass?: boolean
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

/** Roman-numeral suffixes for common chord types; others use the symbol name */
const TYPE_ROMAN: Record<string, string> = { '': '', m: '', m7: '7', m7b5: 'ø7', dim: '°', dim7: '°7', aug: '+', maj7: 'maj7', '7': '7' }

/** Core (within the octave) and extension intervals of a chord type */
export function splitChordType(t: ChordType): { core: string[]; ext: string[] } {
  const semis = (i: string) => Interval.semitones(i) ?? 0
  return { core: t.intervals.filter((i) => semis(i) < 12), ext: t.intervals.filter((i) => semis(i) >= 12) }
}

function sortExtensions(exts: Extension[]): Extension[] {
  return EXTENSIONS.filter((e) => exts.includes(e))
}

export function resolveSpec(spec: ChordSpec, tonic: Tonic): ResolvedChord {
  const degreeNote = scaleOf(tonic)[spec.degree - 1]
  const rootName = alter(degreeNote, spec.flatRoot ? -1 : 0)
  const exts = sortExtensions(spec.extensions)

  const type = spec.chordType ?? null
  const typeParts = type ? splitChordType(type) : null
  const coreIvls = typeParts ? [...typeParts.core] : [...QUALITY_INTERVALS[spec.quality]]
  if (!type && spec.seventh) coreIvls.push(SEVENTH_INTERVAL[spec.seventh])
  const extIvls = [...(typeParts?.ext ?? []), ...exts.map((e) => EXTENSION_INTERVAL[e]).filter((i) => !typeParts?.ext.includes(i))]

  const addText = exts.map((e) => 'add' + e).join('')
  const upper = type
    ? !coreIvls.includes('3m') || coreIvls.includes('3M')
    : spec.quality === 'maj' || spec.quality === 'aug' || spec.quality.startsWith('sus')
  const numeral = ROMAN[spec.degree - 1]

  // Custom types on a ♭ root can land on double flats (Gbm7b5 → Bbb); keep them readable
  const noteNames = [...coreIvls, ...extIvls]
    .map((i) => Note.transpose(rootName, i))
    .map((n) => (type && /bb|##/.test(n) ? Note.simplify(n) : n))
  const rootPc = Note.chroma(rootName) ?? 0

  let bassName: string | null = null
  if (spec.bass?.kind === 'chordTone') bassName = spec.bass.index < coreIvls.length ? noteNames[spec.bass.index] : null
  else if (spec.bass?.kind === 'degree') bassName = bassDegreeName(tonic, spec.bass.degree, spec.bass.accidental)
  // Without an explicit bass, a chord type's first interval is its bass (the root for "1 3 5", the 3rd for "3 5 7")
  const typeBass = !spec.bass && type ? (type.bass ?? type.intervals[0]) : undefined
  if (typeBass && typeBass !== '1P') bassName = noteNames[[...coreIvls, ...extIvls].indexOf(typeBass)] ?? Note.transpose(rootName, typeBass)
  const bassPc = bassName === null ? null : (Note.chroma(bassName) ?? 0)
  const slash = bassPc !== null && bassPc !== rootPc

  const typeSuffix = type ? (TYPE_ROMAN[type.name] ?? (!upper && /^m(?!aj)/.test(type.name) ? type.name.slice(1) : type.name)) : ''
  let romanText =
    (spec.flatRoot ? '♭' : '') + (upper ? numeral : numeral.toLowerCase()) + (type ? typeSuffix : romanSuffix(spec.quality, spec.seventh))
  if (slash) {
    // Figured bass when the bass is a chord tone of a triad/7th chord, otherwise the bass scale degree: IV/(♭7)
    const toneIndex = coreIvls.findIndex((_, i) => (Note.chroma(noteNames[i]) ?? -1) === bassPc)
    const hasSeventh = type ? coreIvls.length === 4 : !!spec.seventh
    const figurable = type
      ? (coreIvls.includes('3m') || coreIvls.includes('3M')) && (coreIvls.length === 3 || (hasSeventh && romanText.includes('7')))
      : !spec.quality.startsWith('sus')
    const figure = figurable ? (hasSeventh ? SEVENTH_FIGURES : TRIAD_FIGURES)[toneIndex] : undefined
    if (figure) romanText = hasSeventh ? romanText.replace(/7(?!.*7)/, figure) : romanText + figure
    else
      romanText +=
        spec.bass?.kind === 'degree'
          ? `/(${accidentalText(spec.bass.accidental)}${spec.bass.degree})`
          : `/(${degreeLabel(tonic, bassPc)})`
  }

  return {
    symbol: rootName + (type ? type.name : chordSuffix(spec.quality, spec.seventh)) + addText + (slash ? '/' + bassName : ''),
    roman: romanText + addText,
    rootName,
    rootPc,
    core: coreIvls.map((i) => Interval.semitones(i) ?? 0),
    extensions: extIvls.map((i) => Interval.semitones(i) ?? 0),
    noteNames,
    bassName: slash ? bassName : null,
    bassPc: slash ? bassPc : null,
    bassOptional: slash && !spec.bass,
    soleBass: !!type?.bass && !spec.bass,
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

/** Spellings tonal doesn't know, mapped to ones it does */
const TYPE_ALIASES: [RegExp, string][] = [
  [/ø7$/, 'ø'],
  [/dim7b5$/, 'm7b5'],
  [/half-?dim(inished)?7?$/i, 'm7b5'],
  [/Δ7?/, 'maj7'],
]
/** Scale-degree numbers → notes above C4, for parsing "1 b3 b5 b7" */
const DEGREE_NOTES: Record<number, string> = {
  1: 'C4', 2: 'D4', 3: 'E4', 4: 'F4', 5: 'G4', 6: 'A4', 7: 'B4', 8: 'C5', 9: 'D5', 10: 'E5', 11: 'F5', 12: 'G5', 13: 'A5',
}

function degreeInterval(token: string): string | null {
  const m = /^([b#]*)(\d+)$/.exec(token)
  const base = m && DEGREE_NOTES[Number(m[2])]
  if (!m || !base) return null
  const ivl = Interval.distance('C4', base[0] + m[1] + base.slice(1))
  return ivl || null
}

/** Canonical name for a set of intervals, if tonal knows the chord */
function typeName(intervals: string[]): string | null {
  const t = TonalChordType.all().find((c) => c.intervals.join() === intervals.join())
  if (!t) return null
  return t.aliases[0] === 'M' ? '' : t.aliases[0]
}

/**
 * Parse a chord type, ignoring any root: a symbol ("Cm7b5", "m7b5", "ø7", "7b9") or 2+ intervals
 * as scale degrees ("1 b3 b5 b7"), semitones including 0 ("0 3 6 10") or tonal names ("1P 3m 5d 7m").
 */
export function parseChordType(text: string): ChordType | null {
  const tokens = text.trim().split(/[\s,]+/).filter(Boolean)
  if (!tokens.length) return null
  if (tokens.length > 1) {
    let ivls: (string | null)[]
    if (tokens.every((t) => /^\d+$/.test(t)) && tokens.includes('0')) ivls = tokens.map((t) => Interval.fromSemitones(Number(t)) || null)
    else if (tokens.every((t) => /^[b#]*\d+$/.test(t))) ivls = tokens.map(degreeInterval)
    else ivls = tokens.map((t) => (Interval.get(t).empty ? null : Interval.get(t).name))
    if (ivls.some((i) => i === null)) return null
    const sorted = [...new Set(ivls as string[])].sort((a, b) => (Interval.semitones(a) ?? 0) - (Interval.semitones(b) ?? 0))
    return { name: typeName(sorted) ?? `(${tokens.join(' ')})`, intervals: sorted, bass: ivls[0]! }
  }
  let symbol = tokens[0]
  for (const [re, to] of TYPE_ALIASES) symbol = symbol.replace(re, to)
  const c = Chord.get(symbol)
  if (c.empty) return null
  return { name: typeName(c.intervals) ?? symbol.slice(c.tonic?.length ?? 0), intervals: c.intervals }
}

/**
 * Move a chord symbol written in key `from` to key `to` (root and slash bass move by the
 * interval between the tonics, the chord type is kept). Unparseable symbols come back unchanged.
 */
export function transposeSymbol(symbol: string, from: Tonic, to: Tonic): string {
  if (from === to) return symbol
  const [head, bassPart] = symbol.trim().split('/')
  const [root, type] = Chord.tokenize(head)
  if (!root) return symbol
  const ivl = Interval.distance(from, to)
  const move = (n: string) => {
    const t = Note.transpose(n, ivl)
    // Tonic intervals like F# → Db are odd (diminished 4th); respell the results nobody writes
    return /(bb|##)$|^(Cb|Fb|E#|B#)$/.test(t) ? Note.simplify(t) : t
  }
  return move(root) + type + (bassPart ? '/' + move(Note.pitchClass(bassPart)) : '')
}

export function midiToName(midi: number): string {
  return Note.fromMidi(midi)
}
