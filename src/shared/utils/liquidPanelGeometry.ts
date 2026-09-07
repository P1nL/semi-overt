/** A single surface grows down from a fixed header-edge source. No bead or neck. */
export type LiquidSurfaceFrame = {
  path: string
  contentOpacity: number
  fullSurface: boolean
  origin: { x: number; y: number }
  body: { left: number; top: number; width: number; height: number; radius: number }
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const mix = (from: number, to: number, progress: number) => progress <= 0 ? from : progress >= 1 ? to : from + (to - from) * progress
const smooth = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from), 0, 1)
  return t * t * (3 - 2 * t)
}

export function liquidSurfaceFrame(
  width: number, height: number, origin: number, progress: number,
  gap = 12, variant: 'drop' | 'search' = 'drop', corner = 20,
): LiquidSurfaceFrame {
  const w = Math.max(1, width), h = Math.max(1, height)
  const p = clamp(progress, 0, 1), a = clamp(origin, 0, w)
  // gap may be negative: the existing panel can overlap the header by a few px.
  const sourceY = clamp(-gap, -h, h-0.01) || 0
  const padding = Math.max(0, -sourceY)
  const seedWidth = Math.min(28, w)
  const initialLeft = clamp(a-seedWidth/2, 0, w-seedWidth)
  // Widen the attachment before extending down. Both sides grow away from the
  // same source, rather than moving a round body's center toward the panel center.
  const growX = variant === 'search' ? 1 : smooth(0, 0.50, p)
  const growY = smooth(variant === 'search' ? 0.08 : 0.18, 0.72, p)
  const left = mix(initialLeft, 0, growX), bodyWidth = mix(seedWidth, w, growX)
  const top = mix(sourceY, 0, smooth(0.50, 0.72, p))
  const bulge = variant === 'search' ? 0.01 : mix(0.01, Math.min(5,h-sourceY), smooth(0,0.12,p))
  const bottom = mix(sourceY+bulge, h, growY)
  const bodyHeight = Math.max(0.01, bottom-top)
  const finishRadius = Math.min(corner, w/2, h/2)
  const topRadius = Math.min(finishRadius*smooth(0.40, 0.72, p), bodyWidth/2, bodyHeight/2)
  const bottomRadius = Math.max(0, Math.min(bodyWidth/2, bodyHeight-topRadius,
    mix(bodyHeight, finishRadius, smooth(0.28, 0.72, p))))
  const right = left+bodyWidth, rt=topRadius, rb=bottomRadius, k=0.55228475
  const point = (x: number, y: number) => `${(x/w).toFixed(6)} ${((y+padding)/(h+padding)).toFixed(6)}`
  const path = `M ${point(left+rt,top)} L ${point(right-rt,top)} C ${point(right-rt+k*rt,top)} ${point(right,top+rt-k*rt)} ${point(right,top+rt)} L ${point(right,bottom-rb)} C ${point(right,bottom-rb+k*rb)} ${point(right-rb+k*rb,bottom)} ${point(right-rb,bottom)} L ${point(left+rb,bottom)} C ${point(left+rb-k*rb,bottom)} ${point(left,bottom-rb+k*rb)} ${point(left,bottom-rb)} L ${point(left,top+rt)} C ${point(left,top+rt-k*rt)} ${point(left+rt-k*rt,top)} ${point(left+rt,top)} Z`
  return {
    path, contentOpacity: smooth(0.74, 0.98, p), fullSurface: p>=0.74,
    origin: { x: a, y: sourceY },
    body: { left, top, width: bodyWidth, height: bodyHeight, radius: finishRadius },
  }
}
