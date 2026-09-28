import { useEffect, useState } from 'react'
import type { InstrumentName } from '../audio/engine'
import type { ChordSpec, ChordType, Tonic } from '../music/theory'
import { DEFAULT_QUALITY_MAP, type QualityMap } from '../music/qualities'
import type { VoiceCount } from '../music/voicing'

export type BindingTarget =
  | { kind: 'relative'; spec: ChordSpec }
  /** A chord symbol. With `relativeTo`, it was written in that key and transposes with the tonic */
  | { kind: 'absolute'; symbol: string; relativeTo?: Tonic }
  /** Held like a modifier: number keys play this chord type on their own root */
  | { kind: 'chordType'; chordType: ChordType }

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
  /** Alt + piano row: jump to the note shown on the key (relative to the tonic) instead of a fixed key (A = C …) */
  relativeModulation: boolean
  /** Rhythm/strum pattern id (see audio/patterns.ts) */
  pattern: string
  bpm: number
  /** Snap chord changes in a running loop to this grid */
  sync: SyncMode
  bindings: Binding[]
  /** Per-degree chord qualities for plain / Shift / ♭root / ♭root+Shift */
  qualities: QualityMap
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
  relativeModulation: false,
  pattern: 'block',
  bpm: 100,
  sync: '1/8',
  bindings: [],
  qualities: DEFAULT_QUALITY_MAP,
}

const KEY = 'chordist:settings:v1'

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const saved = JSON.parse(raw)
    // Nested objects merge too, so settings saved by an older version pick up new fields
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      qualities: { ...DEFAULT_QUALITY_MAP, ...saved.qualities },
      // Drop bind kinds that no longer exist (the short-lived 'modifier' kind)
      bindings: ((saved.bindings ?? []) as Binding[]).filter((b) => ['relative', 'absolute', 'chordType'].includes(b.target.kind)),
    }
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
