import type { ResolvedChord } from './theory'

export interface Voicing {
  bass: number | null
  upper: number[]
}

export interface VoicingOptions {
  /** Octave the root of the upper structure sits in (4 => C4 = 60) */
  octave: number
  bass: boolean
  voiceLeading: boolean
  /** Previous upper voicing, used for voice leading */
  prev: number[] | null
  /** Previous bass note, used for voice leading the bass line */
  prevBass: number | null
  /** How many upper notes to play (bass not counted); 'auto' = every chord tone once */
  voices: VoiceCount
  /** Octaves between the bass and the chord (2 = C2 under C4) */
  bassGap: number
}

export type VoiceCount = 'auto' | 1 | 2 | 3 | 4 | 5
export const VOICE_COUNTS: VoiceCount[] = ['auto', 1, 2, 3, 4, 5]
export const BASS_GAPS = [1, 2, 3]

/** Lowest bass note (C1); anything below is raised by octaves */
const BASS_FLOOR = 24
const aboveFloor = (n: number) => (n < BASS_FLOOR ? n + 12 * Math.ceil((BASS_FLOOR - n) / 12) : n)

type Role = 'root' | 'third' | 'fifth' | 'seventh'
/** A core chord tone's role, from its semitones above the root (sus2/sus4 count as the 3rd) */
function role(s: number): Role {
  if (s === 0) return 'root'
  if (s <= 5) return 'third'
  if (s <= 8) return 'fifth'
  return 'seventh'
}

/**
 * Pick which chord tones to play for a voice count. Fewer notes drops the least defining
 * tones first: the 5th, then the root when the bass already plays it, then extensions from
 * the top. More notes returns how many doublings to stack on top (see `voiceChord`).
 */
function chooseTones(chord: ResolvedChord, voices: VoiceCount, bassIsRoot: boolean) {
  const total = chord.core.length + chord.extensions.length
  if (voices === 'auto' || voices === total) return { core: chord.core, extensions: chord.extensions, doublings: 0 }
  if (voices > total) return { core: chord.core, extensions: chord.extensions, doublings: voices - total }
  const of = (r: Role) => chord.core.filter((s) => role(s) === r)
  const priority = [
    ...(bassIsRoot ? [] : of('root')),
    ...of('third'),
    ...of('seventh'),
    ...chord.extensions,
    ...(bassIsRoot ? of('root') : []),
    ...of('fifth'),
  ]
  const keep = new Set(priority.slice(0, voices))
  return { core: chord.core.filter((s) => keep.has(s)), extensions: chord.extensions.filter((s) => keep.has(s)), doublings: 0 }
}

/**
 * Place a bass pitch class in `bassOctave` (the chord octave minus the bass gap). With voice leading,
 * pick the octave closest to the previous bass so lines like C → B → A step down instead of jumping.
 */
export function placeBass(pc: number, bassOctave: number, voiceLeading: boolean, prevBass: number | null): number {
  const anchor = 12 * (bassOctave + 1)
  let n = anchor + pc
  if (voiceLeading && prevBass !== null) {
    const lo = anchor - 5
    const hi = anchor + 14
    const candidates = [n - 12, n, n + 12].filter((c) => c >= lo && c <= hi)
    n = candidates.reduce((best, c) => (Math.abs(c - prevBass) < Math.abs(best - prevBass) ? c : best), candidates[0] ?? n)
  }
  return aboveFloor(n)
}

/**
 * Fixed pitch for the piano-row bass keys: the tonic sits in the bass octave and the row
 * climbs chromatically from it, so the keys never wrap down mid-scale (in B: A = B2 … J = A#3).
 */
export function pianoRowBass(tonicPc: number, bassPc: number, bassOctave: number): number {
  const tonic = aboveFloor(12 * (bassOctave + 1) + tonicPc)
  return tonic + ((bassPc - tonicPc + 12) % 12)
}

