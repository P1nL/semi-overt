export type SearchDropRow = 'article' | 'author'

export function getSearchDropMotion(distance: number, row: SearchDropRow) {
  const height = Math.max(0, distance)
  // Shared acceleration: the lower author row travels farther.
  const fallDuration = Math.sqrt(2 * height / 0.0032)
  const duration = fallDuration + 120
  const landing = fallDuration / duration
  const radius = row === 'article' ? '20px 20px 0px 0px' : '0px 0px 20px 20px'
  const keyframes: Keyframe[] = Array.from({ length: 17 }, (_, index) => {
    const t = index / 16
    return {
      offset: t * landing,
      transform: `translate3d(0, ${-height * (1 - t * t)}px, 0) scale(1, 1)`,
      opacity: Math.min(1, t * 8),
      borderRadius: '20px',
    }
  })
  keyframes.push(
    { offset: landing + (1 - landing) * 0.3, transform: 'translate3d(0, 0, 0) scale(1.012, 0.96)', opacity: 1, borderRadius: '20px' },
    { offset: 1, transform: 'translate3d(0, 0, 0) scale(1, 1)', opacity: 1, borderRadius: radius },
  )
  return { keyframes, options: { duration, delay: row === 'article' ? 280 : 0, easing: 'linear', fill: 'both' } satisfies KeyframeAnimationOptions }
}

export function getSearchReturnMotion(distance: number, row: SearchDropRow, pose: { transform: string; opacity: string; borderRadius: string }) {
  return {
    keyframes: [
      { transform: pose.transform, opacity: pose.opacity, borderRadius: pose.borderRadius },
      { transform: `translate3d(0, ${-Math.max(0, distance)}px, 0) scale(0.98, 1.02)`, opacity: pose.opacity, borderRadius: '20px' },
    ] satisfies Keyframe[],
    options: { duration: 240, delay: row === 'author' ? 80 : 0, easing: 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'both' } satisfies KeyframeAnimationOptions,
  }
}
