import * as Tone from 'tone'
import { engine } from './engine'
import type { Pattern, PatternEvent } from './patterns'
import type { Voicing } from '../music/voicing'

type LoopPattern = Extract<Pattern, { kind: 'loop' }>

/**
 * Only schedule this far ahead. Short, so a chord change can't be followed by a stray
 * hit of the previous chord that was already queued.
 */
const LOOKAHEAD = 0.03
const TICK_MS = 10
/** A press this soon after a grid point counts as late for it rather than early for the next */
const LATE_TOLERANCE_FRACTION = 0.25
const LATE_TOLERANCE_MAX = 0.08
/** Gate a touch shorter than the step so repeated notes re-articulate cleanly */
const GATE = 0.92

interface Loaded {
  pattern: LoopPattern
  byStep: Map<number, PatternEvent[]>
  /** Called once with the audio time of this chord's first step (latency debugging) */
  onStart?: (time: number) => void
}

function load(pattern: LoopPattern, voicing: Voicing, onStart?: (time: number) => void): Loaded {
  const byStep = new Map<number, PatternEvent[]>()
  for (const ev of pattern.build(voicing)) byStep.set(ev.step, [...(byStep.get(ev.step) ?? []), ev])
  return { pattern, byStep, onStart }
}

/**
 * A single running 16th-note clock that loops one chord's pattern at a time.
 *
 * Steps are counted absolutely from when the clock started, and a pattern plays index
 * `step % pattern.steps`, so swapping chords keeps the position in the bar. Chord swaps
 * happen inside the clock at a step boundary: the old chord is released right before the
 * new one attacks, in the same tick, so the two can never fight over a shared note.
 */
export class Sequencer {
  private current: Loaded | null = null
  /** A chord waiting for its grid point */
  private pending: { loaded: Loaded; atStep: number; playIndex: number | null } | null = null
  private used = new Set<number>()
  /** Next unscheduled step (absolute) and its time */
  private step = 0
  private next = 0
  private lastAttack = 0
  /** Earliest time a fresh start may begin, so it lands after the previous loop's queued hits */
  private resumeAfter = 0
  private interval: ReturnType<typeof setInterval> | null = null
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private getBpm: () => number
  private onStep: (step: { index: number; steps: number } | null) => void

  constructor(getBpm: () => number, onStep: (step: { index: number; steps: number } | null) => void) {
    this.getBpm = getBpm
    this.onStep = onStep
  }

  private stepDur() {
    return 60 / this.getBpm() / 4
  }

  get running() {
    return this.interval !== null
  }

  /**
   * Play a chord's loop. `quantum` (in steps) snaps it to the next grid point of the clock that's
   * running, or that stopped less than a bar ago; null restarts the pattern right away.
   */
  play(pattern: LoopPattern, voicing: Voicing, quantum: number | null, onStart?: (time: number) => void) {
    const loaded = load(pattern, voicing, onStart)
    const now = Tone.now()
    const stepDur = this.stepDur()
    const clockAlive = this.running || (this.current !== null && now - this.next < 16 * stepDur)

    if (quantum === null || !clockAlive) {
      if (this.running) {
        // Restart from the top of the pattern at the next unscheduled step
        this.step = 0
        this.pending = { loaded, atStep: 0, playIndex: null }
      } else {
        this.current = loaded
        this.step = 0
        this.next = Math.max(now, this.resumeAfter)
        this.start()
      }
      return
    }

    // Where "now" sits on the grid, in fractional steps. Wait for the next grid point, unless we're
    // only just past one (a slightly late press), in which case that one is the target.
    const position = this.step + (now - this.next) / stepDur
    const previous = Math.floor(position / quantum) * quantum
    const lateBy = (position - previous) * stepDur
    const target = lateBy <= Math.min(LATE_TOLERANCE_FRACTION * quantum * stepDur, LATE_TOLERANCE_MAX) ? previous : previous + quantum

    if (this.running) {
      // Ahead: the old chord keeps going until the target. Behind (pressed a bit late): come in
      // on the next free step but play the target's hit, so a late press still lands the beat.
      this.pending =
        target >= this.step ? { loaded, atStep: target, playIndex: null } : { loaded, atStep: this.step, playIndex: target }
      return
    }

    // Clock stopped recently: resume it on the grid
    this.current = loaded
    const firstFree = Math.ceil(position)
    if (target < position) this.hitStep(target, Math.max(now, this.resumeAfter)) // late: land the target's hit now
    const resumeStep = Math.max(target, firstFree)
    this.next += (resumeStep - this.step) * stepDur
    this.step = resumeStep
    this.start()
  }

  private start() {
    this.tick()
    this.interval ??= setInterval(() => this.tick(), TICK_MS)
  }

  private hitStep(index: number, time: number) {
    if (!this.current) return
    const steps = this.current.pattern.steps
    const stepDur = this.stepDur()
    this.current.onStart?.(time)
    this.current.onStart = undefined
    for (const ev of this.current.byStep.get(index % steps) ?? []) {
      ev.notes.forEach((n) => this.used.add(n))
      this.lastAttack = Math.max(this.lastAttack, engine.hit(ev.notes, time, ev.dur * stepDur * GATE, ev.vel, ev.strum))
    }
    const timer = setTimeout(
      () => {
        this.timers.delete(timer)
        this.onStep({ index: index % steps, steps })
      },
      Math.max(0, (time - Tone.now()) * 1000),
    )
    this.timers.add(timer)
  }

  private tick() {
    while (this.next < Tone.now() + LOOKAHEAD) {
      let index = this.step
      if (this.pending && this.step >= this.pending.atStep) {
        // Swap chords at this boundary: release the old notes just before the new attacks
        engine.releaseAt([...this.used], Math.max(Tone.now(), this.next - 0.005))
        this.used = new Set()
        this.current = this.pending.loaded
        if (this.pending.playIndex !== null) index = this.pending.playIndex
        this.pending = null
      }
      this.hitStep(index, this.next)
      this.step++
      this.next += this.stepDur()
    }
  }

  /** Stop looping and release this loop's notes */
  stop() {
    if (this.interval !== null) clearInterval(this.interval)
    this.interval = null
    for (const t of this.timers) clearTimeout(t)
    this.timers.clear()
    this.pending = null
    this.onStep(null)
    const end = Math.max(Tone.now(), this.lastAttack + 0.01)
    engine.releaseAt([...this.used], end)
    this.used = new Set()
    this.resumeAfter = end + 0.003
  }
}
