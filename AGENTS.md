# AGENTS.md — Chordist

Single-user, keyboard-driven **chord** instrument in the browser. You play chords, not
single notes. Every chord is relative to a chosen **major** tonic. Looks deliberately
flashy/vibe-coded; that's intended.

## Stack

- Vite + React 19 + TypeScript (strict) + Tailwind v4 (`@tailwindcss/vite`, config lives in `src/index.css` `@theme`)
- `tone` for audio (Salamander piano samples streamed from `tonejs.github.io`, plus two synths)
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
| `U I O` / `K L` / `M ,` | Add ♭9 9 ♯9 / 11 ♯11 / ♭13 13. Columns = flat/natural/sharp, rows = 9/11/13 |
| `Space` | Sustain pedal |
| `←` `→` | Tonic around the circle of fifths |
| `↑` `↓` | Octave |
| `Tab` / `Enter` | Toggle voice leading / bass note |
| `Esc` | All notes off |

Quality precedence (low → high): diatonic → Shift → `]` → sus → dim/aug → `\`.
Symbols use explicit "add" for extensions (`G7addb9`) to match the user's mental model.

### Custom bindings

Any key + optional Shift/Alt can be bound to a chord. Custom bindings are checked **before**
built-ins, so they can shadow them (UI warns). Targets:
- `relative` — a saved `ChordSpec` (from the last played chord); transposes with the tonic.
- `absolute` — a chord symbol parsed by `tonal` (`Chord.get`); fixed pitch.
Held modifiers do not affect custom bindings; they play exactly what's saved.
Ctrl/Meta combos are never captured so browser shortcuts keep working.

## Conventions

- Add new keys in `input/keymap.ts` first, then `spec.ts`/hook, then the `KeyMap.tsx` legend. Keep the AGENTS table in sync.
- Settings shape changes: bump the storage key or merge defaults so old localStorage doesn't break.
- Engine notes are ref-counted: always pair `noteOn`/`noteOff` with the same MIDI list.

## Open questions / roadmap (user is still deciding)

- Root-note modifiers beyond ♭root (♯root? slash chords / inversions / chosen bass note?)
- Shift on vii°: currently → minor. Maybe major VII is more useful.
- Whether modifiers pressed *while* a chord is held should re-voice it live.
- More extension ergonomics (6/add2/add4 vs 9/11/13, "9 chord" shorthand instead of 7add9).
- Nicer spelling for ♭ degrees in flat keys (♭VI in Db currently spells as A).
- MIDI output, recording/looping, chord progression presets.
