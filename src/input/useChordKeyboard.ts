import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { engine } from '../audio/engine'
import { resolveSpec, resolveSymbol, TONICS, type ChordSpec, type ResolvedChord } from '../music/theory'
import { voiceChord, type Voicing } from '../music/voicing'
import type { Binding, Settings } from '../state/storage'
import { CONTROL_KEYS, DEGREE_KEYS, MODIFIER_CODES } from './keymap'
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

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const suspendedRef = useRef(suspended)
  suspendedRef.current = suspended

  const heldRef = useRef(new Set<string>())
  const playing = useRef(new Map<string, number[]>())
  const prevUpper = useRef<number[] | null>(null)
  const hitCount = useRef(0)

  useEffect(() => {
    const down = new Set<string>()
    const syncHeld = () => setHeld(new Set(heldRef.current))

    const play = (code: string, chord: ResolvedChord, spec: ChordSpec | null) => {
      const s = settingsRef.current
      const voicing = voiceChord(chord, {
        octave: s.octave,
        bass: s.bass,
        voiceLeading: s.voiceLeading,
        prev: prevUpper.current,
      })
      prevUpper.current = voicing.upper
      const notes = voicing.bass === null ? voicing.upper : [voicing.bass, ...voicing.upper]
      playing.current.set(code, notes)
      engine.noteOn(notes)
      setLast({ chord, spec, voicing, hit: ++hitCount.current })
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
      const isControl = (Object.values(CONTROL_KEYS) as string[]).includes(e.code)
      if (!binding && degree === undefined && !MODIFIER_CODES.has(e.code) && !isControl) return
      e.preventDefault()

      if (MODIFIER_CODES.has(e.code) && !binding) {
        heldRef.current.add(e.code)
        syncHeld()
        return
      }

      if (binding || degree !== undefined) {
        // Resolve now so the chord reflects the modifiers held at press time
        const spec = binding
          ? binding.target.kind === 'relative' ? binding.target.spec : null
          : buildSpec(degree!, heldRef.current, e.shiftKey)
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
          break
        case CONTROL_KEYS.octaveDown:
          setSettings((p) => ({ ...p, octave: Math.max(2, p.octave - 1) }))
          prevUpper.current = null
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
          break
        case CONTROL_KEYS.bass:
          setSettings((p) => ({ ...p, bass: !p.bass }))
          break
        case CONTROL_KEYS.panic:
          playing.current.clear()
          engine.panic()
          break
      }
    }

    const onUp = (e: KeyboardEvent) => {
      down.delete(e.code)
      setShift(e.shiftKey)
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

  return { held, last, sustain, shift }
}
