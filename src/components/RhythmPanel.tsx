import type { Dispatch, SetStateAction } from 'react'
import { patternById, PATTERNS } from '../audio/patterns'
import { clampBpm } from '../input/useChordKeyboard'
import { SYNC_MODES, type Settings, type SyncMode } from '../state/storage'

interface Props {
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  step: { index: number; steps: number } | null
}

/** Compact rhythm controls for the top bar: pattern picker, tempo, step lights */
export function RhythmPanel({ settings, setSettings, step }: Props) {
  const current = patternById(settings.pattern)
  const steps = current.kind === 'loop' ? current.steps : 0
  const bump = (d: number) => setSettings((p) => ({ ...p, bpm: clampBpm(p.bpm + d) }))

  return (
    <div className="glass flex items-center gap-2 rounded-lg px-2 py-1">
      <select
        value={current.id}
        onChange={(e) => setSettings((p) => ({ ...p, pattern: e.target.value }))}
        title="rhythm pattern [R / Shift+R]"
        className="bg-transparent text-sm text-cyan-200 outline-none [&>option]:bg-black"
      >
        {PATTERNS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
            {p.kind === 'loop' ? ' ⟳' : ''}
          </option>
        ))}
      </select>
      <span className="text-[10px] text-white/40">[R]</span>

      <span className="h-4 w-px bg-white/15" />

      <label className="flex items-center gap-1 text-[10px] text-white/40" title="snap chord changes in a loop to this grid [C / Shift+C]">
        sync
        <select
          value={settings.sync}
          onChange={(e) => setSettings((p) => ({ ...p, sync: e.target.value as SyncMode }))}
          className="bg-transparent text-sm text-cyan-200 outline-none [&>option]:bg-black"
        >
          {SYNC_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        [C]
      </label>

      <span className="h-4 w-px bg-white/15" />

      <button onClick={() => bump(-5)} title="tempo −5 [V]" className="px-1 text-white/60 hover:text-white">
        −
      </button>
      <span className="font-display text-sm font-bold text-yellow-200" title="tap tempo [N]">
        {settings.bpm}
        <span className="ml-0.5 text-[9px] font-normal text-white/40">BPM</span>
      </span>
      <button onClick={() => bump(5)} title="tempo +5 [B]" className="px-1 text-white/60 hover:text-white">
        +
      </button>

      {steps > 0 && (
        <span className="flex gap-px">
          {Array.from({ length: steps }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-1 rounded-[1px] ${i % 4 === 0 && i ? 'ml-0.5' : ''} ${
                step?.index === i ? 'bg-cyan-300 shadow-[0_0_6px_#00f0ff]' : i % 4 === 0 ? 'bg-white/30' : 'bg-white/10'
              }`}
            />
          ))}
        </span>
      )}
    </div>
  )
}
