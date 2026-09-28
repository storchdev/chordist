import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { comboLabel, shadowsBuiltin, UNBINDABLE } from '../input/keymap'
import { buildSpec } from '../input/spec'
import { DEGREES, type QualityMap } from '../music/qualities'
import { bindingSymbol } from '../input/useChordKeyboard'
import { parseChordType, resolveSpec, resolveSymbol, transposeSymbol, type ChordType, type Tonic } from '../music/theory'
import type { Binding, BindingTarget, Settings } from '../state/storage'

interface Combo {
  code: string
  shift: boolean
  alt: boolean
}

interface Props {
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  /** Tell the app to stop playing while we capture a key combo */
  setCapturing: (on: boolean) => void
}

/** What each number key plays with this chord type held */
function typePreview(chordType: ChordType, tonic: Tonic, qualities: QualityMap): string {
  return DEGREES.map((d) => resolveSpec(buildSpec(d, new Set(), false, null, qualities, chordType), tonic).symbol).join('  ')
}

function targetLabel(t: BindingTarget, tonic: Tonic): string {
  if (t.kind === 'chordType') return `hold + 1–7: ${t.chordType.name || 'major'}  ·  ${t.chordType.intervals.join(' ')}`
  if (t.kind === 'absolute') {
    const symbol = bindingSymbol(t, tonic)
    return (resolveSymbol(symbol)?.symbol ?? `?? ${symbol}`) + (t.relativeTo ? '  ·  follows key' : '')
  }
  const c = resolveSpec(t.spec, tonic)
  return `${c.roman}  ·  ${c.symbol}`
}

export function BindingsPanel({ settings, setSettings, setCapturing }: Props) {
  const [combo, setCombo] = useState<Combo | null>(null)
  const [listening, setListening] = useState(false)
  const [mode, setMode] = useState<'symbol' | 'type'>('symbol')
  const [symbol, setSymbol] = useState('')
  const [symbolRelative, setSymbolRelative] = useState(true)
  const [typeText, setTypeText] = useState('')

  useEffect(() => {
    setCapturing(listening)
    if (!listening) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (UNBINDABLE.has(e.code)) {
        if (e.code === 'Escape') setListening(false)
        return
      }
      setCombo({ code: e.code, shift: e.shiftKey, alt: e.altKey })
      setListening(false)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [listening, setCapturing])

  const parsed = mode === 'symbol' ? resolveSymbol(symbol) : null
  const parsedType = mode === 'type' ? parseChordType(typeText) : null
  const target: BindingTarget | null =
    mode === 'type'
      ? parsedType
        ? { kind: 'chordType', chordType: parsedType }
        : null
      : parsed
        ? { kind: 'absolute', symbol: parsed.symbol, ...(symbolRelative && { relativeTo: settings.tonic }) }
        : null

  const save = () => {
    if (!combo || !target) return
    const binding: Binding = { id: crypto.randomUUID(), ...combo, target }
    setSettings((p) => ({
      ...p,
      bindings: [...p.bindings.filter((b) => !(b.code === combo.code && b.shift === combo.shift && b.alt === combo.alt)), binding],
    }))
    setCombo(null)
    setSymbol('')
    setTypeText('')
  }

  const remove = (id: string) => setSettings((p) => ({ ...p, bindings: p.bindings.filter((b) => b.id !== id) }))

  return (
    <div className="glass flex flex-col gap-4 rounded-2xl p-4">
      <h2 className="font-display text-lg font-extrabold tracking-widest text-orange-300">CUSTOM BINDS</h2>

      <div className="flex flex-col gap-3 rounded-xl border border-orange-400/30 bg-black/30 p-3">
        <button
          onClick={() => setListening(true)}
          className={`rounded-lg border px-3 py-2 font-display text-sm transition ${
            listening ? 'animate-pulse border-orange-300 bg-orange-500/30' : 'border-white/20 hover:border-orange-300'
          }`}
        >
          {listening ? 'press a key combo… (Esc cancels)' : combo ? comboLabel(combo.code, combo.shift, combo.alt) : '1. click, then press keys'}
        </button>
        {combo && shadowsBuiltin(combo.code, combo.shift, combo.alt) && (
          <div className="text-xs text-yellow-300">⚠ this overrides a built-in key</div>
        )}

        <div className="flex gap-2 text-sm">
          {(['symbol', 'type'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg border px-2 py-1 ${mode === m ? 'border-cyan-300 bg-cyan-400/20' : 'border-white/15 text-white/60'}`}
            >
              {m === 'symbol' ? 'fixed chord' : 'chord type (hold + 1–7)'}
            </button>
          ))}
        </div>

        {mode === 'type' ? (
          <div className="flex flex-col gap-1">
            <input
              value={typeText}
              onChange={(e) => setTypeText(e.target.value)}
              placeholder="m7b5, Cm7b5, ø7, 7b9 or intervals: 1 b3 b5 b7"
              className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm outline-none focus:border-cyan-300"
            />
            <div className="text-xs text-white/50">
              {typeText
                ? parsedType
                  ? `${parsedType.name || 'major'} (${parsedType.intervals.join(' ')}). Hold the key and press 1–7: ${typePreview(parsedType, settings.tonic, settings.qualities)}`
                  : 'not a chord type or interval list I understand'
                : 'root is ignored; hold the key and the number picks the root'}
            </div>
          </div>
        ) : (
          <div>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={
                symbolRelative
                  ? `as if in ${settings.tonic}, e.g. ${['G7b9', 'Dm7b5', 'Fmaj7#11'].map((x) => transposeSymbol(x, 'C', settings.tonic)).join(', ')}`
                  : 'exact chord, e.g. G7b9, F#m7b5, Cmaj7#11'
              }
              className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm outline-none focus:border-cyan-300"
            />
            <div className="mt-2 flex gap-2 text-xs">
              {([true, false] as const).map((rel) => (
                <button
                  key={String(rel)}
                  onClick={() => setSymbolRelative(rel)}
                  className={`flex-1 rounded-md border px-2 py-0.5 ${symbolRelative === rel ? 'border-cyan-300 bg-cyan-400/20' : 'border-white/15 text-white/60'}`}
                >
                  {rel ? `relative (written in ${settings.tonic})` : 'fixed pitch'}
                </button>
              ))}
            </div>
            <div className="mt-1 text-xs text-white/50">
              {symbol
                ? parsed
                  ? `${parsed.symbol}: ${parsed.noteNames.join(' ')}${symbolRelative ? ', transposes when you change key' : ' (fixed pitch)'}`
                  : 'not a chord tonal understands'
                : ''}
            </div>
          </div>
        )}

        <button
          disabled={!combo || !target}
          onClick={save}
          className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-orange-400 px-3 py-2 font-display text-sm font-bold disabled:opacity-30"
        >
          SAVE BIND
        </button>
      </div>

      <ul className="flex flex-col gap-1.5">
        {settings.bindings.length === 0 && <li className="text-sm text-white/40">no binds yet</li>}
        {settings.bindings.map((b) => (
          <li key={b.id} className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-sm">
            <span className="rounded bg-orange-400/20 px-2 py-0.5 font-mono text-orange-200">{comboLabel(b.code, b.shift, b.alt)}</span>
            <span className="flex-1 truncate">{targetLabel(b.target, settings.tonic)}</span>
            <button onClick={() => remove(b.id)} className="text-white/40 hover:text-red-400" aria-label="delete binding">
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
