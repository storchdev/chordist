import { useEffect, useState } from 'react'
import { engine } from '../audio/engine'

const LOW = 36 // C2
const HIGH = 96 // C7
const BLACK = new Set([1, 3, 6, 8, 10])

export function Piano() {
  const [sounding, setSounding] = useState<Set<number>>(new Set())
  useEffect(() => engine.subscribe(() => setSounding(engine.sounding())), [])

  const whites: number[] = []
  for (let m = LOW; m <= HIGH; m++) if (!BLACK.has(m % 12)) whites.push(m)
  const w = 100 / whites.length

  return (
    <div className="relative h-36 w-full select-none overflow-hidden rounded-xl border border-white/10 shadow-[0_0_40px_rgba(177,75,255,0.35)]">
      {whites.map((m, i) => {
        const on = sounding.has(m)
        return (
          <div
            key={m}
            className="absolute top-0 h-full border-r border-black/40 transition-all duration-75"
            style={{
              left: `${i * w}%`,
              width: `${w}%`,
              background: on ? 'linear-gradient(to bottom, #ff4ecd, #00f0ff)' : 'linear-gradient(to bottom, #f5f3ff, #d6d0ea)',
              boxShadow: on ? '0 0 24px #ff4ecd, inset 0 -8px 16px rgba(255,255,255,0.6)' : undefined,
            }}
          >
            {m % 12 === 0 && <span className="absolute bottom-1 w-full text-center text-[10px] text-black/40">C{m / 12 - 1}</span>}
          </div>
        )
      })}
      {Array.from({ length: HIGH - LOW + 1 }, (_, k) => LOW + k)
        .filter((m) => BLACK.has(m % 12))
        .map((m) => {
          const whiteIndex = whites.findIndex((x) => x > m)
          const on = sounding.has(m)
          return (
            <div
              key={m}
              className="absolute top-0 z-10 h-[60%] rounded-b-md transition-all duration-75"
              style={{
                left: `${whiteIndex * w - w * 0.3}%`,
                width: `${w * 0.6}%`,
                background: on ? 'linear-gradient(to bottom, #ffe600, #ff4ecd)' : 'linear-gradient(to bottom, #1a1025, #000)',
                boxShadow: on ? '0 0 20px #ffe600' : undefined,
              }}
            />
          )
        })}
    </div>
  )
}
