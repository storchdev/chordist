# 🎹✨ CHORDIST ✨🎸

> **play CHORDS not notes.** your QWERTY keyboard is now a chord machine 🤯🔥

### 👉 [**PLAY IT NOW → storchdev.github.io/chordist**](https://storchdev.github.io/chordist/) 👈

No install. No MIDI keyboard. No music theory degree (ok maybe a little). Just vibes 🌈🎶

---

## 🚀 wtf is this

Chordist is a **keyboard-only chord instrument** that runs in your browser 🌐. Pick a key, smash `1`–`7`,
and boom 💥 you're playing I ii iii IV V vi vii° like a jazz wizard 🧙‍♂️. Every chord is **relative to the tonic**,
so change key with the arrow keys and your fingers don't move. Ever. 🙌

## 🎛️ features (there are a LOT)

- 🔢 **Number keys = diatonic chords.** `1` is I, `5` is V, you get it
- ⬆️ **Shift flips major ↔ minor** (and you can remap every degree in the quality table 🧪)
- 🎭 **Modifier keys** for sus2 / sus4 / dim / aug / maj7 / dom7 / °7 held with your right hand
- 🌶️ **Extensions**: ♭9 9 ♯9 11 ♯11 ♭13 13, just hold and play
- 🔄 **Inversions** on `8` `9` `0` → figured bass shows up like a real theory nerd (V⁶₅ 🤓)
- 🎸 **Bass keys** on the home row, piano-shaped, for slash chords and pedal points
- 🧲 **Voice leading** that doesn't drift into the stratosphere 🛸
- 🥁 **Rhythm patterns**: strums, harp rolls, looping 16th grids with quantized chord changes
- 🎹 **Instruments**: Salamander grand piano 🎹, acoustic / nylon / electric guitar 🎸, and two neon synths 🌈
- 🔧 **Custom binds**:
  - 🎯 **fixed chord**: bind any key to `G7b9`, `F#m7b5`, whatever. Can follow the key too
  - 🧬 **chord type**: bind `R` to `m7b5` (or `1 b3 b5 b7`), hold it, hit `1`–`7` → half-diminished on every degree 😈
- 🎚️ Notes per chord (1–5), bass gap, sustain pedal, tap… you name it
- 💾 Everything saves to `localStorage`. No accounts, no backend, no tracking 🔒

## ⌨️ cheat sheet

| 🔑 key | ✨ does |
| --- | --- |
| `1`–`7` | play chord on that degree 🎵 |
| `Shift` + degree | major ↔ minor 🔁 |
| `` ` `` | ♭ root (♭VII, ♭VI, ♭III…) 🎷 |
| `-` / `=` | dim / aug 😱 |
| `;` / `'` | sus2 / sus4 ☁️ |
| `[` / `]` / `\` | natural 7th / dom7 / °7 🌶️ |
| `I O P` `K L` `M ,` | ♭9 9 ♯9 · 11 ♯11 · ♭13 13 🧂 |
| `8` `9` `0` | inversions 🙃 |
| `A W S E D F T G Y H U J` | bass notes 🎸 |
| `/` + degree | latch a pedal bass 🦶 |
| `Z` / `X` | octave down / up (held) ⬇️⬆️ |
| `Space` | sustain 🌊 |
| `←` `→` | change key around the circle of fifths ⭕ |
| `↑` `↓` | octave 🪜 |
| `Tab` / `Enter` | voice leading / bass on-off 🎚️ |
| `Esc` | PANIC 🚨 all notes off |

## 🛠️ run it locally

```sh
npm install
npm run dev     # 🔥 dev server
npm run build   # 📦 typecheck + prod build
```

Built with ⚛️ React 19 · 🟦 TypeScript · 🌬️ Tailwind v4 · ⚡ Vite · 🔊 Tone.js · 🎼 Tonal

Pushes to `master` auto-deploy to GitHub Pages 🚢

---

<p align="center">made with 💜, way too many chords, and zero chill 😎🎶</p>
