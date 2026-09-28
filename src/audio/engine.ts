import * as Tone from 'tone'

export type InstrumentName = 'piano' | 'neon' | 'pad'
export const INSTRUMENTS: { id: InstrumentName; label: string }[] = [
  { id: 'piano', label: '🎹 Grand' },
  { id: 'neon', label: '⚡ Neon Saw' },
  { id: 'pad', label: '🌌 Space Pad' },
]

type Voice = Tone.Sampler | Tone.PolySynth

const freq = (m: number) => Tone.Frequency(m, 'midi').toFrequency()

function salamanderUrls(): Record<string, string> {
  const urls: Record<string, string> = { A0: 'A0.mp3', C8: 'C8.mp3' }
  for (let o = 1; o <= 7; o++) {
    urls[`C${o}`] = `C${o}.mp3`
    urls[`D#${o}`] = `Ds${o}.mp3`
    urls[`F#${o}`] = `Fs${o}.mp3`
    urls[`A${o}`] = `A${o}.mp3`
  }
  return urls
}

/**
 * Owns all Tone.js objects. Notes are reference counted so overlapping chords
 * that share a note don't cut each other off, and the sustain pedal defers releases.
 */
class Engine {
  private starting: Promise<void> | null = null
  private output: Tone.Volume | null = null
  private voices = new Map<InstrumentName, Voice>()
  private pianoLoaded = false
  private current: InstrumentName = 'piano'
  private counts = new Map<number, number>()
  private sustained = new Set<number>()
  private sustain = false
  private attackAt = new Map<number, number>()
  /**
   * Which voice each note was started on. Releases must go to that same voice: right after a
   * refresh notes start on the synth fallback, and if the piano finishes loading before the key
   * is released, releasing on the piano instead would leave the synth note stuck forever.
   */
  private attackVoice = new Map<number, Voice>()
  private flashing = new Map<number, number>()
  private listeners = new Set<() => void>()
  private volumeDb = -6

  /** Must first be called from a user gesture (key press) */
  start(): Promise<void> {
    this.starting ??= this.init()
    return this.starting
  }

