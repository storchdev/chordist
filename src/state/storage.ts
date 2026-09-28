import { useEffect, useState } from 'react'
import type { InstrumentName } from '../audio/engine'
import type { ChordSpec, Tonic } from '../music/theory'

export type BindingTarget = { kind: 'relative'; spec: ChordSpec } | { kind: 'absolute'; symbol: string }

export interface Binding {
  id: string
  code: string
  shift: boolean
  alt: boolean
  target: BindingTarget
}

export interface Settings {
  tonic: Tonic
  octave: number
  instrument: InstrumentName
  volume: number
  voiceLeading: boolean
  bass: boolean
  bindings: Binding[]
}

export const DEFAULT_SETTINGS: Settings = {
  tonic: 'C',
  octave: 4,
  instrument: 'piano',
  volume: -6,
  voiceLeading: true,
  bass: true,
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
