import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import * as Tone from 'tone'
import { engine } from '../audio/engine'
import { probeLatency, type LatencyProbe } from '../audio/latency'
import { patternById, PATTERNS } from '../audio/patterns'
import { Sequencer } from '../audio/sequencer'
import { Note } from 'tonal'
import { bassDegreeName, resolveSpec, resolveSymbol, TONICS, type BassSpec, type ChordSpec, type ResolvedChord } from '../music/theory'
import { pianoRowBass, voiceChord, type Voicing } from '../music/voicing'
import { SYNC_MODES, type Binding, type Settings, type SyncMode } from '../state/storage'
import { BASS_KEYS, CONTROL_KEYS, DEGREE_KEYS, MODIFIER_CODES, OCTAVE_KEYS, QUALITY_KEYS, SLASH_KEY } from './keymap'
import { buildSpec } from './spec'

export interface PlayedChord {
  chord: ResolvedChord
  /** Present when the chord was relative to the key (so it can be saved as a relative binding) */
  spec: ChordSpec | null
  voicing: Voicing
  /** Increments every hit so the UI can re-trigger animations */
  hit: number
}

interface Options {
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  /** While true (e.g. recording a binding) the keyboard doesn't play */
  suspended: boolean
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

/** Sync grid size in 16th steps; 'bar' is one loop of the pattern */
function syncQuantum(sync: SyncMode, patternSteps: number): number | null {
  return { off: null, '1/16': 1, '1/8': 2, '1/4': 4, bar: patternSteps }[sync]
}

export const clampBpm = (bpm: number) => Math.round(Math.min(240, Math.max(40, bpm)))

function findBinding(bindings: Binding[], e: KeyboardEvent) {
  return bindings.find((b) => b.code === e.code && b.shift === e.shiftKey && b.alt === e.altKey)
}

export function useChordKeyboard({ settings, setSettings, suspended }: Options) {
  const [held, setHeld] = useState<ReadonlySet<string>>(new Set())
  const [last, setLast] = useState<PlayedChord | null>(null)
  const [sustain, setSustain] = useState(false)
  const [shift, setShift] = useState(false)
  /** Latched slash bass (pedal point) applied under every chord until cleared */
  const [pedal, setPedalState] = useState<BassSpec | null>(null)
  const pedalRef = useRef<BassSpec | null>(null)
  /** Current step of the looping pattern, for the UI */
  const [step, setStep] = useState<{ index: number; steps: number } | null>(null)

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const suspendedRef = useRef(suspended)
  suspendedRef.current = suspended

  const heldRef = useRef(new Set<string>())
  const playing = useRef(new Map<string, number[]>())
  const prevUpper = useRef<number[] | null>(null)
  const prevBass = useRef<number | null>(null)
  const hitCount = useRef(0)
  /** One clock loops the current chord's pattern; `loopOwner` is the key whose release stops it */
  const seq = useRef<Sequencer | null>(null)
  const loopOwner = useRef<string | null>(null)
  const taps = useRef<number[]>([])

  useEffect(() => {
    const down = new Set<string>()
    const syncHeld = () => setHeld(new Set(heldRef.current))
    const setPedal = (p: BassSpec | null) => {
      pedalRef.current = p
      setPedalState(p)
    }
    /** True once a degree was pressed during the current `/` hold (so releasing `/` keeps the pedal) */
    let slashUsed = false

    /** Net one-off octave shift from held Z/X */
    const octaveShift = () => {
      let n = 0
      for (const code of heldRef.current) n += OCTAVE_KEYS[code] ?? 0
      return n
    }

    seq.current ??= new Sequencer(() => settingsRef.current.bpm, setStep)
    const sequencer = seq.current

    const stopSeq = () => {
      if (sequencer.running) sequencer.stop()
      loopOwner.current = null
    }

    const play = (code: string, chord: ResolvedChord, spec: ChordSpec | null, probe: LatencyProbe) => {
      const s = settingsRef.current
      let voicing = voiceChord(chord, {
        octave: s.octave,
        bass: s.bass,
        voiceLeading: s.voiceLeading,
        prev: prevUpper.current,
        prevBass: prevBass.current,
      })
      // With solo on, a held bass key is already sounding at its fixed pitch; put the chord's bass on that same note
      let heldBassKey: Extract<BassSpec, { kind: 'degree' }> | undefined
      for (const c of heldRef.current) heldBassKey = BASS_KEYS[c] ?? heldBassKey
      if (s.bassKeysSound && heldBassKey && voicing.bass !== null) voicing = { ...voicing, bass: rowBassMidi(heldBassKey) }

      const shift = octaveShift() * 12
      if (shift) {
        // One-off: transpose after voice leading and don't feed it back, so the next chord leads from where we were
        voicing = { bass: voicing.bass === null ? null : voicing.bass + shift, upper: voicing.upper.map((n) => n + shift) }
      } else {
        prevUpper.current = voicing.upper
        if (voicing.bass !== null) prevBass.current = voicing.bass
      }
      const notes = voicing.bass === null ? voicing.upper : [voicing.bass, ...voicing.upper]
      // A new chord always takes over the loop, even if the previous chord's key is still down
      const pattern = patternById(s.pattern)
      if (pattern.kind === 'loop') {
        const quantum = syncQuantum(s.sync, pattern.steps)
        sequencer.play(pattern, voicing, quantum, (t) => probe.sounded(t, quantum === null ? 'loop' : `loop, includes sync ${s.sync} wait`))
        loopOwner.current = code
      } else {
        stopSeq()
        playing.current.set(code, notes)
        engine.noteOn(notes, 0.8, pattern.strum)
        probe.sounded(Tone.now(), 'held chord')
      }
      setLast({ chord, spec, voicing, hit: ++hitCount.current })
    }

    /** Piano-row bass keys map to fixed pitches (no voice leading) so the row plays like a keyboard */
    const rowBassMidi = (bass: Extract<BassSpec, { kind: 'degree' }>) => {
      const s = settingsRef.current
      const pc = Note.chroma(bassDegreeName(s.tonic, bass.degree, bass.accidental)) ?? 0
      return pianoRowBass(Note.chroma(s.tonic) ?? 0, pc, s.octave)
    }

    /** Sound a bass note on its own (bass keys with the solo toggle on) */
    const playBassNote = (code: string, bass: Extract<BassSpec, { kind: 'degree' }>, probe: LatencyProbe) => {
      let midi = rowBassMidi(bass)
      const shift = octaveShift() * 12
      if (shift) midi += shift
      else prevBass.current = midi
      playing.current.set(code, [midi])
      engine.noteOn([midi])
      probe.sounded(Tone.now(), 'bass note')
    }

    const stop = (code: string) => {
      if (loopOwner.current === code) stopSeq()
      const notes = playing.current.get(code)
      if (!notes) return
      playing.current.delete(code)
      engine.noteOff(notes)
    }

    const onDown = async (e: KeyboardEvent) => {
      setShift(e.shiftKey)
      if (e.ctrlKey || e.metaKey || isTyping(e.target) || suspendedRef.current) return
      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        e.preventDefault() // stop Firefox from focusing the menu bar
        return
      }
      if (e.repeat) {
        e.preventDefault()
        return
      }
      const s = settingsRef.current

      const binding = findBinding(s.bindings, e)
      const degree = DEGREE_KEYS[e.code]
      const bassKey = BASS_KEYS[e.code]
      const isControl = (Object.values(CONTROL_KEYS) as string[]).includes(e.code)
      if (!binding && degree === undefined && !bassKey && !MODIFIER_CODES.has(e.code) && !isControl) return
      e.preventDefault()

      if (bassKey && !binding) {
        const latch = heldRef.current.has(SLASH_KEY)
        if (latch) {
          slashUsed = true
          setPedal(bassKey)
        } else {
          // Held like a modifier so chords played meanwhile use it as their bass
          heldRef.current.add(e.code)
          syncHeld()
        }
        // Setting a pedal is silent; plain bass keys only sound with the toggle on
        if (latch || !s.bassKeysSound) return
        down.add(e.code)
        const probe = probeLatency(e)
        await engine.start()
        probe.audioStarted()
        playBassNote(e.code, bassKey, probe)
        if (!down.has(e.code)) stop(e.code)
        return
      }

      if (MODIFIER_CODES.has(e.code) && !binding) {
        if (e.code === SLASH_KEY) slashUsed = false
        heldRef.current.add(e.code)
        syncHeld()
        return
      }

      if (!binding && degree !== undefined && heldRef.current.has(SLASH_KEY)) {
        slashUsed = true
        const accidental = heldRef.current.has(QUALITY_KEYS.flatRoot) ? -1 : e.shiftKey ? 1 : 0
        setPedal({ kind: 'degree', degree, accidental }) // silent: it's heard under the next chord
        return
      }

      if (binding || degree !== undefined) {
        // Resolve now so the chord reflects the modifiers held at press time
        const spec = binding
          ? binding.target.kind === 'relative' ? binding.target.spec : null
          : buildSpec(degree!, heldRef.current, e.shiftKey, pedalRef.current)
        const chord = spec ? resolveSpec(spec, s.tonic) : resolveSymbol((binding!.target as { symbol: string }).symbol)
        down.add(e.code)
        const probe = probeLatency(e)
        await engine.start() // only actually waits on the very first key press
        probe.audioStarted()
        if (!chord) return
        play(e.code, chord, spec, probe)
        if (!down.has(e.code)) stop(e.code) // released while audio was starting up
        return
      }

      switch (e.code) {
        case CONTROL_KEYS.sustain:
          engine.setSustain(true)
          setSustain(true)
          break
        case CONTROL_KEYS.octaveUp:
          setSettings((p) => ({ ...p, octave: Math.min(6, p.octave + 1) }))
          prevUpper.current = null
          prevBass.current = null
          break
        case CONTROL_KEYS.octaveDown:
          setSettings((p) => ({ ...p, octave: Math.max(2, p.octave - 1) }))
          prevUpper.current = null
          prevBass.current = null
          break
        case CONTROL_KEYS.tonicNext:
        case CONTROL_KEYS.tonicPrev: {
          const dir = e.code === CONTROL_KEYS.tonicNext ? 1 : -1
          setSettings((p) => ({ ...p, tonic: TONICS[(TONICS.indexOf(p.tonic) + dir + TONICS.length) % TONICS.length] }))
          break
        }
        case CONTROL_KEYS.voiceLeading:
          setSettings((p) => ({ ...p, voiceLeading: !p.voiceLeading }))
          prevUpper.current = null
          prevBass.current = null
          break
        case CONTROL_KEYS.bassKeysSound:
          setSettings((p) => ({ ...p, bassKeysSound: !p.bassKeysSound }))
          break
        case CONTROL_KEYS.bass:
          setSettings((p) => ({ ...p, bass: !p.bass }))
          break
        case CONTROL_KEYS.pattern: {
          const dir = e.shiftKey ? -1 : 1
          setSettings((p) => {
            const i = PATTERNS.findIndex((x) => x.id === p.pattern)
            return { ...p, pattern: PATTERNS[(i + dir + PATTERNS.length) % PATTERNS.length].id }
          })
          break
        }
        case CONTROL_KEYS.tempoDown:
        case CONTROL_KEYS.tempoUp: {
          const delta = (e.code === CONTROL_KEYS.tempoUp ? 1 : -1) * (e.shiftKey ? 1 : 5)
          setSettings((p) => ({ ...p, bpm: clampBpm(p.bpm + delta) }))
          break
        }
        case CONTROL_KEYS.tapTempo: {
          const now = performance.now()
          const recent = taps.current.filter((t) => now - t < 2000).slice(-4)
          taps.current = [...recent, now]
          if (recent.length) {
            const avg = (now - recent[0]) / recent.length
            setSettings((p) => ({ ...p, bpm: clampBpm(60000 / avg) }))
          }
          break
        }
        case CONTROL_KEYS.sync: {
          const dir = e.shiftKey ? -1 : 1
          setSettings((p) => ({ ...p, sync: SYNC_MODES[(SYNC_MODES.indexOf(p.sync) + dir + SYNC_MODES.length) % SYNC_MODES.length] }))
          break
        }
        case CONTROL_KEYS.panic:
          stopSeq()
          playing.current.clear()
          engine.panic()
          setPedal(null)
          break
      }
    }

    const onUp = (e: KeyboardEvent) => {
      down.delete(e.code)
      setShift(e.shiftKey)
      if (e.code === SLASH_KEY && heldRef.current.has(SLASH_KEY) && !slashUsed) setPedal(null) // tap `/` = clear pedal
      if (heldRef.current.delete(e.code)) syncHeld()
      stop(e.code)
      if (e.code === CONTROL_KEYS.sustain) {
        engine.setSustain(false)
        setSustain(false)
      }
      if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault()
    }

    const onBlur = () => {
      setShift(false)
      heldRef.current.clear()
      syncHeld()
      stopSeq()
      playing.current.clear()
      engine.setSustain(false)
      setSustain(false)
      engine.panic()
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      stopSeq()
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [setSettings])

  const clearPedal = () => {
    pedalRef.current = null
    setPedalState(null)
  }

  return { held, last, sustain, shift, pedal, clearPedal, step }
}
