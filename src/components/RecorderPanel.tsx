import { useEffect, useRef, useState } from 'react'
import type { PlayedChord } from '../input/useChordKeyboard'
import type { Tonic } from '../music/theory'
import { formatTime, recordingText, useRecordings, type RecordedChord, type Recording } from '../state/recordings'

/** Records the chords played (symbol, roman numeral, notes, timing), keeps takes in localStorage, exports them as text */
export function RecorderPanel({ last, tonic }: { last: PlayedChord | null; tonic: Tonic }) {
  const [recordings, setRecordings] = useRecordings()
  const [take, setTake] = useState<{ start: number; chords: RecordedChord[] } | null>(null)
  const [now, setNow] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)
  const seenHit = useRef(last?.hit ?? 0)

  // Append each new chord hit while recording
  useEffect(() => {
    if (!last || last.hit === seenHit.current) return
    seenHit.current = last.hit
    const v = last.voicing
    const chord: RecordedChord = {
      t: 0,
      symbol: last.chord.symbol,
      roman: last.chord.roman,
      tonic,
      notes: v.bass === null ? v.upper : [v.bass, ...v.upper],
    }
    setTake((tk) => (tk ? { ...tk, chords: [...tk.chords, { ...chord, t: performance.now() - tk.start }] } : tk))
  }, [last, tonic])

  // Tick the elapsed-time readout
  useEffect(() => {
    if (!take) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [take])

  const start = () => {
    setNow(performance.now())
    setTake({ start: performance.now(), chords: [] })
  }

  const stop = () => {
    if (!take) return
    setTake(null)
    if (!take.chords.length) return // nothing played; don't keep an empty take
    const createdAt = Date.now()
    const rec: Recording = {
      id: crypto.randomUUID(),
      name: `take ${recordings.length + 1}`,
      createdAt,
      duration: performance.now() - take.start,
      chords: take.chords,
    }
    setRecordings((rs) => [rec, ...rs])
  }

  const rename = (id: string, name: string) => setRecordings((rs) => rs.map((r) => (r.id === id ? { ...r, name } : r)))
  const remove = (id: string) => setRecordings((rs) => rs.filter((r) => r.id !== id))

  const copy = async (rec: Recording) => {
    await navigator.clipboard.writeText(recordingText(rec))
    setCopied(rec.id)
    setTimeout(() => setCopied((c) => (c === rec.id ? null : c)), 1200)
  }

  const download = (rec: Recording) => {
    const url = URL.createObjectURL(new Blob([recordingText(rec)], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${rec.name.trim().replace(/[^\w.-]+/g, '-') || 'recording'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-sm tracking-widest text-white/50">RECORDINGS</h2>
        <button
          onClick={take ? stop : start}
          className={`flex items-center gap-2 rounded-lg px-3 py-1 font-display text-sm transition ${
            take ? 'bg-red-500 text-white shadow-[0_0_20px_#ff3b5c]' : 'border border-red-400/50 text-red-300 hover:bg-red-500/20'
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full bg-current ${take ? 'animate-pulse' : ''}`} />
          {take ? `stop · ${formatTime(now - take.start)} · ${take.chords.length} chords` : 'record'}
        </button>
      </div>

      {take && take.chords.length > 0 && (
        <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
          {take.chords.map((c, i) => (
            <span key={i} className="rounded-md bg-red-500/15 px-2 py-0.5 font-display text-xs text-red-100">
              {c.symbol}
            </span>
          ))}
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {recordings.length === 0 && !take && <li className="text-sm text-white/40">no recordings yet</li>}
        {recordings.map((r) => (
          <li key={r.id} className="flex flex-col gap-1 rounded-lg bg-black/30 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={r.name}
                onChange={(e) => rename(r.id, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="min-w-24 flex-1 rounded bg-transparent px-1 font-display outline-none focus:bg-black/50"
                aria-label="recording name"
              />
              <span className="text-xs text-white/40">
                {r.chords.length} chords · {formatTime(r.duration)}
              </span>
              <button onClick={() => copy(r)} className="rounded border border-white/15 px-2 py-0.5 text-xs text-white/60 hover:text-white">
                {copied === r.id ? 'copied!' : 'copy text'}
              </button>
              <button onClick={() => download(r)} className="rounded border border-white/15 px-2 py-0.5 text-xs text-white/60 hover:text-white">
                .txt
              </button>
              <button onClick={() => remove(r.id)} className="text-white/40 hover:text-red-400" aria-label="delete recording">
                ✕
              </button>
            </div>
            <div className="max-h-20 overflow-y-auto break-words text-xs text-white/50">{r.chords.map((c) => c.symbol).join(' · ')}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
