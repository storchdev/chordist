# AGENTS.md — Chordist

Single-user, keyboard-driven **chord** instrument in the browser. You play chords, not
single notes. Every chord is relative to a chosen **major** tonic. Looks deliberately
flashy/vibe-coded; that's intended.

## Stack

- Vite + React 19 + TypeScript (strict) + Tailwind v4 (`@tailwindcss/vite`, config lives in `src/index.css` `@theme`)
- `tone` for audio (Salamander piano samples streamed from `tonejs.github.io`; acoustic/nylon/electric guitar samples from
  `nbrosowsky.github.io/tonejs-instruments`, downloaded only when first picked; plus two synths). While an
  instrument's samples load, the neon synth plays instead. Sample file lists in `engine.ts` must match the repo exactly
  or the Sampler never finishes loading.
- `tonal` for note spelling, intervals, key scales, and parsing chord symbols
- Persistence: `localStorage` only (`chordist:settings:v1`). No backend.

## Commands

- `npm run dev` — dev server
- `npm run build` — typecheck (`tsc -b`) + production build. **Run this after every change.**
- `npm run typecheck`

## Verification policy

- Do **not** verify by taking screenshots, driving a headless browser, or curl tricks.
- Verify logic with `npm run build` and, where useful, a throwaway Node script in the scratchpad.
- For anything audible/visual, stop and ask the user to check it manually.

## Layout

```
src/
  music/theory.ts     ChordSpec → ResolvedChord (symbol, roman numeral, spelling, semitones). Tonal lives here.
  music/voicing.ts    ResolvedChord → MIDI notes (bass + upper voices, optional voice leading)
  input/keymap.ts     Physical key layout (KeyboardEvent.code). Single source of truth for key assignments.
  input/spec.ts       held modifier keys + degree + shift → ChordSpec (precedence rules live here)
  input/useChordKeyboard.ts  global keydown/keyup handling, playing/releasing, controls
  audio/engine.ts     Tone.js singleton; ref-counted note on/off, sustain pedal, instruments
  audio/patterns.ts   Rhythm/strum pattern definitions (hold strums + looping 16th-step grids)
  audio/sequencer.ts  Lookahead scheduler that loops one pattern over a voicing
  state/storage.ts    Settings + custom bindings, persisted to localStorage
  components/         Pure-ish UI (display, piano, key map, bindings panel)
```

Data flow: key event → `buildSpec` → `resolveSpec(spec, tonic)` → `voiceChord` → `engine.noteOn`.
Keep music logic out of components and React out of `music/`.

## Key design (current)

Keys are matched by `e.code` (physical position), never `e.key`. Left hand plays degrees,
right hand holds modifiers. A chord is computed at the moment its degree key goes down;
releasing the degree key releases the chord (Space = sustain pedal).

| Key | Meaning |
| --- | --- |
| `1`–`7` (and numpad) | Diatonic triad on that degree: I ii iii IV V vi vii° |
| `Shift` + degree | Flip major ↔ minor. vii° → vii (minor) |
| `` ` `` | ♭ root (♭II, ♭III, ♭VI, ♭VII…); defaults to major |
| `-` / `=` | Diminished / augmented triad |
| `;` / `'` | sus2 / sus4 |
| `[` | "Natural" 7th: maj/aug → maj7, min/dim/sus → ♭7 (so ii → m7, vii° → m7♭5) |
| `]` | Dominant 7: forces a major triad + ♭7 (ii + `]` = II7 = V/V). Explicit `-` `=` `;` `'` still win |
| `\` | Fully diminished 7th (forces dim triad + °7) |
| `I O P` / `K L` / `M ,` | Add ♭9 9 ♯9 / 11 ♯11 / ♭13 13 |
| `8` / `9` / `0` | Inversion: 3rd / 5th / 7th in the bass (held). `0` does nothing without a 7th |
| `A W S E D F T G Y H U J` | One-off bass note, chromatic from the tonic, piano-shaped (`ASDFGHJ` white, `WETYU` black). While held, any chord played uses it as its bass. Silent on its own unless the bass-keys-sound toggle is on. When sounding they use fixed pitches (tonic in the bass octave, climbing to J; no voice leading, no mid-row wrap), and a chord played over one takes that same bass pitch |
| `Q` | Toggle: bass keys sound on their own (persisted, off by default) |
| `Z` / `X` (held) | One-off octave down / up for chords and bass notes. Applied after voice leading and not fed back into it |
| `/` + `1`–`7` | Slash bass layer: silently **latches that scale degree as a pedal** bass under following chords. `` ` `` flattens, `Shift` sharpens. Tap `/` alone (or `Esc`) to clear. `/` + a bass key latches that note too (also silent) |
| `Space` | Sustain pedal |
| `R` / `Shift+R` | Next / previous rhythm pattern |
| `V` / `B` | Tempo −5 / +5 BPM (`Shift`: ±1) |
| `N` | Tap tempo |
| `C` / `Shift+C` | Cycle chord-change sync: off / 1/16 / 1/8 / 1/4 / bar |
| `←` `→` | Tonic around the circle of fifths |
| `↑` `↓` | Octave |
| `Tab` / `Enter` | Toggle voice leading / bass note |
| `Esc` | All notes off |

