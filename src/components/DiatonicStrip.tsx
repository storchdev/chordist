import { buildSpec } from '../input/spec'
import { resolveSpec, type Degree, type Tonic } from '../music/theory'
import type { PlayedChord } from '../input/useChordKeyboard'

const DEGREES: Degree[] = [1, 2, 3, 4, 5, 6, 7]

/** Live preview of what each number key will play with the modifiers currently held */
export function DiatonicStrip({ tonic, held, shift, last }: { tonic: Tonic; held: ReadonlySet<string>; shift: boolean; last: PlayedChord | null }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {DEGREES.map((d) => {
        const chord = resolveSpec(buildSpec(d, held, shift), tonic)
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
