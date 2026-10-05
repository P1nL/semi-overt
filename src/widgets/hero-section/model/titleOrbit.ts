export const TITLE_ORBIT_DURATION = 120_000
export const TITLE_ORBIT_HEIGHT = 0.5
const TAU = Math.PI * 2

export function createTitleOrbit(title: string) {
  const source = Array.from(title)
  const separator = source.findIndex((letter, index) => letter === '•' && source[index + 1] === 'O')
  const letters = source.filter((_, index) => index !== separator)
  return [0, 1].flatMap(half => letters.map((letter, index) => {
    // 两端不放重复节点，避免上下弧在接缝处重叠。
    const t = (index + 0.5) / letters.length
    const angle = Math.PI * t
    return {
      letter,
      eye: separator >= 0 && index === separator,
      eyeStyle: half === 0 ? 'snoopy' as const : 'letter' as const,
      effect: half === 0 ? 'pressure' as const : 'scramble' as const,
      // 字体属于这组文字，不随转到上弧或下弧而切换。
      fontFamily: half === 0 ? 'var(--font-pressure)' : 'var(--font-display)',
      angle: half === 0 ? Math.PI + angle : Math.PI - angle,
    }
  }))
}

export function getTitleOrbitPose(angle: number, phase: number) {
  const theta = angle + phase
  const depth = Math.sin(theta)
  const front = Math.min(1, Math.max(0, (0.35 - depth) / 0.7))
  const blend = front * front * (3 - 2 * front)
  const scale = 0.66 + 0.34 * blend
  return {
    x: 0.46 * Math.cos(theta),
    y: 0.38 + TITLE_ORBIT_HEIGHT * depth,
    front: blend,
    opacity: 0.28 + 0.72 * blend,
    blur: 4 * (1 - blend),
    scaleX: scale * (0.22 + 0.78 * Math.abs(depth)),
    scaleY: scale * (0.6 + 0.4 * Math.abs(depth)),
  }
}

export function advanceTitleOrbit(phase: number, elapsed: number) {
  return (phase + Math.max(0, elapsed) / TITLE_ORBIT_DURATION * TAU) % TAU
}

type OrbitRect = { left: number; right: number; top: number; bottom: number }

/** Connect consecutive glyph slots without filling the space between both arcs. */
export function getTitleOrbitHitDistance(point: { x: number; y: number }, rects: OrbitRect[]): number {
  let nearest = Infinity
  const measure = (left: number, right: number, top: number, bottom: number) => {
    if (right <= left || bottom <= top || point.x < left || point.x > right) return
    const distance = Math.abs(point.y - (top + bottom) / 2) / ((bottom - top) / 2)
    if (distance <= 1) nearest = Math.min(nearest, distance)
  }
  rects.forEach((rect, index) => {
    measure(rect.left, rect.right, rect.top, rect.bottom)
    const next = rects[index + 1]
    if (!next) return
    const x1 = (rect.left + rect.right) / 2
    const x2 = (next.left + next.right) / 2
    if (x1 === x2) return
    const t = (point.x - x1) / (x2 - x1)
    if (t < 0 || t > 1) return
    measure(Math.min(x1, x2), Math.max(x1, x2),
      rect.top + (next.top - rect.top) * t,
      rect.bottom + (next.bottom - rect.bottom) * t)
  })
  return nearest
}
