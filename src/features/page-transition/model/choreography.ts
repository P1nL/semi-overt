import type { PageMotionKind } from '@/shared/composables/usePageMotion'
export const PAGE_MOTION_FPS = 60
export const SCENE_DURATION = { home: 2000, results: 2000, profile: 2000, other: 150 } as const
export const LEAVE_DURATION = { ...SCENE_DURATION, home: 2500, results: 1500 } as const
export const RESULT_SCALE_DURATION = { enter: 1100, leave: 850 } as const
export const SIBLING_DURATION = 2000
export const progress = (time: number, start: number, duration: number) => Math.max(0, Math.min(1, (time - start) / duration))
export const out = (p: number) => 1 - Math.pow(1 - p, 3)
export const mix = (a: number, b: number, p: number) => a + (b - a) * p
export const ROPE_CONNECT_START = 550
export const ROPE_CONNECT_DURATION = 600
const ROPE_CONNECT_HOLD = 50
export const homeExitProgress = (time: number, pullStart = ROPE_CONNECT_START + ROPE_CONNECT_DURATION + ROPE_CONNECT_HOLD) => progress(time, pullStart, Math.max(1, LEAVE_DURATION.home - pullStart)) ** 2
// Linear growth makes the downward travel visible instead of revealing most of
// the line in the first few frames of a short cubic ease-out.
export const ropeConnectProgress = (time: number, start = ROPE_CONNECT_START) => progress(time, start, ROPE_CONNECT_DURATION)
export function createRopeDescentClock() {
  let readyAt: number | null = null
  return {
    start(time: number) { readyAt ??= time },
    get ready() { return readyAt !== null },
    connection(time: number) { return readyAt === null ? 0 : ropeConnectProgress(time, readyAt) },
    pull(time: number) { return readyAt === null ? 0 : homeExitProgress(time, readyAt + ROPE_CONNECT_DURATION + ROPE_CONNECT_HOLD) },
  }
}
/** Nearest-neighbour image blocks resolve geometrically, rather than a checkerboard. */
export function pixelResolution(p: number, size: number) {
  if (p >= 1) return size
  return Math.min(size, 2 ** Math.floor(mix(2, Math.log2(size), out(Math.max(0, p)))))
}
export function pageKind(name: unknown): PageMotionKind {
  const value = String(name ?? '').toLowerCase()
  if (value === 'home') return 'home'
  if (value === 'category' || value === 'search') return 'results'
  if (value === 'profile') return 'profile'
  return 'other'
}
export function isSibling(from: PageMotionKind, to: PageMotionKind) {
  return from === to && (to === 'results' || to === 'profile')
}
export function routeDuration(from: PageMotionKind, to: PageMotionKind) {
  return isSibling(from, to) ? SIBLING_DURATION : LEAVE_DURATION[from] + SCENE_DURATION[to]
}
/** Draw once per glyph per entrance, never once per frame or from a fixed pose list. */
export function randomLandingAngle(random = Math.random) {
  const kind = random()
  const jitter = random() * 36 - 18
  return kind < .68 ? jitter * 1.5 : kind < .86 ? (random() < .5 ? -90 : 90) + jitter : 180 + jitter
}
export function randomLandingRotation(random = Math.random) {
  return { x: 0, y: 0, z: randomLandingAngle(random) }
}
export function fallingRotation(time: number, index: number, landing: { x: number; y: number; z: number }) {
  const spin = fallingPose(time, index, 0, 0).angle
  return {
    x: 0,
    y: 0,
    z: landing.z + spin,
  }
}
export function fallingPose(time: number, index: number, distance: number, angle: number) {
  const start = 40 + (index % 7) * 16
  const duration = 1260 + (index % 5) * 32
  const p = progress(time, start, duration)
  const spin = (index % 2 ? 1 : -1) * (110 + index % 4 * 45)
  // Constant deceleration: initial speed is 2 * distance / duration, and
  // dy/dt = 2 * distance * (1 - p) / duration reaches zero exactly at landing.
  const lift = p < 1 ? -distance * Math.pow(1 - p, 2) : 0
  return { y: lift, angle: angle + spin * Math.pow(1 - p, 2), complete: p === 1 }
}
