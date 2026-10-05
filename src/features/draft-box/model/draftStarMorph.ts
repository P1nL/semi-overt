type Point = { x: number; y: number }
type Curve = { from: Point; control: Point; to: Point }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mix = (a: Point, b: Point, t: number): Point => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) })
function evaluate(curve: Curve, t: number): Point {
  return mix(mix(curve.from, curve.control, t), mix(curve.control, curve.to, t), t)
}
function section(curve: Curve, from: number, to: number): Curve {
  const start = evaluate(curve, from)
  const derivative = {
    x: 2 * ((1 - from) * (curve.control.x - curve.from.x) + from * (curve.to.x - curve.control.x)),
    y: 2 * ((1 - from) * (curve.control.y - curve.from.y) + from * (curve.to.y - curve.control.y)),
  }
  return { from: start, control: { x: start.x + derivative.x * (to - from) / 2, y: start.y + derivative.y * (to - from) / 2 }, to: evaluate(curve, to) }
}

/** Exact subdivision of the supplied four quadratic edges, then a rounded panel.
 * All twelve segments retain their identities; this is a path morph, not scaling.
 */
export function getDraftStarCurves(width: number, height: number, progress: number, radius = 20, originY = 0.5): Curve[] {
  const p = Math.min(1, Math.max(0, progress))
  const x = Math.max(1, width) / 2, y = Math.max(1, height) / 2
  const r = Math.min(radius, x, y)
  const tips = [{ x: 0, y: -14 }, { x: 14, y: 0 }, { x: 0, y: 14 }, { x: -14, y: 0 }]
  const controls = [{ x: 1.4, y: -1.4 }, { x: 1.4, y: 1.4 }, { x: -1.4, y: 1.4 }, { x: -1.4, y: -1.4 }]
  const star = tips.flatMap((from, index) => {
    const curve = { from, control: controls[index]!, to: tips[(index + 1) % 4]! }
    return [section(curve, 0, 0.4), section(curve, 0.4, 0.6), section(curve, 0.6, 1)]
  })
  const vertices = [
    { x: 0, y: -y }, { x: x - r, y: -y }, { x, y: -y + r }, { x, y: 0 },
    { x, y: y - r }, { x: x - r, y }, { x: 0, y },
    { x: -x + r, y }, { x: -x, y: y - r }, { x: -x, y: 0 },
    { x: -x, y: -y + r }, { x: -x + r, y: -y }, { x: 0, y: -y },
  ]
  const corners: Record<number, Point> = { 1: { x, y: -y }, 4: { x, y }, 7: { x: -x, y }, 10: { x: -x, y: -y } }
  // Let the four tips spread first; fill the concave edges more gradually.
  const grow = (point: Point): Point => ({ x: point.x * lerp(1, x / 14, p), y: point.y * lerp(1, y / 14, p) })
  const shapeBlend = p * p
  const shift = (point: Point): Point => ({ x: point.x, y: point.y + height * (0.5 - originY) * p })
  return star.map((curve, index) => ({
    from: shift(mix(grow(curve.from), vertices[index]!, shapeBlend)),
    control: shift(mix(grow(curve.control), corners[index] ?? mix(vertices[index]!, vertices[index + 1]!, 0.5), shapeBlend)),
    to: shift(mix(grow(curve.to), vertices[index + 1]!, shapeBlend)),
  }))
}
export function getDraftStarPath(width: number, height: number, progress: number, radius = 20, originY = 0.5) {
  const curves = getDraftStarCurves(width, height, progress, radius, originY)
  const point = (p: Point) => `${p.x.toFixed(3)} ${p.y.toFixed(3)}`
  return `M ${point(curves[0]!.from)} ` + curves.map(curve => `Q ${point(curve.control)} ${point(curve.to)}`).join(' ') + ' Z'
}
export function getDraftPanelPlacement(anchorX: number, preferredWidth: number, viewportWidth: number, side: 'bottom' | 'left' = 'bottom') {
  if (side === 'left') {
    // Preserve panel width by using the space left of the viewport-edge button.
    const width = Math.max(1, Math.min(preferredWidth, viewportWidth - 24, anchorX - 24))
    return { width, left: Math.max(12, anchorX - 12 - width) }
  }
  const width = Math.max(1, Math.min(preferredWidth, 2 * Math.max(1, Math.min(anchorX - 12, viewportWidth - 12 - anchorX))))
  return { width, left: anchorX - width / 2 }
}
