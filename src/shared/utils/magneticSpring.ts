export type MagneticPoint = { x: number; y: number }
export type LiquidButtonMotion = MagneticPoint & { rim?: readonly number[] }
export type LiquidRimState = { displacement: number[]; velocity: number[] }
export type MagneticSpringState = MagneticPoint & { vx: number; vy: number }

export function magneticTarget(x: number, y: number): MagneticPoint {
  return { x: Math.max(-16, Math.min(16, x * 0.62)), y: Math.max(-13, Math.min(13, y * 0.62)) }
}

export function createLiquidRimState(): LiquidRimState {
  return { displacement: Array(32).fill(0), velocity: Array(32).fill(0) }
}

/** Coupled perimeter springs: local pressure propagates instead of rotating a preset wave. */
export function stepLiquidRim(state: LiquidRimState, motion: MagneticPoint, seconds: number): LiquidRimState {
  const count = state.displacement.length
  const direction = Math.atan2(motion.y, motion.x)
  const strength = 1 - Math.exp(-Math.hypot(motion.x, motion.y) / 5)
  const pressure = Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count - direction
    const front = Math.exp((Math.cos(angle) - 1) * 4)
    const tail = Math.exp((-Math.cos(angle) - 1) * 3)
    return strength * (0.90 * front + 0.12 * tail - 0.22 * Math.sin(angle) ** 2)
  })
  // Remove average pressure so the liquid does not inflate with every movement.
  const average = pressure.reduce((sum, value) => sum + value, 0) / count
  const displacement = [...state.displacement], velocity = [...state.velocity]
  const elapsed = Math.max(0, Math.min(0.032, seconds))
  const steps = Math.max(1, Math.ceil(elapsed / 0.008)), dt = elapsed / steps
  for (let step = 0; step < steps; step++) {
    const previous = [...displacement]
    for (let index = 0; index < count; index++) {
      const neighbors = previous[(index + count - 1) % count]! + previous[(index + 1) % count]! - 2 * previous[index]!
      velocity[index] += ((pressure[index]! - average - previous[index]!) * 150 + neighbors * 55 - velocity[index]! * 15) * dt
      const next = previous[index]! + velocity[index]! * dt
      displacement[index] = Math.max(-0.30, Math.min(0.70, next))
      if (displacement[index] !== next) velocity[index] = 0
    }
  }
  return { displacement, velocity }
}

export function deformLiquidPoint(point: MagneticPoint, motion: LiquidButtonMotion): MagneticPoint {
  const rim = motion.rim
  if (!rim?.length) return point
  const angle = (Math.atan2(point.y, point.x) + Math.PI * 2) % (Math.PI * 2)
  const position = angle / (Math.PI * 2) * rim.length
  const index = Math.floor(position), fraction = position - index
  const scale = 1 + rim[index]! * (1 - fraction) + rim[(index + 1) % rim.length]! * fraction
  return { x: point.x * scale, y: point.y * scale }
}

/** Closed Catmull-Rom contour; control points move independently around the rim. */
export function createLiquidButtonPath(radius: number, motion: LiquidButtonMotion): string {
  if (!motion.rim?.some(value => Math.abs(value) >= 0.0001)) {
    return `M${radius} 0 A${radius} ${radius} 0 1 0 ${-radius} 0 A${radius} ${radius} 0 1 0 ${radius} 0 Z`
  }
  const count = 32
  const points = Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count
    return deformLiquidPoint({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) }, motion)
  })
  const at = (index: number) => points[(index + count) % count]!
  const format = (point: MagneticPoint) => `${point.x.toFixed(3)} ${point.y.toFixed(3)}`
  let path = `M${format(at(0))}`
  for (let index = 0; index < count; index++) {
    const previous = at(index - 1), current = at(index), next = at(index + 1), after = at(index + 2)
    const first = { x: current.x + (next.x - previous.x) / 6, y: current.y + (next.y - previous.y) / 6 }
    const second = { x: next.x - (after.x - current.x) / 6, y: next.y - (after.y - current.y) / 6 }
    path += ` C${format(first)} ${format(second)} ${format(next)}`
  }
  return path + ' Z'
}

export function stepMagneticSpring(state: MagneticSpringState, target: MagneticPoint, seconds: number): MagneticSpringState {
  const next = { ...state }
  const elapsed = Math.max(0, Math.min(0.032, seconds))
  const steps = Math.max(1, Math.ceil(elapsed / 0.008))
  const dt = elapsed / steps
  for (let index = 0; index < steps; index++) {
    next.vx += ((target.x - next.x) * 200 - next.vx * 28) * dt
    next.vy += ((target.y - next.y) * 200 - next.vy * 28) * dt
    next.x += next.vx * dt
    next.y += next.vy * dt
  }
  return next
}
