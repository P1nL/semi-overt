/** Shared geometry: the existing opening-animation home-button spark. */
export const BUTTON_BURST_RAYS = Array.from({ length: 12 }, (_, i) => ({ angle: i * Math.PI / 6, length: i % 2 ? 6 : 12 }))
export function buttonBurstRay(index: number, progress: number) {
  const ray = BUTTON_BURST_RAYS[index]!
  const p = Math.max(0, Math.min(1, progress))
  const out = 1 - Math.pow(1 - p, 3)
  const inner = 20 + out * 20
  const outer = inner + ray.length * (1 - p)
  return { x1: Math.cos(ray.angle) * inner, y1: Math.sin(ray.angle) * inner,
    x2: Math.cos(ray.angle) * outer, y2: Math.sin(ray.angle) * outer }
}
