export function getPageScrollbarGeometry(viewport: number, content: number, track: number, scrollTop: number) {
  const scrollRange = Math.max(0, content - viewport)
  const thumbSize = Math.min(track, Math.max(32, content > 0 ? track * viewport / content : track))
  const travel = Math.max(0, track - thumbSize)
  const thumbOffset = scrollRange > 0 ? travel * Math.max(0, Math.min(scrollTop, scrollRange)) / scrollRange : 0
  return { scrollRange, thumbSize, travel, thumbOffset }
}

export function getPageScrollTopFromThumb(offset: number, travel: number, scrollRange: number) {
  return travel > 0 ? Math.max(0, Math.min(offset / travel, 1)) * scrollRange : 0
}
