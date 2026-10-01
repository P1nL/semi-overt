type Point = { x: number; y: number }
type ShapeMatrix = { a: number; b: number; c: number; d: number }

/** Circle/ellipse-tangent shoulders; a longer separation draws a thinner, stretched neck. */
export function createLiquidBridgePath(width: number, height: number, offset: Point, shape: ShapeMatrix = { a: 1, b: 0, c: 0, d: 1 }): string {
  if (width <= 0 || height <= 0) return ''
  const radius = height / 2
  const a = { x: radius, y: radius }
  const b = { x: width - radius + offset.x, y: radius + offset.y }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const distance = Math.hypot(dx, dy)
  if (!distance) return ''
  const u = { x: dx / distance, y: dy / distance }
  const n = { x: -u.y, y: u.x }
  const shoulder = 0.7
  const side = Math.sqrt(1 - shoulder * shoulder)
  const handle = Math.max(radius * 0.3, Math.min(radius * 0.7, radius * 0.48 + (distance - (width - height)) * 0.24))
  const point = (center: Point, along: number, normal: number, matrix?: ShapeMatrix) => {
    const x = u.x * along + n.x * normal
    const y = u.y * along + n.y * normal
    return { x: center.x + (matrix ? matrix.a * x + matrix.c * y : x),
      y: center.y + (matrix ? matrix.b * x + matrix.d * y : y) }
  }
  const lt = point(a, radius * shoulder, -radius * side)
  const rt = point(b, -radius * shoulder, -radius * side, shape)
  const rb = point(b, -radius * shoulder, radius * side, shape)
  const lb = point(a, radius * shoulder, radius * side)
  const format = (p: Point) => `${p.x.toFixed(3)} ${p.y.toFixed(3)}`
  return `M${format(lt)} C${format(point(lt, handle * side, handle * shoulder))} ${format(point(rt, -handle * side, handle * shoulder, shape))} ${format(rt)} L${format(rb)} C${format(point(rb, -handle * side, -handle * shoulder, shape))} ${format(point(lb, handle * side, -handle * shoulder))} ${format(lb)} Z`
}
