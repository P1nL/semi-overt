import { createFrameLimiter } from './animationFrame'

type LayoutElement = Pick<HTMLElement, 'getBoundingClientRect'>
export type PressureFrame = { rect: (element: LayoutElement) => DOMRect }
export type PressureUpdate = {
  prepare: () => void
  measure: (time: number, frame: PressureFrame) => void
  mutate: () => boolean
}
type FrameDriver = {
  requestFrame: (callback: FrameRequestCallback) => number
  cancelFrame: (id: number) => void
}

/** One 60Hz batch: calibration writes -> all geometry reads -> all weight writes. */
export function createTextPressureScheduler(driver: FrameDriver = {
  requestFrame: callback => requestAnimationFrame(callback),
  cancelFrame: id => cancelAnimationFrame(id),
}) {
  const pending = new Set<PressureUpdate>()
  const limiter = createFrameLimiter(60)
  let frameId = 0
  function request(update: PressureUpdate) {
    pending.add(update)
    if (!frameId) frameId = driver.requestFrame(tick)
  }
  function cancel(update: PressureUpdate) {
    pending.delete(update)
    if (!pending.size) {
      driver.cancelFrame(frameId)
      frameId = 0
      limiter.reset()
    }
  }
  function tick(time: number) {
    frameId = 0
    if (limiter.consume(time) === null) {
      if (pending.size) frameId = driver.requestFrame(tick)
      return
    }
    const updates = [...pending]
    pending.clear()
    const rects = new Map<LayoutElement, DOMRect>()
    const frame: PressureFrame = {
      rect(element) {
        let value = rects.get(element)
        if (!value) { value = element.getBoundingClientRect(); rects.set(element, value) }
        return value
      },
    }
    // No component may write weight between another component's geometry reads.
    updates.forEach(update => update.prepare())
    updates.forEach(update => update.measure(time, frame))
    updates.forEach(update => { if (update.mutate()) pending.add(update) })
    if (pending.size && !frameId) frameId = driver.requestFrame(tick)
  }
  return { request, cancel }
}

export const textPressureScheduler = createTextPressureScheduler()
