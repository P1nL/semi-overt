export type ThemeIconMode = 'sun' | 'globe' | 'moon'
export type ThemeIconPose = { outline: number[]; sun: number; globe: number; moon: number }

function circle(radius: number): number[] {
  const c = 12, k = radius * 0.55228475, lo = c - radius, hi = c + radius
  // All three outlines share M + four cubic segments + Z. No path swapping.
  return [c, lo, c-k, lo, lo, c-k, lo, c, lo, c+k, c-k, hi, c, hi,
    c+k, hi, hi, c+k, hi, c, hi, c-k, c+k, lo, c, lo]
}

export function themeIconPose(mode: ThemeIconMode): ThemeIconPose {
  return {
    outline: mode === 'moon'
      ? [9, 3, 5.5, 4, 3, 7.6, 3, 12, 3, 17, 7, 21, 12, 21,
        15.8, 21, 19.1, 18.6, 20.4, 15.2, 12.6, 16.4, 7.6, 10.3, 9, 3]
      : circle(mode === 'sun' ? 4.1 : 9),
    sun: mode === 'sun' ? 1 : 0,
    globe: mode === 'globe' ? 1 : 0,
    moon: mode === 'moon' ? 1 : 0,
  }
}

export function interpolateThemeIcon(from: ThemeIconPose, to: ThemeIconPose, t: number): ThemeIconPose {
  const mix = (a: number, b: number) => a + (b-a) * t
  return {
    outline: from.outline.map((n, i) => mix(n, to.outline[i]!)),
    sun: mix(from.sun, to.sun), globe: mix(from.globe, to.globe), moon: mix(from.moon, to.moon),
  }
}

export function themeIconPath(points: number[]): string {
  const n = (i: number) => points[i]!.toFixed(3)
  let path = 'M' + n(0) + ' ' + n(1)
  for (let i = 2; i < points.length; i += 6) {
    path += 'C' + points.slice(i, i+6).map(v => v.toFixed(3)).join(' ')
  }
  return path + 'Z'
}
