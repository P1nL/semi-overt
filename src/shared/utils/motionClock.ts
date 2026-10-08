import { createFrameLimiter } from './animationFrame'

/** One wall-clock driven painter for all route effects, including late images. */
const jobs = new Set<(now: number) => void>()
const limiter = createFrameLimiter(60)
let frame = 0
let ticking = false
function tick(now: number) {
  frame = 0
  ticking = true
  if (limiter.consume(now) !== null) [...jobs].forEach(job => job(now))
  ticking = false
  if (jobs.size) frame = requestAnimationFrame(tick)
}
export function subscribeMotionFrame(job: (now: number) => void) {
  jobs.add(job)
  if (!frame && !ticking) { limiter.reset(); frame = requestAnimationFrame(tick) }
  return () => {
    jobs.delete(job)
    if (!jobs.size) { cancelAnimationFrame(frame); frame = 0; limiter.reset() }
  }
}
export function motionTimer(duration: number, paint: (elapsed: number) => void, done: () => void = () => {}) {
  const start = performance.now()
  let stopped = false
  paint(0)
  const unsubscribe = subscribeMotionFrame(now => {
    if (stopped) return
    const elapsed = Math.min(duration, now - start)
    paint(elapsed)
    if (elapsed >= duration) { stopped = true; unsubscribe(); done() }
  })
  return () => { stopped = true; unsubscribe() }
}
