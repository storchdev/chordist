import { qualityFor, type QualityMap } from '../music/qualities'
import { splitChordType, type BassSpec, type ChordType, type ChordSpec, type Degree, type Extension, type Quality, type Seventh } from '../music/theory'
import { BASS_KEYS, EXTENSION_KEYS, INVERSION_KEYS, QUALITY_KEYS, SEVENTH_KEYS } from './keymap'

/**
 * Turn a degree key + currently held modifier keys into a chord spec.
 *
 * Precedence, lowest to highest:
 *   quality table (plain / Shift / ♭root / ♭root+Shift, user-editable) → `]` forces major →
 *   sus (`;` `'`) → dim/aug (`-` `=`) → `\` forces dim
 *
 * Bass (low → high): latched `/` pedal → inversion key (8/9/0) → held one-off bass key (Q…U).
 */
export function buildSpec(
  degree: Degree,
  held: ReadonlySet<string>,
  shift: boolean,
  pedal: BassSpec | null,
  qualities: QualityMap,
  /** A held chord-type bind: replaces quality + 7th; root, extensions and bass still come from the keys */
  chordType: ChordType | null = null,
): ChordSpec {
  const flatRoot = held.has(QUALITY_KEYS.flatRoot)
  let quality: Quality = qualityFor(qualities, degree, flatRoot, shift)

  let seventhMode: Seventh | 'natural' | null = null
  for (const [code, mode] of Object.entries(SEVENTH_KEYS)) {
    if (!held.has(code)) continue
    // `\` beats `]` beats `[`
    if (mode === 'bb7' || (mode === 'b7' && seventhMode !== 'bb7') || seventhMode === null) seventhMode = mode
  }

  if (seventhMode === 'b7') quality = 'maj' // "plain 7" = dominant 7 on this root
  if (held.has(QUALITY_KEYS.sus2)) quality = 'sus2'
  if (held.has(QUALITY_KEYS.sus4)) quality = 'sus4'
  if (held.has(QUALITY_KEYS.dim)) quality = 'dim'
  if (held.has(QUALITY_KEYS.aug)) quality = 'aug'
  if (seventhMode === 'bb7') quality = 'dim'

  let seventh: Seventh | null = null
  if (seventhMode === 'natural') seventh = quality === 'maj' || quality === 'aug' ? 'maj7' : 'b7'
  else if (seventhMode) seventh = seventhMode

  const extensions: Extension[] = []
  for (const [code, ext] of Object.entries(EXTENSION_KEYS)) if (held.has(code)) extensions.push(ext)

  let bass: BassSpec | null = pedal
  for (const [code, index] of Object.entries(INVERSION_KEYS)) {
    if (held.has(code) && (bass?.kind !== 'chordTone' || index > bass.index)) bass = { kind: 'chordTone', index }
  }
  // No 7th to put in the bass → leave it in root position
  const hasSeventh = chordType ? splitChordType(chordType).core.length > 3 : seventh !== null
  if (bass?.kind === 'chordTone' && bass.index === 3 && !hasSeventh) bass = pedal
  // Held set iterates in press order, so the most recently pressed bass key wins
  for (const code of held) if (BASS_KEYS[code]) bass = BASS_KEYS[code]

  return { degree, flatRoot, quality, seventh, extensions, bass, ...(chordType && { chordType }) }
}
