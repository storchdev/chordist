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
| `I O P` / `K L` / `M ,` | Add ♭9 9 ♯9 / 11 ♯11 / ♭13 13 |
| `8` / `9` / `0` | Inversion: 3rd / 5th / 7th in the bass (held). `0` does nothing without a 7th |
| `A W S E D F T G Y H U J` | One-off bass note, chromatic from the tonic, piano-shaped (`ASDFGHJ` white, `WETYU` black). While held, any chord played uses it as its bass. Silent on its own unless the bass-keys-sound toggle is on |
| `Q` | Toggle: bass keys sound on their own (persisted, off by default) |
| `Z` / `X` (held) | One-off octave down / up for chords and bass notes. Applied after voice leading and not fed back into it |
| `/` + `1`–`7` | Slash bass layer: silently **latches that scale degree as a pedal** bass under following chords. `` ` `` flattens, `Shift` sharpens. Tap `/` alone (or `Esc`) to clear. `/` + a bass key latches that note too (also silent) |
| `Space` | Sustain pedal |
| `←` `→` | Tonic around the circle of fifths |
| `↑` `↓` | Octave |
| `Tab` / `Enter` | Toggle voice leading / bass note |
| `Esc` | All notes off |

Quality precedence (low → high): diatonic → Shift → `]` → sus → dim/aug → `\`.
Bass precedence (low → high): latched pedal → inversion key → held one-off bass key (most recent wins). Any slash bass sounds even with the bass toggle off.
Slash chords show figured bass in the roman numeral when the bass is a chord tone (I⁶, V⁴₂),
otherwise the bass scale degree in parens (IV/(♭7)) so it isn't confused with secondary functions.
The bass line is voice-led (nearest octave to the previous bass) when voice leading is on.
Symbols use explicit "add" for extensions (`G7addb9`) to match the user's mental model.

### Custom bindings

Any key + optional Shift/Alt can be bound to a chord. Custom bindings are checked **before**
built-ins, so they can shadow them (UI warns). Targets:
- `relative` — a saved `ChordSpec` (from the last played chord); transposes with the tonic.
- `absolute` — a chord symbol parsed by `tonal` (`Chord.get`); fixed pitch.
Held modifiers and the pedal do not affect custom bindings; they play exactly what's saved
(a relative binding saves the bass too, so slash chords can be bound).
Ctrl/Meta combos are never captured so browser shortcuts keep working.

## Conventions

- Add new keys in `input/keymap.ts` first, then `spec.ts`/hook, then the `KeyMap.tsx` legend. Keep the AGENTS table in sync.
- Settings shape changes: bump the storage key or merge defaults so old localStorage doesn't break.
- Engine notes are ref-counted: always pair `noteOn`/`noteOff` with the same MIDI list.

## Open questions / roadmap (user is still deciding)

- Root-note modifiers beyond ♭root (♯root?)
- Chromatic bass spelling is theory-strict (♭2 of Eb = Fb). Maybe prefer simpler enharmonics.
- Bass keys ate most left-hand letters; free for custom binds: R C V B N . (plus any Shift/Alt combo)
- Should the pedal persist across reloads? (currently in-memory only)
- Shift on vii°: currently → minor. Maybe major VII is more useful.
- Whether modifiers pressed *while* a chord is held should re-voice it live.
- More extension ergonomics (6/add2/add4 vs 9/11/13, "9 chord" shorthand instead of 7add9).
- Nicer spelling for ♭ degrees in flat keys (♭VI in Db currently spells as A).
- MIDI output, recording/looping, chord progression presets.
