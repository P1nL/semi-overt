/** Only WarpText in the same explicitly supplied group may share a pointer. */
export function isWarpTriggerTarget(
  target: Pick<Element, 'closest'> | null,
  container: Element,
  group: Pick<Node, 'contains'> | null = null,
): boolean {
  const warp = target?.closest('.warp-text')
  return !!warp && (group ? group.contains(warp) : warp === container)
}

export function getWarpPointerTarget(
  point: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number },
  aspect: number,
  radius: number,
) {
  if (rect.width <= 0 || rect.height <= 0 || radius <= 0) return null
  const x = (point.x - rect.left) / rect.width
  const y = 1 - (point.y - rect.top) / rect.height
  const dx = Math.max(0, -x, x - 1) * Math.max(aspect, 0.001)
  const dy = Math.max(0, -y, y - 1)
  if (Math.hypot(dx, dy) >= radius) return null
  return { x, y }
}
