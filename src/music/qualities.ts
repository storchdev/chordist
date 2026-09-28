import { DIATONIC_QUALITY, type Degree, type Quality } from './theory'

export const DEGREES: Degree[] = [1, 2, 3, 4, 5, 6, 7]
export const QUALITIES: Quality[] = ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4']

export type QualityRow = Record<Degree, Quality>

/**
 * What quality each number key plays: plain, with Shift, with ♭root (`` ` ``), and with both.
 * The rest of the modifier precedence (`]`, sus, dim/aug, `\`) still applies on top.
 */
export interface QualityMap {
  plain: QualityRow
  shift: QualityRow
  flat: QualityRow
  flatShift: QualityRow
  /** When on, the Shift rows are derived from the plain/♭ rows with `defaultShift` and aren't editable */
  useDefaultShift: boolean
}

/** The built-in Shift: maj ↔ min, anything else (dim, aug, sus) → min */
export const defaultShift = (q: Quality): Quality => (q === 'min' ? 'maj' : 'min')

const row = (f: (d: Degree) => Quality) => Object.fromEntries(DEGREES.map((d) => [d, f(d)])) as QualityRow

export const DEFAULT_QUALITY_MAP: QualityMap = {
  plain: { ...DIATONIC_QUALITY },
  shift: row((d) => defaultShift(DIATONIC_QUALITY[d])),
  flat: row(() => 'maj'),
  flatShift: row(() => defaultShift('maj')),
  useDefaultShift: true,
}

/** The Shift rows as they currently behave (derived when using the default Shift) */
export function effectiveShiftRows(map: QualityMap): { shift: QualityRow; flatShift: QualityRow } {
  if (!map.useDefaultShift) return { shift: map.shift, flatShift: map.flatShift }
  return { shift: row((d) => defaultShift(map.plain[d])), flatShift: row((d) => defaultShift(map.flat[d])) }
}

export function qualityFor(map: QualityMap, degree: Degree, flat: boolean, shift: boolean): Quality {
  if (!shift) return (flat ? map.flat : map.plain)[degree]
  const rows = effectiveShiftRows(map)
  return (flat ? rows.flatShift : rows.shift)[degree]
}