/**
 * Voice leading stays inside a window around the octave setting, with a gentle pull back
 * toward its center. Without this, "move as little as possible" ratchets steadily upward
 * (or downward) over progressions like the circle of fifths.
 */
const WINDOW_BELOW = 5 // lowest core note may sit this far below the octave's C (G3 at octave 4)
const WINDOW_ABOVE = 7 // ...or this far above it (G4)
const CENTER_OFFSET = 7 // target average pitch: G above the octave's C
const GRAVITY = 0.35 // per note, per semitone off-center

function closeVoicing(pcs: number[], lowest: number): number[] {
  const out: number[] = []
  let floor = lowest
  for (const pc of pcs) {
    let n = floor - (((floor - pc) % 12) + 12) % 12
    if (n < floor) n += 12
    out.push(n)
    floor = n + 1
  }
  return out
}

function distance(a: number[], b: number[]): number {
  if (a.length === b.length) return a.reduce((sum, n, i) => sum + Math.abs(n - b[i]), 0)
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  return Math.abs(avg(a) - avg(b)) * a.length
}

export function voiceChord(chord: ResolvedChord, opts: VoicingOptions): Voicing {
  const base = chord.rootPc + 12 * (opts.octave + 1)
  const hasBass = opts.bass || chord.bassPc !== null
  const tones = chooseTones(chord, opts.voices, hasBass && (chord.bassPc ?? chord.rootPc) === chord.rootPc)
  // With every core tone dropped (e.g. 1 voice on a chord with extensions), the kept extension stands in as the core
  const coreSemis = tones.core.length ? tones.core : tones.extensions.map((s) => s % 12)
  const extSemis = tones.core.length ? tones.extensions : []
  const corePcs = coreSemis.map((s) => (chord.rootPc + s) % 12)

  let core: number[]
  if (opts.voiceLeading && opts.prev && opts.prev.length) {
    const home = 12 * (opts.octave + 1)
    const center = home + CENTER_OFFSET
    const prevCore = opts.prev.slice(0, corePcs.length)
    const avg = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length
    let best: number[] | null = null
    let bestScore = Infinity
    // Every inversion, at every octave whose lowest note lands in the window
    for (let inv = 0; inv < corePcs.length; inv++) {
      const rotated = [...corePcs.slice(inv), ...corePcs.slice(0, inv)]
      for (let cand = closeVoicing(rotated, home - WINDOW_BELOW); cand[0] <= home + WINDOW_ABOVE; cand = cand.map((n) => n + 12)) {
        const score = distance(cand, prevCore) + GRAVITY * cand.length * Math.abs(avg(cand) - center)
        if (score < bestScore) {
          bestScore = score
          best = cand
        }
      }
    }
    core = best ?? coreSemis.map((s) => base + s)
  } else {
    core = coreSemis.map((s) => base + s)
  }

  // Extensions stack above the top of the core voicing
  const top = Math.max(...core)
  const extensions = extSemis.map((s) => {
    const pc = (chord.rootPc + s) % 12
    let n = top + 1 + ((((pc - (top + 1)) % 12) + 12) % 12)
    if (n - top < 2 && s >= 13) n += 12 // keep 9ths from smashing into the 7th/root when possible
    return n
  })

  // Doublings continue the close-position stack: each is the nearest core chord tone above the
  // current top, so extra notes never leave a gap wider than the chord's own spacing
  const upper = [...core, ...extensions]
  for (let i = 0; i < tones.doublings; i++) {
    const high = Math.max(...upper)
    upper.push(Math.min(...corePcs.map((pc) => high + 1 + ((((pc - (high + 1)) % 12) + 12) % 12))))
  }

  return {
    // An explicit slash bass always sounds, even with the bass toggle off
    bass: hasBass ? placeBass(chord.bassPc ?? chord.rootPc, opts.octave - opts.bassGap, opts.voiceLeading, opts.prevBass) : null,
    upper: upper.sort((a, b) => a - b),
  }
}
