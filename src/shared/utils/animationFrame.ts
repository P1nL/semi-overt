/** Limit expensive updates without slowing animation time on high-refresh displays. */
export function createFrameLimiter(fps = 60) {
  const interval = 1000 / fps
  let previous: number | null = null
  let next = 0
  return {
    reset() { previous = null; next = 0 },
    consume(now: number): number | null {
      if (previous === null) {
        previous = now
        next = now + interval
        return 0
      }
      if (now + 0.01 < next) return null
      const elapsed = Math.max(0, now - previous)
      previous = now
      next += (Math.max(0, Math.floor((now - next + 0.01) / interval)) + 1) * interval
      return elapsed
    },
  }
}
