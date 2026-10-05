export const EDITOR_SIDE_PREVIEW_MS = 5_000

type TimerDriver = {
  schedule: (callback: () => void, delay: number) => number
  cancel: (id: number) => void
}

/** One introductory preview per editor instance; manual toggles own it afterwards. */
export function createEditorSidePanelPreview(collapse: () => void, driver: TimerDriver = {
  schedule: (callback, delay) => window.setTimeout(callback, delay),
  cancel: id => window.clearTimeout(id),
}) {
  let timer: number | null = null
  let claimed = false
  let disposed = false
  let generation = 0
  function clear() {
    generation++
    if (timer !== null) driver.cancel(timer)
    timer = null
  }
  return {
    start() {
      if (claimed || disposed || timer !== null) return
      const run = ++generation
      timer = driver.schedule(() => {
        if (disposed || claimed || run !== generation) return
        timer = null
        claimed = true
        collapse()
      }, EDITOR_SIDE_PREVIEW_MS)
    },
    takeControl() { claimed = true; clear() },
    dispose() { disposed = true; clear() },
  }
}
