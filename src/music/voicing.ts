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
}

/**
 * Place a bass pitch class around octave 2 (at the default octave 4). With voice leading,
 * pick the octave closest to the previous bass so lines like C → B → A step down instead of jumping.
 */
export function placeBass(pc: number, octave: number, voiceLeading: boolean, prevBass: number | null): number {
  const anchor = 12 * (octave - 1)
  let n = anchor + pc
  if (voiceLeading && prevBass !== null) {
    const lo = anchor - 5
    const hi = anchor + 14
    const candidates = [n - 12, n, n + 12].filter((c) => c >= lo && c <= hi)
    n = candidates.reduce((best, c) => (Math.abs(c - prevBass) < Math.abs(best - prevBass) ? c : best), candidates[0] ?? n)
  }
  return n < 24 ? n + 12 : n
}

const LOW = 48
const HIGH = 88

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
  const corePcs = chord.core.map((s) => (chord.rootPc + s) % 12)

  let core: number[]
  if (opts.voiceLeading && opts.prev && opts.prev.length) {
    // Try every inversion at a few octave placements, keep the smoothest one
    const prevCore = opts.prev.slice(0, corePcs.length)
    let best: number[] | null = null
    let bestScore = Infinity
    for (let inv = 0; inv < corePcs.length; inv++) {
      const rotated = [...corePcs.slice(inv), ...corePcs.slice(0, inv)]
      for (const start of [prevCore[0] - 7, prevCore[0] - 3, prevCore[0], prevCore[0] + 3]) {
        const cand = closeVoicing(rotated, start)
        if (cand[0] < LOW || cand[cand.length - 1] > HIGH) continue
        const score = distance(cand, prevCore)
        if (score < bestScore) {
          bestScore = score
          best = cand
        }
      }
    }
    core = best ?? chord.core.map((s) => base + s)
  } else {
    core = chord.core.map((s) => base + s)
  }

  // Extensions stack above the top of the core voicing
  const top = Math.max(...core)
  const extensions = chord.extensions.map((s) => {
    const pc = (chord.rootPc + s) % 12
    let n = top + 1 + ((((pc - (top + 1)) % 12) + 12) % 12)
    if (n - top < 2 && s >= 13) n += 12 // keep 9ths from smashing into the 7th/root when possible
    return n
  })

  return {
    // An explicit slash bass always sounds, even with the bass toggle off
    bass: opts.bass || chord.bassPc !== null ? placeBass(chord.bassPc ?? chord.rootPc, opts.octave, opts.voiceLeading, opts.prevBass) : null,
    upper: [...core, ...extensions].sort((a, b) => a - b),
  }
}
