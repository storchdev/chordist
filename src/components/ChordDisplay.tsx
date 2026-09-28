import type { PlayedChord } from '../input/useChordKeyboard'

const HUES = ['#ff4ecd', '#ffe600', '#00f0ff', '#b14bff', '#39ff14', '#ff7a00', '#ff2e63']

export function ChordDisplay({ last, tonic }: { last: PlayedChord | null; tonic: string }) {
  if (!last) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <div className="font-display text-4xl font-black tracking-widest text-white/30">PRESS 1 – 7</div>
        <div className="text-white/40">hold modifiers with your right hand · Shift flips major/minor</div>
      </div>
    )
  }
  const color = HUES[last.chord.rootPc % HUES.length]
  return (
    <div className="relative flex h-64 flex-col items-center justify-center">
      <div
        key={`wave-${last.hit}`}
        className="shockwave pointer-events-none absolute h-48 w-48 rounded-full border-4"
        style={{ borderColor: color, boxShadow: `0 0 60px ${color}` }}
      />
      <div key={last.hit} className="chord-pop flex flex-col items-center">
        <div
          className="font-display text-7xl font-black tracking-wide md:text-8xl"
          style={{ color, textShadow: `0 0 18px ${color}, 0 0 60px ${color}` }}
        >
          {last.chord.symbol}
        </div>
        <div className="mt-2 font-display text-2xl text-white/80">
          {last.chord.roman ?? '—'} <span className="text-base text-white/40">in {tonic} major</span>
        </div>
        <div className="mt-3 flex gap-2">
          {last.chord.noteNames.map((n, i) => (
            <span key={i} className="glass rounded-full px-3 py-1 text-sm font-semibold">
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
