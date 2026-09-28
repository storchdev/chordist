import { useEffect, useState, type MouseEvent } from 'react'
import { engine, INSTRUMENTS } from './audio/engine'
import { BindingsPanel } from './components/BindingsPanel'
import { ChordDisplay } from './components/ChordDisplay'
import { DiatonicStrip } from './components/DiatonicStrip'
import { KeyMap } from './components/KeyMap'
import { Piano } from './components/Piano'
import { useChordKeyboard, type PlayedChord } from './input/useChordKeyboard'
import { TONICS } from './music/theory'
import { useSettings } from './state/storage'

function Toggle({ on, label, hint, onClick }: { on: boolean; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${on ? 'border-lime-300 bg-lime-400/20 text-lime-100' : 'border-white/15 text-white/50'}`}
    >
      {label} <span className="text-[10px] opacity-60">[{hint}]</span>
    </button>
  )
}

export default function App() {
  const [settings, setSettings] = useSettings()
  const [capturing, setCapturing] = useState(false)
  const { held, last, sustain, shift } = useChordKeyboard({ settings, setSettings, suspended: capturing })
  const [history, setHistory] = useState<PlayedChord[]>([])

  useEffect(() => engine.setInstrument(settings.instrument), [settings.instrument])
  useEffect(() => engine.setVolume(settings.volume), [settings.volume])
  useEffect(() => {
    if (last) setHistory((h) => [last, ...h].slice(0, 16))
  }, [last])

  // Buttons keep focus after clicking; drop it so Space/Enter don't re-click them
  const blurAfter = (e: MouseEvent) => (e.target as HTMLElement).closest('button')?.blur()

  return (
    <div className="bg-blobs mx-auto flex max-w-7xl flex-col gap-6 p-6" onClickCapture={(e) => setTimeout(() => blurAfter(e))}>
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="neon-text font-display text-4xl font-black tracking-[0.3em]">CHORDIST</h1>
        <div className="flex flex-wrap gap-1">
          {TONICS.map((t) => (
            <button
              key={t}
              onClick={() => setSettings((p) => ({ ...p, tonic: t }))}
              className={`h-9 min-w-9 rounded-lg px-2 font-display text-sm font-bold transition ${
                settings.tonic === t
                  ? 'bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-black shadow-[0_0_20px_#ff4ecd]'
                  : 'glass text-white/60 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={settings.instrument}
          onChange={(e) => setSettings((p) => ({ ...p, instrument: e.target.value as typeof p.instrument }))}
          className="glass rounded-lg px-3 py-1.5 text-sm outline-none [&>option]:bg-black"
        >
          {INSTRUMENTS.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-white/60">
          vol
          <input
            type="range"
            min={-40}
            max={0}
            value={settings.volume}
            onChange={(e) => setSettings((p) => ({ ...p, volume: Number(e.target.value) }))}
            className="accent-fuchsia-400"
          />
        </label>
        <span className="glass rounded-lg px-3 py-1.5 text-sm">
          octave <b className="font-display">{settings.octave}</b> <span className="text-[10px] opacity-60">[↑↓]</span>
        </span>
        <Toggle on={settings.voiceLeading} label="voice leading" hint="Tab" onClick={() => setSettings((p) => ({ ...p, voiceLeading: !p.voiceLeading }))} />
        <Toggle on={settings.bass} label="bass note" hint="Enter" onClick={() => setSettings((p) => ({ ...p, bass: !p.bass }))} />
        <span
          className={`rounded-lg px-3 py-1.5 font-display text-sm transition ${sustain ? 'bg-violet-500 text-white shadow-[0_0_20px_#b14bff]' : 'glass text-white/40'}`}
        >
          SUSTAIN
        </span>
      </div>

      <ChordDisplay last={last} tonic={settings.tonic} />
      <DiatonicStrip tonic={settings.tonic} held={held} shift={shift} last={last} />
      <Piano />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <KeyMap held={held} shift={shift} sustain={sustain} bindings={settings.bindings} />
          <div className="glass rounded-2xl p-4">
            <h2 className="mb-2 font-display text-sm tracking-widest text-white/50">HISTORY</h2>
            <div className="flex flex-wrap gap-2">
              {history.map((h) => (
                <span key={h.hit} className="rounded-md bg-black/40 px-2 py-1 font-display text-sm">
                  {h.chord.symbol}
                </span>
              ))}
            </div>
          </div>
        </div>
        <BindingsPanel settings={settings} setSettings={setSettings} last={last} setCapturing={setCapturing} />
      </div>
    </div>
  )
}