  private async init() {
    // Tone schedules everything this far ahead by default (0.1s) for steady timelines. A live
    // instrument wants "now"; the sequencer keeps its own short lookahead for pattern timing.
    Tone.getContext().lookAhead = 0
    await Tone.start()
    const reverb = new Tone.Reverb({ decay: 3.5, wet: 0.25 })
    const limiter = new Tone.Limiter(-1).toDestination()
    this.output = new Tone.Volume(this.volumeDb)
    this.output.chain(reverb, limiter)

    const piano = new Tone.Sampler({
      urls: salamanderUrls(),
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
      release: 1.2,
      onload: () => {
        this.pianoLoaded = true
        this.emit()
      },
    }).connect(this.output)

    const neonChorus = new Tone.Chorus(3, 2.5, 0.6).start().connect(this.output)
    const neon = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 30 },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.8 },
      volume: -16,
    }).connect(neonChorus)

    const pad = new Tone.PolySynth(Tone.AMSynth, {
      envelope: { attack: 0.4, decay: 0.5, sustain: 0.8, release: 2.5 },
      volume: -10,
    }).connect(this.output)

    this.voices.set('piano', piano)
    this.voices.set('neon', neon)
    this.voices.set('pad', pad)
  }

  get isPianoLoaded() {
    return this.pianoLoaded
  }

  private voice(): Voice | undefined {
    // Fall back to the neon synth while the piano samples are still downloading
    if (this.current === 'piano' && !this.pianoLoaded) return this.voices.get('neon')
    return this.voices.get(this.current)
  }

  setInstrument(name: InstrumentName) {
    this.panic()
    this.current = name
  }

  setVolume(db: number) {
    this.volumeDb = db
    if (this.output) this.output.volume.value = db
  }

  /**
   * Start held notes, optionally strummed (`strum` seconds between notes, negative = high → low).
   * A release never lands before a note's own attack.
   */
  noteOn(midis: number[], velocity = 0.8, strum = 0) {
    const v = this.voice()
    const now = Tone.now()
    const ordered = strum < 0 ? [...midis].sort((a, b) => b - a) : [...midis].sort((a, b) => a - b)
    ordered.forEach((m, i) => {
      const t = now + Math.abs(strum) * i
      this.counts.set(m, (this.counts.get(m) ?? 0) + 1)
      this.sustained.delete(m)
      this.attackAt.set(m, t)
      this.markAttack(m, v, t)
      v?.triggerAttack(freq(m), t, velocity)
    })
    this.emit()
  }

  noteOff(midis: number[]) {
    const toRelease: number[] = []
    for (const m of midis) {
      const c = (this.counts.get(m) ?? 0) - 1
      if (c > 0) {
        this.counts.set(m, c)
        continue
      }
      this.counts.delete(m)
      if (this.sustain) this.sustained.add(m)
      else toRelease.push(m)
    }
    this.release(toRelease)
    this.emit()
  }

  /**
   * One scheduled pattern hit: attack at `time` (spread by `strum` seconds per note, negative = high→low),
   * release after `dur` seconds. With the sustain pedal down the notes ring until it's lifted.
   * Returns the time of the last attack.
   */
  hit(midis: number[], time: number, dur: number, velocity: number, strum = 0): number {
    const v = this.voice()
    const ordered = strum < 0 ? [...midis].sort((a, b) => b - a) : [...midis].sort((a, b) => a - b)
    let last = time
    ordered.forEach((m, i) => {
      const t = time + Math.abs(strum) * i
      last = t
      this.attackAt.set(m, t)
      this.markAttack(m, v, t)
      v?.triggerAttack(freq(m), t, velocity)
      if (this.sustain) this.sustained.add(m)
      else this.releaseLater(m, t, t + dur)
      this.flash(m, t, dur)
    })
    return last
  }

  /** Release pattern notes at `time`, leaving alone anything still held by a key or the pedal */
  releaseAt(midis: number[], time: number) {
    for (const m of midis) if (!this.counts.has(m) && !this.sustained.has(m)) this.releaseOn(m, time)
  }

  setSustain(on: boolean) {
    this.sustain = on
    if (!on) {
      this.release([...this.sustained].filter((m) => !this.counts.has(m)))
      this.sustained.clear()
      this.emit()
    }
  }

  panic() {
    for (const v of this.voices.values()) v.releaseAll()
    this.counts.clear()
    this.sustained.clear()
    this.flashing.clear()
    this.attackVoice.clear()
    this.emit()
  }

  /** Remember the voice a note started on; if it's still ringing on another voice, stop that copy */
  private markAttack(m: number, v: Voice | undefined, time: number) {
    if (!v) return
    const prev = this.attackVoice.get(m)
    if (prev && prev !== v) prev.triggerRelease(freq(m), time)
    this.attackVoice.set(m, v)
  }

  /** Release a note on the voice it was started on */
  private releaseOn(m: number, time: number) {
    const v = this.attackVoice.get(m) ?? this.voice()
    v?.triggerRelease(freq(m), time)
  }

  private release(midis: number[]) {
    const now = Tone.now()
    for (const m of midis) this.releaseOn(m, Math.max(now, (this.attackAt.get(m) ?? 0) + 0.02))
  }

  /**
   * Release a hit when its gate ends, unless the same note was attacked again since, is held
   * by a key, or is on the pedal. Done with a timer rather than a scheduled release because
   * PolySynth resolves releases late and would cut off a newer attack of the same note.
   */
  private releaseLater(m: number, attackTime: number, releaseTime: number) {
    setTimeout(
      () => {
        if (this.attackAt.get(m) !== attackTime || this.counts.has(m) || this.sustained.has(m)) return
        this.releaseOn(m, Math.max(Tone.now(), releaseTime))
      },
      Math.max(0, (releaseTime - Tone.now()) * 1000 - 20),
    )
  }

  /** Light a note on the piano for the duration of a scheduled hit */
  private flash(m: number, time: number, dur: number) {
    const delay = Math.max(0, (time - Tone.now()) * 1000)
    setTimeout(() => {
      this.flashing.set(m, (this.flashing.get(m) ?? 0) + 1)
      this.emit()
    }, delay)
    setTimeout(() => {
      const c = (this.flashing.get(m) ?? 0) - 1
      if (c > 0) this.flashing.set(m, c)
      else this.flashing.delete(m)
      this.emit()
    }, delay + dur * 1000)
  }

  /** Every MIDI note currently sounding (held, sustained, or a pattern hit) */
  sounding(): Set<number> {
    return new Set([...this.counts.keys(), ...this.sustained, ...this.flashing.keys()])
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }
}

export const engine = new Engine()
