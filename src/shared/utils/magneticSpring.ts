export type MagneticPoint = { x: number; y: number }
export type MagneticSpringState = MagneticPoint & { vx: number; vy: number }

export function magneticTarget(x: number, y: number): MagneticPoint {
  return { x: Math.max(-16, Math.min(16, x * 0.62)), y: Math.max(-13, Math.min(13, y * 0.62)) }
}

export type MagneticShapeMatrix = { a: number; b: number; c: number; d: number }

/** Stretch toward the pointer and squash across it, with a smooth circular rest pose. */
export function createMagneticDeformation(offset: MagneticPoint): MagneticShapeMatrix {
  const distance = Math.hypot(offset.x, offset.y)
  if (distance < 0.001) return { a: 1, b: 0, c: 0, d: 1 }
  const t = Math.min(1, distance / 16)
  const amount = t * t * (3 - 2 * t)
  const stretch = 1 + amount * 0.18
  const squash = 1 - amount * 0.10
  const cos = offset.x / distance
  const sin = offset.y / distance
  const cross = (stretch - squash) * cos * sin
  return { a: stretch * cos * cos + squash * sin * sin, b: cross, c: cross,
    d: stretch * sin * sin + squash * cos * cos }
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
