export interface ResultCardMotion { mainScale: number; othersOpacity: number }
const states = new WeakMap<HTMLCanvasElement, ResultCardMotion>()
export function setResultCardMotion(canvas: HTMLCanvasElement, state: ResultCardMotion) {
  // DOM readiness is not GPU readiness: the buffer may still contain a full-size
  // static card until the renderer consumes this first transition state.
  if (!states.has(canvas)) canvas.dataset.resultMotionPending = ''
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
