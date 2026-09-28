import { DIATONIC_QUALITY, type ChordSpec, type Degree, type Extension, type Quality, type Seventh } from '../music/theory'
import { EXTENSION_KEYS, QUALITY_KEYS, SEVENTH_KEYS } from './keymap'

/**
 * Turn a degree key + currently held modifier keys into a chord spec.
 *
 * Precedence, lowest to highest:
 *   diatonic quality (♭root → major) → Shift flip → `]` forces major →
 *   sus (`;` `'`) → dim/aug (`-` `=`) → `\` forces dim
 */
export function buildSpec(degree: Degree, held: ReadonlySet<string>, shift: boolean): ChordSpec {
  const flatRoot = held.has(QUALITY_KEYS.flatRoot)
  let quality: Quality = flatRoot ? 'maj' : DIATONIC_QUALITY[degree]

  // maj ↔ min. The diatonic vii° becomes a plain minor vii (a major VII needs a custom bind for now)
  if (shift) quality = quality === 'min' ? 'maj' : 'min'

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

  return { degree, flatRoot, quality, seventh, extensions }
}
