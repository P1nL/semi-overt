type ResultViewMode = 'infinite' | 'list'
export const VIEW_SWITCH_DURATION = { list: 1500, infinite: 1100 } as const
export interface ViewPose { press: number; infiniteOpacity: number; infiniteScale: number; listX: number }
const ease = (time: number, start: number, duration: number) => 1 - (1 - Math.max(0, Math.min(1, (time - start) / duration))) ** 3
const mix = (a: number, b: number, p: number) => a + (b - a) * p
export function viewSwitchPose(target: ResultViewMode, time: number, from: ViewPose): ViewPose {
  if (target === 'list') {
    // Request a real held state immediately. The renderer owns its original
    // damping curve; do not apply a second easing to the camera target.
    // Give native damping 500ms to settle, then retain a 100ms visible hold.
    const recede = ease(time, 600, 350)
    const slide = ease(time, 950, 550)
    return { press: 1, infiniteOpacity: mix(from.infiniteOpacity, 0, recede), infiniteScale: mix(from.infiniteScale, .88, recede), listX: mix(from.listX, 0, slide) }
  }
  return {
    press: time < 400 ? from.press : 0,
    infiniteOpacity: mix(from.infiniteOpacity, 1, ease(time, 0, 500)),
    infiniteScale: mix(from.infiniteScale, 1, ease(time, 0, 500)),
    listX: mix(from.listX, -1, ease(time, 0, 700)),
  }
}
