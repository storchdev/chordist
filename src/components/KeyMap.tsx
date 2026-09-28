import { BASS_KEYS, prettyCode } from '../input/keymap'
import type { QualityMap } from '../music/qualities'
import { bassDegreeName, resolveSpec, type Degree, type Tonic } from '../music/theory'
import type { Binding } from '../state/storage'

type Kind = 'degree' | 'quality' | 'seventh' | 'ext' | 'bass' | 'control' | 'none'

const INFO: Record<string, { label: string; kind: Kind }> = {
  Backquote: { label: '♭root', kind: 'quality' },
  Digit1: { label: 'I', kind: 'degree' },
  Digit2: { label: 'ii', kind: 'degree' },
  Digit3: { label: 'iii', kind: 'degree' },
  Digit4: { label: 'IV', kind: 'degree' },
  Digit5: { label: 'V', kind: 'degree' },
  Digit6: { label: 'vi', kind: 'degree' },
  Digit7: { label: 'vii°', kind: 'degree' },
  Digit8: { label: '/3rd', kind: 'bass' },
  Digit9: { label: '/5th', kind: 'bass' },
  Digit0: { label: '/7th', kind: 'bass' },
  Minus: { label: 'dim', kind: 'quality' },
  Equal: { label: 'aug', kind: 'quality' },
  Tab: { label: 'lead', kind: 'control' },
  KeyQ: { label: 'solo', kind: 'control' },
  KeyZ: { label: '−oct', kind: 'control' },
  KeyX: { label: '+oct', kind: 'control' },
  KeyI: { label: '♭9', kind: 'ext' },
  KeyO: { label: '9', kind: 'ext' },
  KeyP: { label: '♯9', kind: 'ext' },
  BracketLeft: { label: '7', kind: 'seventh' },
  BracketRight: { label: 'dom7', kind: 'seventh' },
  Backslash: { label: '°7', kind: 'seventh' },
  KeyK: { label: '11', kind: 'ext' },
  KeyL: { label: '♯11', kind: 'ext' },
  Semicolon: { label: 'sus2', kind: 'quality' },
  Quote: { label: 'sus4', kind: 'quality' },
  Enter: { label: 'bass', kind: 'control' },
  KeyM: { label: '♭13', kind: 'ext' },
  Comma: { label: '13', kind: 'ext' },
  Slash: { label: 'bass', kind: 'bass' },
  ShiftLeft: { label: 'maj⇄min', kind: 'quality' },
  ShiftRight: { label: 'maj⇄min', kind: 'quality' },
  Space: { label: 'SUSTAIN', kind: 'control' },
}

const ROWS: { code: string; w?: number }[][] = [
  ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'].map((code) => ({ code })),
  [{ code: 'Tab', w: 1.5 }, ...'QWERTYUIOP'.split('').map((c) => ({ code: 'Key' + c })), { code: 'BracketLeft' }, { code: 'BracketRight' }, { code: 'Backslash', w: 1.5 }],
  [{ code: 'CapsLock', w: 1.8 }, ...'ASDFGHJKL'.split('').map((c) => ({ code: 'Key' + c })), { code: 'Semicolon' }, { code: 'Quote' }, { code: 'Enter', w: 2 }],
  [{ code: 'ShiftLeft', w: 2.3 }, ...'ZXCVBNM'.split('').map((c) => ({ code: 'Key' + c })), { code: 'Comma' }, { code: 'Period' }, { code: 'Slash' }, { code: 'ShiftRight', w: 2.5 }],
  [{ code: 'Space', w: 7 }],
]

const KIND_STYLE: Record<Kind, string> = {
  degree: 'border-fuchsia-400/60 text-fuchsia-200',
  quality: 'border-yellow-300/60 text-yellow-100',
  seventh: 'border-cyan-300/60 text-cyan-100',
  ext: 'border-lime-300/60 text-lime-100',
  bass: 'border-orange-400/70 text-orange-100',
  control: 'border-violet-300/60 text-violet-100',
  none: 'border-white/10 text-white/30',
}
const KIND_GLOW: Record<Kind, string> = {
  degree: '#ff4ecd',
  quality: '#ffe600',
  seventh: '#00f0ff',
  ext: '#39ff14',
  bass: '#ff7a00',
  control: '#b14bff',
  none: '#ffffff',
}

/** Roman numeral a number key plays with no modifiers, following the quality table */
function degreeRoman(tonic: Tonic, degree: Degree, qualities: QualityMap) {
  const spec = { degree, flatRoot: false, quality: qualities.plain[degree], seventh: null, extensions: [] }
  return resolveSpec(spec, tonic).roman ?? String(degree)
}

export function KeyMap({
  tonic,
  held,
  shift,
  sustain,
  bindings,
  toggles,
  qualities,
}: {
  tonic: Tonic
  held: ReadonlySet<string>
  shift: boolean
  sustain: boolean
  bindings: Binding[]
  /** Toggle keys (by code) and whether they're currently on */
  toggles: Record<string, boolean>
  qualities: QualityMap
}) {
  const bound = new Set(bindings.map((b) => b.code))
  const isOn = (code: string) =>
    held.has(code) || (shift && code.startsWith('Shift')) || (sustain && code === 'Space') || toggles[code] === true

  return (
    <div className="glass flex flex-col items-center gap-1.5 rounded-2xl p-4">
      {ROWS.map((row, i) => (
        <div key={i} className="flex gap-1.5">
          {row.map(({ code, w = 1 }) => {
            const b = BASS_KEYS[code]
            const degree = /^Digit[1-7]$/.test(code) ? (Number(code.slice(5)) as Degree) : null
            const info =
              degree !== null
                ? { label: degreeRoman(tonic, degree, qualities), kind: 'degree' as const }
                : (INFO[code] ?? (b && { label: bassDegreeName(tonic, b.degree, b.accidental), kind: 'bass' as const }))
            const kind: Kind = info?.kind ?? 'none'
            const on = isOn(code)
            const toggle = toggles[code]
            return (
              <div
                key={code}
                className={`relative flex h-12 flex-col items-center justify-center rounded-lg border bg-black/40 px-1 transition-all duration-75 ${KIND_STYLE[kind]} ${on && toggle === undefined ? 'scale-95' : ''} ${toggle === false ? 'opacity-50' : ''}`}
                style={{
                  width: `${w * 3}rem`,
                  boxShadow: on ? `0 0 20px ${KIND_GLOW[kind]}, inset 0 0 12px ${KIND_GLOW[kind]}` : undefined,
                  background: on ? `${KIND_GLOW[kind]}33` : undefined,
                }}
              >
                <span className="text-[10px] opacity-60">{prettyCode(code).replace('Left', '').replace('Right', '')}</span>
                {info && <span className="text-xs font-bold leading-tight">{info.label}</span>}
                {toggle !== undefined && <span className="text-[9px] font-bold leading-none tracking-wider">{toggle ? 'ON' : 'OFF'}</span>}
                {bound.has(code) && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_#ff7a00]" />}
              </div>
            )
          })}
        </div>
      ))}
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-white/50">
        <span>← → tonic (circle of 5ths)</span>
        <span>Alt + A–J = jump to key (A = C … J = B, or the shown note with relative modulation)</span>
        <span>↑ ↓ octave</span>
        <span className="text-orange-300">A–J piano row = one-off bass (hold under a chord)</span>
        <span>hold Z / X = one-off octave down / up</span>
        <span>/ + 1–7 or bass key = pedal (tap / to clear)</span>
        <span>Esc all notes off</span>
        <span className="text-orange-300">● custom binding</span>
      </div>
    </div>
  )
}
