export const RADIAL_REVEAL_DURATION = 760
export const RADIAL_REVEAL_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'
export function coveringRadius(x: number, y: number, width: number, height: number) {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) + 2
}
/** Same bezier as the theme switch, evaluated without a DOM animation. */
export function radialRevealEase(progress: number) {
  const p = Math.min(1, Math.max(0, progress))
  let lo = 0, hi = 1
  for (let i = 0; i < 16; i++) {
    const t = (lo + hi) / 2
    const x = 3 * (1 - t) ** 2 * t * 0.4 + 3 * (1 - t) * t * t * 0.2 + t ** 3
    if (x < p) lo = t
    else hi = t
  }
  const t = (lo + hi) / 2
  return p === 0 || p === 1 ? p : 3 * (1 - t) * t * t + t ** 3
}
