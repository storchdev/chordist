import * as Tone from 'tone'

export type InstrumentName = 'piano' | 'neon' | 'pad'
export const INSTRUMENTS: { id: InstrumentName; label: string }[] = [
  { id: 'piano', label: '🎹 Grand' },
  { id: 'neon', label: '⚡ Neon Saw' },
  { id: 'pad', label: '🌌 Space Pad' },
]

type Voice = Tone.Sampler | Tone.PolySynth

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
  private listeners = new Set<() => void>()
  private volumeDb = -6

  /** Must first be called from a user gesture (key press) */
  start(): Promise<void> {
    this.starting ??= this.init()
    return this.starting
  }

  private async init() {
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

  noteOn(midis: number[], velocity = 0.8) {
    const v = this.voice()
    for (const m of midis) {
      this.counts.set(m, (this.counts.get(m) ?? 0) + 1)
      this.sustained.delete(m)
    }
    if (v && midis.length) v.triggerAttack(midis.map((m) => Tone.Frequency(m, 'midi').toFrequency()), Tone.now(), velocity)
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

  setSustain(on: boolean) {
    this.sustain = on
    if (!on) {
      this.release([...this.sustained])
      this.sustained.clear()
      this.emit()
    }
  }

  panic() {
    for (const v of this.voices.values()) v.releaseAll()
    this.counts.clear()
    this.sustained.clear()
    this.emit()
  }

  private release(midis: number[]) {
    const v = this.voice()
    if (v && midis.length) v.triggerRelease(midis.map((m) => Tone.Frequency(m, 'midi').toFrequency()), Tone.now())
  }

  /** Every MIDI note currently sounding (held or sustained) */
  sounding(): Set<number> {
    return new Set([...this.counts.keys(), ...this.sustained])
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
