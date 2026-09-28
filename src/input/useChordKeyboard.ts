import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { engine } from '../audio/engine'
import { Note } from 'tonal'
import { bassDegreeName, resolveSpec, resolveSymbol, TONICS, type BassSpec, type ChordSpec, type ResolvedChord } from '../music/theory'
import { pianoRowBass, voiceChord, type Voicing } from '../music/voicing'
import type { Binding, Settings } from '../state/storage'
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

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const suspendedRef = useRef(suspended)
  suspendedRef.current = suspended

  const heldRef = useRef(new Set<string>())
  const playing = useRef(new Map<string, number[]>())
  const prevUpper = useRef<number[] | null>(null)
  const prevBass = useRef<number | null>(null)
  const hitCount = useRef(0)

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

    const play = (code: string, chord: ResolvedChord, spec: ChordSpec | null) => {
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
      playing.current.set(code, notes)
      engine.noteOn(notes)
      setLast({ chord, spec, voicing, hit: ++hitCount.current })
    }

    /** Piano-row bass keys map to fixed pitches (no voice leading) so the row plays like a keyboard */
    const rowBassMidi = (bass: Extract<BassSpec, { kind: 'degree' }>) => {
      const s = settingsRef.current
      const pc = Note.chroma(bassDegreeName(s.tonic, bass.degree, bass.accidental)) ?? 0
      return pianoRowBass(Note.chroma(s.tonic) ?? 0, pc, s.octave)
    }

    /** Sound a bass note on its own (bass keys with the solo toggle on) */
    const playBassNote = (code: string, bass: Extract<BassSpec, { kind: 'degree' }>) => {
      let midi = rowBassMidi(bass)
      const shift = octaveShift() * 12
      if (shift) midi += shift
      else prevBass.current = midi
      playing.current.set(code, [midi])
      engine.noteOn([midi])
    }

    const stop = (code: string) => {
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
        await engine.start()
        playBassNote(e.code, bassKey)
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
        await engine.start() // only actually waits on the very first key press
        if (!chord) return
        play(e.code, chord, spec)
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
        case CONTROL_KEYS.panic:
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
      playing.current.clear()
      engine.setSustain(false)
      setSustain(false)
      engine.panic()
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [setSettings])

  const clearPedal = () => {
    pedalRef.current = null
    setPedalState(null)
  }

  return { held, last, sustain, shift, pedal, clearPedal }
}
