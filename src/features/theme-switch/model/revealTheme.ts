import { nextTick } from 'vue'

let switching = false

/** Reveal the complete new theme from the actual button, with a plain fallback. */
export async function revealTheme(button: HTMLElement | null, commit: (instant: boolean) => void) {
  if (switching) return
  if (!button || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    commit(false)
    return
  }
  switching = true
  const root = document.documentElement
  const origin = button.querySelector<HTMLElement>('.theme-switch-button') ?? button
  let x = 0, y = 0, radius = 0
  const measureOrigin = () => {
    const bounds = origin.getBoundingClientRect()
    x = bounds.left + bounds.width / 2
    y = bounds.top + bounds.height / 2
    radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 2
    root.style.setProperty('--theme-reveal-x', `${x / innerWidth * 100}%`)
    root.style.setProperty('--theme-reveal-y', `${y / innerHeight * 100}%`)
  }
  let committed = false
  let transition: ViewTransition | undefined
  let reveal: Animation | undefined
  try {
    measureOrigin()
    root.classList.add('theme-revealing')
    transition = document.startViewTransition(async () => {
      commit(true)
      committed = true
      await nextTick()
      // Use the visual icon position in the layout captured for the new theme.
      measureOrigin()
    })
    await transition.ready
    // Relative geometry avoids compositor pixel-scaling drift on HiDPI webviews.
    const center = `${x / innerWidth * 100}% ${y / innerHeight * 100}%`
    const radiusPercent = radius / (Math.hypot(innerWidth, innerHeight) / Math.SQRT2) * 100
    reveal = root.animate(
      { clipPath: [`circle(0% at ${center})`, `circle(${radiusPercent}% at ${center})`] },
      { duration: 760, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)', fill: 'both' },
    )
    await reveal.finished
    await transition.finished
  } catch {
    transition?.skipTransition()
    if (!committed) commit(false)
  } finally {
    reveal?.cancel()
    root.classList.remove('theme-revealing')
    root.style.removeProperty('--theme-reveal-x')
    root.style.removeProperty('--theme-reveal-y')
    switching = false
  }
}
