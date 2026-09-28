import { QUALITY_KEYS, SLASH_KEY } from '../input/keymap'
import { buildSpec } from '../input/spec'
import { accidentalText, bassDegreeName, resolveSpec, type BassSpec, type Degree, type Tonic } from '../music/theory'
import type { PlayedChord } from '../input/useChordKeyboard'

const DEGREES: Degree[] = [1, 2, 3, 4, 5, 6, 7]

/** Live preview of what each number key will play with the modifiers currently held */
export function DiatonicStrip({
  tonic,
  held,
  shift,
  pedal,
  last,
}: {
  tonic: Tonic
  held: ReadonlySet<string>
  shift: boolean
  pedal: BassSpec | null
  last: PlayedChord | null
}) {
  if (held.has(SLASH_KEY)) {
    // Slash layer: the number keys pick a bass note instead of a chord
    const accidental = held.has(QUALITY_KEYS.flatRoot) ? -1 : shift ? 1 : 0
    return (
      <div className="grid grid-cols-7 gap-2">
        {DEGREES.map((d) => (
          <div key={d} className="glass rounded-xl border-orange-400/60 p-3 text-center shadow-[0_0_20px_rgba(255,122,0,0.35)]">
            <div className="font-display text-xs text-orange-300">/ {d}</div>
            <div className="font-display text-lg font-extrabold">/{bassDegreeName(tonic, d, accidental)}</div>
            <div className="text-sm text-white/60">
              bass {accidentalText(accidental)}
              {d}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {DEGREES.map((d) => {
        const chord = resolveSpec(buildSpec(d, held, shift, pedal), tonic)
        const active = last?.spec?.degree === d
        return (
          <div
            key={d}
            className={`glass rounded-xl p-3 text-center transition-all ${
              active ? 'scale-105 border-fuchsia-400 shadow-[0_0_30px_rgba(255,78,205,0.6)]' : ''
            }`}
          >
            <div className="font-display text-xs text-cyan-300">{d}</div>
            <div className="truncate font-display text-lg font-extrabold">{chord.symbol}</div>
            <div className="truncate text-sm text-white/60">{chord.roman}</div>
          </div>
        )
      })}
    </div>
  )
}
