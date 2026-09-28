import { useEffect, useState } from 'react'
import type { InstrumentName } from '../audio/engine'
import type { ChordSpec, Tonic } from '../music/theory'
import type { VoiceCount } from '../music/voicing'

export type BindingTarget = { kind: 'relative'; spec: ChordSpec } | { kind: 'absolute'; symbol: string }

export interface Binding {
  id: string
  code: string
  shift: boolean
  alt: boolean
  target: BindingTarget
}

export type SyncMode = 'off' | '1/16' | '1/8' | '1/4' | 'bar'
export const SYNC_MODES: SyncMode[] = ['off', '1/16', '1/8', '1/4', 'bar']

export interface Settings {
  tonic: Tonic
  octave: number
  instrument: InstrumentName
  volume: number
  voiceLeading: boolean
  /** Upper notes per chord (bass not counted) */
  voices: VoiceCount
  /** Octaves between the bass note and the chord */
  bassGap: number
  bass: boolean
  /** Whether the chromatic bass keys make a sound on their own (otherwise they only set a chord's bass) */
  bassKeysSound: boolean
  /** Rhythm/strum pattern id (see audio/patterns.ts) */
  pattern: string
  bpm: number
  /** Snap chord changes in a running loop to this grid */
  sync: SyncMode
  bindings: Binding[]
}

export const DEFAULT_SETTINGS: Settings = {
  tonic: 'C',
  octave: 4,
  instrument: 'piano',
  volume: -6,
  voiceLeading: true,
  voices: 'auto',
  bassGap: 2,
  bass: true,
  bassKeysSound: false,
  pattern: 'block',
  bpm: 100,
  sync: '1/8',
  bindings: [],
}

const KEY = 'chordist:settings:v1'

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      // storage full or blocked; settings just won't persist
    }
  }, [settings])
  return [settings, setSettings] as const
}
