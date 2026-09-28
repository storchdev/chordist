import type { Voicing } from '../music/voicing'

/** One hit in a looping pattern. Steps are 16th notes. */
export interface PatternEvent {
  step: number
  notes: number[]
  /** Length in steps */
  dur: number
  vel: number
  /** Seconds between notes; negative strums high → low (a guitar upstroke) */
  strum?: number
}

export type Pattern =
  /** Sounds once and holds while the key is down */
  | { id: string; label: string; kind: 'hold'; strum: number }
  /** Loops at the tempo while the key is down */
  | { id: string; label: string; kind: 'loop'; steps: number; build: (v: Voicing) => PatternEvent[] }

const all = (v: Voicing) => (v.bass === null ? v.upper : [v.bass, ...v.upper])
/** A bass note even when the bass toggle is off, for patterns built around one */
const low = (v: Voicing) => v.bass ?? v.upper[0] - 12
const bassHits = (v: Voicing, steps: number[], dur: number): PatternEvent[] =>
  v.bass === null ? [] : steps.map((step) => ({ step, notes: [v.bass!], dur, vel: 0.8 }))

function arp(order: (seq: number[]) => number[]) {
  return (v: Voicing): PatternEvent[] => {
    const seq = order([...v.upper, v.upper[0] + 12])
    return [
      ...bassHits(v, [0, 8], 8),
      ...Array.from({ length: 16 }, (_, i) => ({ step: i, notes: [seq[i % seq.length]], dur: 1, vel: i % 4 === 0 ? 0.85 : 0.6 })),
    ]
  }
}

export const PATTERNS: Pattern[] = [
  { id: 'block', label: 'Block', kind: 'hold', strum: 0 },
  { id: 'strumDown', label: 'Strum ↓', kind: 'hold', strum: 0.035 },
  { id: 'strumUp', label: 'Strum ↑', kind: 'hold', strum: -0.035 },
  { id: 'harp', label: 'Harp roll', kind: 'hold', strum: 0.1 },
  { id: 'arpUp', label: 'Arp ↑', kind: 'loop', steps: 16, build: arp((s) => s) },
  { id: 'arpDown', label: 'Arp ↓', kind: 'loop', steps: 16, build: arp((s) => [...s].reverse()) },
  { id: 'arpUpDown', label: 'Arp ↑↓', kind: 'loop', steps: 16, build: arp((s) => [...s, ...s.slice(1, -1).reverse()]) },
  {
    id: 'alberti',
    label: 'Alberti',
    kind: 'loop',
    steps: 8,
    build: (v) => {
      const u = v.upper
      const [lo, mid, hi] = [u[0], u[Math.floor(u.length / 2)], u[u.length - 1]]
      return [
        ...bassHits(v, [0], 8),
        ...[lo, hi, mid, hi].map((n, i) => ({ step: i * 2, notes: [n], dur: 2, vel: i === 0 ? 0.8 : 0.6 })),
      ]
    },
  },
  {
    id: 'pulse8',
    label: '8th pulse',
    kind: 'loop',
    steps: 16,
    build: (v) => Array.from({ length: 8 }, (_, i) => ({ step: i * 2, notes: all(v), dur: 1.6, vel: i % 2 === 0 ? 0.85 : 0.55 })),
  },
  {
    id: 'charleston',
    label: 'Charleston',
    kind: 'loop',
    steps: 16,
    build: (v) => [
      { step: 0, notes: all(v), dur: 5, vel: 0.9 },
      { step: 6, notes: all(v), dur: 3, vel: 0.75 },
    ],
  },
  {
    id: 'guitar',
    label: 'Guitar D-DU-UDU',
    kind: 'loop',
    steps: 16,
    build: (v) => {
      const down = (step: number, dur: number): PatternEvent => ({ step, notes: all(v), dur, vel: 0.85, strum: 0.012 })
      const up = (step: number, dur: number): PatternEvent => ({ step, notes: v.upper, dur, vel: 0.55, strum: -0.012 })
      return [down(0, 4), down(4, 2), up(6, 4), up(10, 2), down(12, 2), up(14, 2)]
    },
  },
  {
    id: 'skank',
    label: 'Reggae skank',
    kind: 'loop',
    steps: 16,
    build: (v) => [
      { step: 0, notes: [low(v)], dur: 6, vel: 0.8 },
      { step: 4, notes: v.upper, dur: 1, vel: 0.8 },
      { step: 12, notes: v.upper, dur: 1, vel: 0.8 },
    ],
  },
  {
    id: 'oompah',
    label: 'Oom-pah',
    kind: 'loop',
    steps: 16,
    build: (v) => {
      const b = low(v)
      const fifthBelow = b - 5 >= 28 ? b - 5 : b + 7
      return [
        { step: 0, notes: [b], dur: 4, vel: 0.85 },
        { step: 4, notes: v.upper, dur: 3, vel: 0.6 },
        { step: 8, notes: [fifthBelow], dur: 4, vel: 0.8 },
        { step: 12, notes: v.upper, dur: 3, vel: 0.6 },
      ]
    },
  },
  {
    id: 'waltz',
    label: 'Waltz 3/4',
    kind: 'loop',
    steps: 12,
    build: (v) => [
      { step: 0, notes: [low(v)], dur: 4, vel: 0.85 },
      { step: 4, notes: v.upper, dur: 3, vel: 0.6 },
      { step: 8, notes: v.upper, dur: 3, vel: 0.55 },
    ],
  },
  {
    id: 'tresillo',
    label: 'Tresillo 3-3-2',
    kind: 'loop',
    steps: 16,
    build: (v) => [
      { step: 0, notes: all(v), dur: 5, vel: 0.9 },
      { step: 6, notes: all(v), dur: 5, vel: 0.75 },
      { step: 12, notes: all(v), dur: 3, vel: 0.8 },
    ],
  },
]

export function patternById(id: string): Pattern {
  return PATTERNS.find((p) => p.id === id) ?? PATTERNS[0]
}
