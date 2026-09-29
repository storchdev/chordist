import { useEffect, useState } from 'react'
import type { Tonic } from '../music/theory'
import { midiToName } from '../music/theory'

/** One chord as it was played */
export interface RecordedChord {
  /** ms since the recording started */
  t: number
  symbol: string
  roman: string | null
  /** Key the chord was played in (the tonic can change mid-recording) */
  tonic: Tonic
  /** Sounding MIDI notes, bass first */
  notes: number[]
}

export interface Recording {
  id: string
  name: string
  /** Epoch ms */
  createdAt: number
  /** Length in ms, from start to stop */
  duration: number
  chords: RecordedChord[]
}

const KEY = 'chordist:recordings:v1'

function load(): Recording[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Recording[]
  } catch {
    return []
  }
}

export function useRecordings() {
  const [recordings, setRecordings] = useState<Recording[]>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(recordings))
    } catch {
      // storage full or blocked; recordings just won't persist
    }
  }, [recordings])
  return [recordings, setRecordings] as const
}

/** m:ss.cc */
export function formatTime(ms: number): string {
  const s = ms / 1000
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`
}

/**
 * Plain-text export: a header, one timed line per chord (with key changes called out),
 * then the bare progression on one line for pasting into a chart.
 */
export function recordingText(rec: Recording): string {
  const date = new Date(rec.createdAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const when = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  const keys = [...new Set(rec.chords.map((c) => c.tonic))]
  const symbolWidth = Math.max(6, ...rec.chords.map((c) => c.symbol.length))
  const romanWidth = Math.max(4, ...rec.chords.map((c) => (c.roman ?? '').length))

  const lines = [
    `${rec.name}`,
    `recorded ${when} · key of ${keys.join(' → ')} · ${rec.chords.length} chords · ${formatTime(rec.duration)}`,
    '',
  ]
  let tonic: Tonic | null = null
  for (const c of rec.chords) {
    if (c.tonic !== tonic) {
      if (tonic !== null) lines.push('')
      lines.push(`[key: ${c.tonic} major]`)
      tonic = c.tonic
    }
    lines.push(
      `${formatTime(c.t).padStart(8)}  ${c.symbol.padEnd(symbolWidth)}  ${(c.roman ?? '').padEnd(romanWidth)}  ${c.notes.map(midiToName).join(' ')}`.trimEnd(),
    )
  }
  lines.push('', `progression: ${rec.chords.map((c) => c.symbol).join(' | ')}`)
  return lines.join('\n') + '\n'
}
