const TRANSFER = 0.28
const RESPONSE_MS = 90
const SETTLE_EPSILON = 0.0005

/** Local compression reaches neighboring glyphs on later frames, with damping. */
export function stepGlyphCompression(
  sources: readonly number[],
  previous: readonly number[],
  elapsed: number,
): { values: number[]; settled: boolean } {
  const alpha = 1 - Math.exp(-Math.max(0, Math.min(32, elapsed)) / RESPONSE_MS)
  let settled = true
  const values = sources.map((source, index) => {
    const neighbors = (previous[index - 1] ?? 0) + (previous[index + 1] ?? 0)
    const rawTarget = Math.max(0, Math.min(1, source + neighbors * TRANSFER))
    const target = rawTarget < SETTLE_EPSILON ? 0 : rawTarget
    const before = previous[index] ?? 0
    const interpolated = before + (target - before) * alpha
    const value = Math.abs(target - interpolated) < SETTLE_EPSILON ? target : interpolated
    settled &&= value === before
    return value
  })
  return { values, settled }
}
