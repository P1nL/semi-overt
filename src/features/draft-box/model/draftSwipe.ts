export const DRAFT_DELETE_WIDTH = 64
export const DRAFT_HINT_DISTANCE = DRAFT_DELETE_WIDTH * 0.75
export const DRAFT_DRAG_THRESHOLD = 8
export function draftDragIntent(dx: number, dy: number): 'pending' | 'horizontal' | 'vertical' {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAFT_DRAG_THRESHOLD) return 'pending'
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? 'horizontal' : 'vertical'
}
export const clampDraftOffset = (value: number) => Math.max(-DRAFT_DELETE_WIDTH, Math.min(0, value))
// Gesture feel adapted from React Bits SwipeRow (fullSwipe intentionally disabled).
// Reference: https://reactbits.dev/r/SwipeRow-JS-TW.json
export const shouldRevealDraftDelete = (offset: number, velocity = 0) => {
  if (Math.abs(velocity) >= 110) return velocity < 0
  return offset + velocity * 0.499 <= -DRAFT_DELETE_WIDTH / 2
}

const rubber = (distance: number) => distance * 32 * 0.55 / (32 + 0.55 * Math.abs(distance))
const unrubber = (distance: number) => distance * 32 / (0.55 * Math.max(0.01, 32 - Math.abs(distance)))
export function draftRubberOffset(raw: number) {
  if (raw > 0) return rubber(raw)
  if (raw < -DRAFT_DELETE_WIDTH) return -DRAFT_DELETE_WIDTH + rubber(raw + DRAFT_DELETE_WIDTH)
  return raw
}
export function draftRawOffset(offset: number) {
  if (offset > 0) return unrubber(offset)
  if (offset < -DRAFT_DELETE_WIDTH) return -DRAFT_DELETE_WIDTH + unrubber(offset + DRAFT_DELETE_WIDTH)
  return offset
}
export type DraftSwipeSample = { time: number; offset: number }
export function draftSwipeVelocity(samples: DraftSwipeSample[], now: number) {
  const recent = samples.filter(sample => now - sample.time <= 80)
  const first = recent[0], last = recent[recent.length - 1]
  if (!first || !last || last.time <= first.time) return 0
  return Math.max(-1500, Math.min(1500, (last.offset - first.offset) * 1000 / (last.time - first.time)))
}

// Sample an analytic spring once; WAAPI plays both layers without reactive per-frame updates.
export function draftSnapFrames(from: number, to: number, velocity = 0) {
  const flick = Math.abs(velocity) >= 110
  const duration = flick ? 400 : 300
  const omega = 26, damping = flick ? 0.82 : 1
  const v = Math.max(-1500, Math.min(1500, velocity))
  const distance = from - to
  const positions = Array.from({ length: 37 }, (_, index) => {
    const t = index / 36 * duration / 1000
    if (index === 36) return to
    if (!flick) return to + (distance + (v + omega * distance) * t) * Math.exp(-omega * t)
    const decay = damping * omega, frequency = omega * Math.sqrt(1 - damping * damping)
    return to + Math.exp(-decay * t) * (distance * Math.cos(frequency * t) + (v + decay * distance) / frequency * Math.sin(frequency * t))
  })
  return { duration, positions }
}
