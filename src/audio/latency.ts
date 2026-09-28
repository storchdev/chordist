import * as Tone from 'tone'
import { engine } from './engine'

/**
 * Debug: log how long it takes from a key press to its sound reaching the speakers.
 * On in dev; in a build, run `localStorage.setItem('chordist:debug-latency', '1')` and reload.
 */
const enabled = (() => {
  if (import.meta.env.DEV) return true
  try {
    return localStorage.getItem('chordist:debug-latency') === '1'
  } catch {
    return false
  }
})()

export interface LatencyProbe {
  /** Mark the time spent waiting for the audio context to start (first press only) */
  audioStarted(): void
  /** Report the audio-clock time the key's first note was scheduled at */
  sounded(audioTime: number, how: string): void
}

const noop: LatencyProbe = { audioStarted() {}, sounded() {} }

/** When a sound scheduled at `audioTime` (Tone/AudioContext clock) reaches the speakers, in performance.now() ms */
function speakerTime(audioTime: number) {
  const ctx = Tone.getContext().rawContext as AudioContext
  const ts = ctx.getOutputTimestamp?.()
  // contextTime is what's leaving the speakers at performanceTime, so this includes the device's output latency
  if (ts?.performanceTime && ts.contextTime !== undefined) return ts.performanceTime + (audioTime - ts.contextTime) * 1000
  const out = (ctx.outputLatency ?? 0) + (ctx.baseLatency ?? 0)
  return performance.now() + (audioTime - ctx.currentTime + out) * 1000
}

const ms = (x: number) => `${x.toFixed(1)}ms`

export function probeLatency(e: KeyboardEvent): LatencyProbe {
  if (!enabled) return noop
  const pressed = e.timeStamp
  const handled = performance.now()
  let startup = 0
  let done = false
  return {
    audioStarted() {
      startup = performance.now() - handled
    },
    sounded(audioTime, how) {
      if (done) return
      done = true
      const ctx = Tone.getContext()
      const raw = ctx.rawContext as AudioContext
      const total = speakerTime(audioTime) - pressed
      const input = handled - pressed
      const lookAhead = ctx.lookAhead * 1000
      const device = ((raw.outputLatency ?? 0) + (raw.baseLatency ?? 0)) * 1000
      const other = total - input - startup - lookAhead - device
      console.log(
        `%c[latency] ${e.code} → ${ms(total)}`,
        'color:#00f0ff;font-weight:bold',
        `| input ${ms(input)}`,
        startup > 1 ? `| audio init ${ms(startup)}` : '',
        `| Tone lookAhead ${ms(lookAhead)}`,
        `| device output ${ms(device)}`,
        `| other ${ms(other)} (${how})`,
        engine.isPianoLoaded ? '' : '| piano not loaded (synth fallback)',
      )
    },
  }
}
