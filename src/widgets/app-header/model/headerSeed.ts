type Rect = { left: number; top: number; width: number; height: number }
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const decelerate = (n: number) => 1 - (1 - clamp(n)) ** 3

/** Solid drop + tapering liquid neck. No layout mutation or filter on icons. */
export function getHeaderSeedFrame(category: Rect, tools: Rect, split: number, flight: number, grow: number, donor: Rect = category) {
  const right = category.left + category.width
  const cy = category.top + category.height / 2
  const radius = Math.max(10, Math.min(14, category.height * .23))
  const gap = Math.max(0, tools.left - right)
  // Clear the right-stretched donor even in the compact navigation gap.
  const detachedX = Math.min(tools.left + radius - 4, right + radius + Math.min(54, Math.max(22, gap * .22)))
  const targetX = tools.left + radius
  const s = decelerate(split), f = decelerate(flight), g = clamp(grow)
  // Start at zero radius on the live rim, rather than a pre-existing loose dot.
  const birth = decelerate(split / .16)
  const r = radius * birth
  const originX = donor.left + donor.width + r * .25
  const splitX = originX + (detachedX - originX) * s
  const x = splitX + (targetX - splitX) * f
  const y = cy + (tools.top + tools.height / 2 - cy) * f
  const width = 2 * r + (tools.width - 2 * r) * g
  const height = 2 * r + (tools.height - 2 * r) * g
  const attachX = donor.left + donor.width - 10
  const joinX = x - r * .35
  const span = joinX - attachX
  const midX = attachX + span * .55
  const rootHalf = donor.height * .19 * birth
  const tipHalf = r * .88
  const neckHalf = .8 + 7.5 * (1 - clamp(split)) ** 2
  const neckOpacity = 1 - clamp((split - .88) / .12)
  const neck = r > 0 && span > 1 && split < 1 && flight === 0 && grow === 0
    ? `M${attachX} ${cy - rootHalf}
       C${attachX + span * .22} ${cy - rootHalf} ${midX - span * .18} ${y - neckHalf} ${midX} ${y - neckHalf}
       C${midX + span * .18} ${y - neckHalf} ${joinX - span * .12} ${y - tipHalf} ${joinX} ${y - tipHalf}
       L${joinX} ${y + tipHalf}
       C${joinX - span * .12} ${y + tipHalf} ${midX + span * .18} ${y + neckHalf} ${midX} ${y + neckHalf}
       C${midX - span * .18} ${y + neckHalf} ${attachX + span * .22} ${cy + rootHalf} ${attachX} ${cy + rootHalf}Z`
    : ''
  return {
    x: grow > 0 ? tools.left : x - r,
    y: y - height / 2, width, height, neck, neckOpacity, neckHalf,
    emissionOpacity: birth * (1 - g),
  }
}
