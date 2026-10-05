/** True variable-weight gradient. Idle / reduced-motion always returns 900. */
export function getPressureWeight(distance: number, radius: number, active: boolean): number {
  if (!active) return 900
  const proximity = Math.max(0, 1 - Math.max(0, distance) / Math.max(1, radius))
  return 100 + proximity * 900
}

/** Activate on this title's text or central eye, but never on empty title space. */
export function isPressureTriggerTarget(
  target: Pick<Element, 'closest'> | null,
  container: Pick<Node, 'contains'>,
  point: { x: number; y: number },
): boolean {
  const eye = target?.closest('.hero-title-eye')
  if (eye && container.contains(eye)) {
    // Ignore the hidden O spacer and wrapper line-height above/below the icon.
    const icon = eye.querySelector('svg')
    if (!icon) return false
    const rect = icon.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    const x = (point.x - (rect.left + rect.width / 2)) / (rect.width * 0.5)
    const y = (point.y - (rect.top + rect.height / 2)) / (rect.height * 0.5)
    // Include the pale-purple outer disc, but exclude the SVG's empty corners.
    return x * x + y * y <= 1
  }
  const glyph = target?.closest('.text-pressure-glyph')
  if (!glyph || !container.contains(glyph) || !glyph.textContent?.trim()) return false
  const rect = glyph.getBoundingClientRect()
  const insetX = rect.width * 0.08
  const insetY = rect.height * 0.16
  // Text keeps its existing rectangular horizontal/vertical insets.
  return rect.width > 0 && rect.height > 0
    && point.x >= rect.left + insetX && point.x <= rect.right - insetX
    && point.y >= rect.top + insetY && point.y <= rect.bottom - insetY
}
