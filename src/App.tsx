import { useEffect, useState, type MouseEvent } from 'react'
import { engine, INSTRUMENTS } from './audio/engine'
import { BindingsPanel } from './components/BindingsPanel'
import { ChordDisplay } from './components/ChordDisplay'
import { DiatonicStrip } from './components/DiatonicStrip'
import { KeyMap } from './components/KeyMap'
import { Piano } from './components/Piano'
import { QualityPanel } from './components/QualityPanel'
import { RhythmPanel } from './components/RhythmPanel'
import { useChordKeyboard, type PlayedChord } from './input/useChordKeyboard'
import { accidentalText, bassDegreeName, TONICS } from './music/theory'
import { BASS_GAPS, VOICE_COUNTS, type VoiceCount } from './music/voicing'
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
  const { held, last, sustain, shift, pedal, clearPedal, step, heldType } = useChordKeyboard({ settings, setSettings, suspended: capturing })
  const [history, setHistory] = useState<PlayedChord[]>([])

  useEffect(() => engine.setInstrument(settings.instrument), [settings.instrument])
  useEffect(() => engine.setVolume(settings.volume), [settings.volume])
  useEffect(() => {
    if (last) setHistory((h) => [last, ...h].slice(0, 16))
  }, [last])

  // Buttons keep focus after clicking; drop it so Space/Enter don't re-click them
  const blurAfter = (e: MouseEvent) => (e.target as HTMLElement).closest('button')?.blur()

  return (
    <div className="bg-blobs mx-auto flex max-w-7xl flex-col gap-6 p-6" onClickCapture={(e) => setTimeout(() => blurAfter(e))}
      // Dropdowns keep focus after a pick, which would swallow the chord keys
      onChangeCapture={(e) => e.target instanceof HTMLSelectElement && e.target.blur()}
    >
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
        <RhythmPanel settings={settings} setSettings={setSettings} step={step} />
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
        <label className="glass flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-white/60" title="notes per chord, not counting the bass">
          notes
          <select
            value={String(settings.voices)}
            onChange={(e) => setSettings((p) => ({ ...p, voices: e.target.value === 'auto' ? 'auto' : (Number(e.target.value) as VoiceCount) }))}
            className="bg-transparent font-display font-bold text-cyan-200 outline-none [&>option]:bg-black"
          >
            {VOICE_COUNTS.map((v) => (
              <option key={v} value={String(v)}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="glass flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-white/60" title="octaves between the bass note and the chord">
          bass gap
          <select
            value={settings.bassGap}
            onChange={(e) => setSettings((p) => ({ ...p, bassGap: Number(e.target.value) }))}
            className="bg-transparent font-display font-bold text-cyan-200 outline-none [&>option]:bg-black"
          >
            {BASS_GAPS.map((g) => (
              <option key={g} value={g}>
                {g} oct
              </option>
            ))}
          </select>
        </label>
        <Toggle on={settings.voiceLeading} label="voice leading" hint="Tab" onClick={() => setSettings((p) => ({ ...p, voiceLeading: !p.voiceLeading }))} />
        <Toggle on={settings.bass} label="bass note" hint="Enter" onClick={() => setSettings((p) => ({ ...p, bass: !p.bass }))} />
        <Toggle
          on={settings.bassKeysSound}
          label="bass key solo"
          hint="Q"
          onClick={() => setSettings((p) => ({ ...p, bassKeysSound: !p.bassKeysSound }))}
        />
        <span
          className={`rounded-lg px-3 py-1.5 font-display text-sm transition ${sustain ? 'bg-violet-500 text-white shadow-[0_0_20px_#b14bff]' : 'glass text-white/40'}`}
        >
          SUSTAIN
        </span>
        {pedal?.kind === 'degree' ? (
          <button
            onClick={clearPedal}
            title="click (or tap /) to clear"
            className="rounded-lg bg-orange-500/80 px-3 py-1.5 font-display text-sm text-white shadow-[0_0_20px_#ff7a00]"
          >
            PEDAL /{bassDegreeName(settings.tonic, pedal.degree, pedal.accidental)}{' '}
            <span className="text-[10px] opacity-80">
              ({accidentalText(pedal.accidental)}
              {pedal.degree}) ✕
            </span>
          </button>
        ) : (
          <span className="glass rounded-lg px-3 py-1.5 font-display text-sm text-white/40">
            PEDAL <span className="text-[10px]">[/ + 1–7]</span>
          </span>
        )}
      </div>

      <ChordDisplay last={last} tonic={settings.tonic} />
      <DiatonicStrip tonic={settings.tonic} held={held} shift={shift} pedal={pedal} last={last} qualities={settings.qualities} chordType={heldType} />
      <Piano />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <KeyMap
            tonic={settings.tonic}
            toggles={{ KeyQ: settings.bassKeysSound, Tab: settings.voiceLeading, Enter: settings.bass, Slash: pedal !== null }}
            held={held}
            shift={shift}
            sustain={sustain}
            bindings={settings.bindings}
            qualities={settings.qualities}
          />
          <QualityPanel settings={settings} setSettings={setSettings} />
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
        <BindingsPanel settings={settings} setSettings={setSettings} setCapturing={setCapturing} />
      </div>
    </div>
  )
}
