export interface ResultCardMotion { mainScale: number; othersOpacity: number }
const states = new WeakMap<HTMLCanvasElement, ResultCardMotion>()
export function setResultCardMotion(canvas: HTMLCanvasElement, state: ResultCardMotion, waitForRender = state.mainScale < 1) {
  // An entrance's first local clock can already be a fraction past zero.
  // Gate that stale full-size buffer explicitly, not by exact scale equality.
  // Leave keeps its valid last frame visible even if its first clock is nonzero.
  if (!states.has(canvas) && waitForRender) canvas.dataset.resultMotionPending = ''
  states.set(canvas, state)
  if (import.meta.env.DEV) {
    canvas.dataset.mainCardScale = state.mainScale.toFixed(4)
    canvas.dataset.otherCardsOpacity = state.othersOpacity.toFixed(4)
  }
}
export function getResultCardMotion(canvas: HTMLCanvasElement) { return states.get(canvas) }
export function markResultCardMotionRendered(canvas: HTMLCanvasElement, state: ResultCardMotion | undefined) {
  if (!state || states.get(canvas) !== state) return
  delete canvas.dataset.resultMotionPending
  if (import.meta.env.DEV) canvas.dataset.renderedMainScale = state.mainScale.toFixed(4)
}
export function clearResultCardMotion(canvas: HTMLCanvasElement) {
  states.delete(canvas)
  delete canvas.dataset.mainCardScale
  delete canvas.dataset.otherCardsOpacity
  delete canvas.dataset.resultMotionPending
  delete canvas.dataset.renderedMainScale
}