Quality precedence (low → high): diatonic → Shift → `]` → sus → dim/aug → `\`.
Bass precedence (low → high): latched pedal → inversion key → held one-off bass key (most recent wins). Any slash bass sounds even with the bass toggle off.
Slash chords show figured bass in the roman numeral when the bass is a chord tone (I⁶, V⁴₂),
otherwise the bass scale degree in parens (IV/(♭7)) so it isn't confused with secondary functions.
The bass line is voice-led (nearest octave to the previous bass) when voice leading is on.
Upper voice leading is confined to a window around the octave setting with a pull toward its
center (`voicing.ts` constants), so long progressions don't drift up or down. Keep that invariant.
Symbols use explicit "add" for extensions (`G7addb9`) to match the user's mental model.

### Rhythm patterns

Every chord (including custom binds) plays through the current pattern (`settings.pattern`).
- `hold` patterns (block, strums, harp roll) sound once and hold while the key is down, via ref-counted `noteOn`.
- `loop` patterns are 16th-step grids built from the voicing (`build(v)`), looped by one persistent
  `Sequencer` clock at `settings.bpm`. Steps are absolute; a pattern plays `step % pattern.steps`.
- Sync (`settings.sync`, `C` key): a chord change during a loop (or within a bar of it stopping) snaps to
  the NEXT grid point (1/16, 1/8, 1/4, bar) and keeps the bar position; the old chord keeps looping until then.
  Only a press just after a grid point (≤25% of the grid, max 80 ms) counts as late for it → come in on the
  next free 16th playing the missed point's hit. Never round to "nearest": mid-beat presses would fire instantly.
  Sync off (or clock idle) → restart the pattern at step 0 right away.
- Chord swaps happen inside the clock's tick: release old notes, then attack new ones, same tick. Never run
  two sequencers at once; they'd fight over shared notes. Releasing the key that owns the loop stops it.
- Tone's global `lookAhead` is 0 (set in `engine.init`); its 0.1s default added audible key latency.
  `Tone.now()` is therefore the real audio time, and the sequencer's own lookahead is the only scheduling buffer.
- 30 ms lookahead so a chord change can't be followed by already-queued hits of the old chord.
- Pattern hits release via a guarded timer (`engine.releaseLater`), not a scheduled release, because
  PolySynth resolves releases late and would cut off a newer attack of the same note.
- To add a pattern: append to `PATTERNS` in `audio/patterns.ts`; the UI and `R` cycling pick it up.

### Custom bindings

Any key + optional Shift/Alt can be bound to a chord. Custom bindings are checked **before**
built-ins, so they can shadow them (UI warns). Targets:
- `relative` — a saved `ChordSpec` (from the last played chord); transposes with the tonic.
- `absolute` — a chord symbol parsed by `tonal` (`Chord.get`); fixed pitch.
Held modifiers and the pedal do not affect custom bindings; they play exactly what's saved
(a relative binding saves the bass too, so slash chords can be bound).
Ctrl/Meta combos are never captured so browser shortcuts keep working.

## Conventions

- Latency debug logging (`audio/latency.ts`): each sounding key press logs press → speaker time with a breakdown.
  On in dev; in a build set `localStorage['chordist:debug-latency'] = '1'`. Pass the probe along any new play path.
- `<select>`s are blurred after change (App `onChangeCapture`); focused form fields swallow the chord keys.

- Add new keys in `input/keymap.ts` first, then `spec.ts`/hook, then the `KeyMap.tsx` legend. Keep the AGENTS table in sync.
- Settings shape changes: bump the storage key or merge defaults so old localStorage doesn't break.
- Engine notes are ref-counted: always pair `noteOn`/`noteOff` with the same MIDI list.
- Always release a note on the voice it was attacked on (`attackVoice` / `releaseOn`), never `this.voice()`.
  The active voice changes when the piano finishes loading (synth fallback before that) and on instrument switch.

## Open questions / roadmap (user is still deciding)

- Root-note modifiers beyond ♭root (♯root?)
- Chromatic bass spelling is theory-strict (♭2 of Eb = Fb). Maybe prefer simpler enharmonics.
- Bass keys ate most left-hand letters; free for custom binds: only `.` (plus any Shift/Alt combo). Running low; consider a layer/F-keys for future controls
- Should the pedal persist across reloads? (currently in-memory only)
- Shift on vii°: currently → minor. Maybe major VII is more useful.
- Whether modifiers pressed *while* a chord is held should re-voice it live.
- More extension ergonomics (6/add2/add4 vs 9/11/13, "9 chord" shorthand instead of 7add9).
- Nicer spelling for ♭ degrees in flat keys (♭VI in Db currently spells as A).
- Rhythm: swing; per-pattern accents/humanize; user-defined patterns.
- MIDI output, recording/looping, chord progression presets.
