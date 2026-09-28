import type { Dispatch, SetStateAction } from 'react'
import { DEFAULT_QUALITY_MAP, DEGREES, effectiveShiftRows, QUALITIES, type QualityMap, type QualityRow } from '../music/qualities'
import { resolveSpec, type Degree, type Quality } from '../music/theory'
import type { Settings } from '../state/storage'

type RowKey = 'plain' | 'shift' | 'flat' | 'flatShift'

const ROWS: { key: RowKey; label: string; flat: boolean; shift: boolean }[] = [
  { key: 'plain', label: 'default', flat: false, shift: false },
  { key: 'shift', label: 'Shift', flat: false, shift: true },
  { key: 'flat', label: '♭ [`]', flat: true, shift: false },
  { key: 'flatShift', label: '♭ + Shift', flat: true, shift: true },
]

/** Edit what quality each number key plays, plain and with Shift / ♭root */
export function QualityPanel({ settings, setSettings }: { settings: Settings; setSettings: Dispatch<SetStateAction<Settings>> }) {
  const map = settings.qualities
  const rows: Record<RowKey, QualityRow> = { plain: map.plain, flat: map.flat, ...effectiveShiftRows(map) }
  const update = (f: (m: QualityMap) => QualityMap) => setSettings((p) => ({ ...p, qualities: f(p.qualities) }))

  const set = (key: RowKey, degree: Degree, q: Quality) => update((m) => ({ ...m, [key]: { ...m[key], [degree]: q } }))

  const toggleDefaultShift = () =>
    update((m) =>
      // Turning it off starts the Shift rows from what Shift currently does, so nothing changes until edited
      m.useDefaultShift ? { ...m, ...effectiveShiftRows(m), useDefaultShift: false } : { ...m, useDefaultShift: true },
    )

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-sm tracking-widest text-white/50">CHORD QUALITIES</h2>
        <button
          onClick={toggleDefaultShift}
          className={`rounded-lg border px-3 py-1 text-xs transition ${map.useDefaultShift ? 'border-lime-300 bg-lime-400/20 text-lime-100' : 'border-white/15 text-white/50'}`}
          title="Shift flips maj ↔ min (dim/aug/sus → min) and can't be edited"
        >
          use default shift modifiers
        </button>
        <button
          onClick={() => update(() => DEFAULT_QUALITY_MAP)}
          className="ml-auto rounded-lg border border-white/15 px-3 py-1 text-xs text-white/50 hover:text-white"
        >
          reset
        </button>
      </div>

      <div className="grid grid-cols-[5.5rem_repeat(7,minmax(0,1fr))] gap-1.5 text-center">
        <span />
        {DEGREES.map((d) => (
          <span key={d} className="font-display text-xs text-cyan-300">
            {d}
          </span>
        ))}

        {ROWS.map((r) => {
          const locked = r.shift && map.useDefaultShift
          return [
            <span key={r.key} className="self-center text-left text-xs text-white/60">
              {r.label}
            </span>,
            ...DEGREES.map((d) => {
              const quality = rows[r.key][d]
              const chord = resolveSpec({ degree: d, flatRoot: r.flat, quality, seventh: null, extensions: [] }, settings.tonic)
              return (
                <label
                  key={`${r.key}${d}`}
                  className={`flex flex-col items-center rounded-lg border border-white/10 bg-black/30 px-1 py-1 ${locked ? 'opacity-40' : ''}`}
                >
                  <select
                    value={quality}
                    disabled={locked}
                    onChange={(e) => set(r.key, d, e.target.value as Quality)}
                    className="w-full bg-transparent text-center text-xs text-fuchsia-200 outline-none disabled:cursor-not-allowed [&>option]:bg-black"
                  >
                    {QUALITIES.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                  <span className="truncate font-display text-[11px] font-bold">{chord.symbol}</span>
                  <span className="truncate text-[10px] text-white/50">{chord.roman}</span>
                </label>
              )
            }),
          ]
        })}
      </div>
    </div>
  )
}
