import { UI_TIMING } from '@/shared/constants/ui'
import { motionTimer } from '@/shared/utils/motionClock'

export type SheetSequencePhase = 'enter' | 'leave'
export type SheetVisualPhase = 'closed' | 'container-enter' | 'content-enter' | 'open' | 'content-leave' | 'container-leave'
const progress = (time: number, start: number, duration: number) => Math.max(0, Math.min(1, (time - start) / duration))
const out = (p: number) => 1 - (1 - p) ** 3
const mix = (a: number, b: number, p: number) => a + (b - a) * p
const lastDelay = (count: number) => Math.min(Math.max(0, count - 1), UI_TIMING.PAGE_SHEET_STAGGER_LIMIT) * UI_TIMING.PAGE_SHEET_CONTENT_STAGGER
export function sheetSequenceDuration(phase: SheetSequencePhase, count: number, reduced = false) {
  if (reduced) return 1
  return (phase === 'enter' ? UI_TIMING.PAGE_SHEET_ENTER : UI_TIMING.PAGE_SHEET_LEAVE)
    + (count ? phase === 'enter' ? UI_TIMING.PAGE_SHEET_CONTENT_ENTER : UI_TIMING.PAGE_SHEET_CONTENT_LEAVE : 0) + lastDelay(count)
}
export const PAGE_SHEET_CLOSE_BUDGET = sheetSequenceDuration('leave', UI_TIMING.PAGE_SHEET_STAGGER_LIMIT + 1)
export function sheetSequencePose(phase: SheetSequencePhase, time: number, index: number, count: number, reduced = false) {
  if (reduced) return { panel: 1, content: 1 }
  const rank = phase === 'enter' ? index : Math.max(0, count - 1 - index)
  const delay = Math.min(rank, UI_TIMING.PAGE_SHEET_STAGGER_LIMIT) * UI_TIMING.PAGE_SHEET_CONTENT_STAGGER
  const contentEnd = count ? UI_TIMING.PAGE_SHEET_CONTENT_LEAVE + lastDelay(count) : 0
  return phase === 'enter'
    ? { panel: out(progress(time, 0, UI_TIMING.PAGE_SHEET_ENTER)), content: out(progress(time, UI_TIMING.PAGE_SHEET_ENTER + delay, UI_TIMING.PAGE_SHEET_CONTENT_ENTER)) }
    : { panel: progress(time, contentEnd, UI_TIMING.PAGE_SHEET_LEAVE) ** 3, content: out(progress(time, delay, UI_TIMING.PAGE_SHEET_CONTENT_LEAVE)) }
}
function ownedStyles(el: HTMLElement) {
  const saved = new Map<string, [string, string]>()
  return {
    set(key: string, value: string) {
      if (!saved.has(key)) saved.set(key, [el.style.getPropertyValue(key), el.style.getPropertyPriority(key)])
      el.style.setProperty(key, value)
    },
    restore(except: string[] = []) {
      saved.forEach(([value, priority], key) => {
        if (except.includes(key)) return
        if (value) el.style.setProperty(key, value, priority)
        else el.style.removeProperty(key)
      })
    },
  }
}
export function createSheetSequence(panel: HTMLElement, backdrop: HTMLElement | null, close: HTMLElement | null,
  onPhase: (phase: SheetVisualPhase) => void, onComplete: (phase: SheetSequencePhase) => void, contentAnimated = true) {
  const panelStyles = ownedStyles(panel), backdropStyles = backdrop && ownedStyles(backdrop), closeStyles = close && ownedStyles(close)
  const groups = new Map<HTMLElement, { styles: ReturnType<typeof ownedStyles>; y: number; opacity: number; fromY: number; fromOpacity: number }>()
  let active: HTMLElement[] = [], panelY = 100, fromPanelY = 100
  let phase: SheetSequencePhase | null = null, reduced = false, disposed = false, closed = true
  let cancel: (() => void) | undefined
  function setPhase(value: SheetVisualPhase) {
    if (panel.dataset.sheetPhase !== value) { panel.dataset.sheetPhase = value; onPhase(value) }
  }
  function syncGroups() {
    if (!contentAnimated) { active = []; return }
    const marked = Array.from(panel.querySelectorAll<HTMLElement>('[data-sheet-motion]')).filter(el => {
      const parent = el.parentElement?.closest('[data-sheet-motion]')
      const bounds = el.getBoundingClientRect()
      return (!parent || !panel.contains(parent)) && bounds.width > 0 && bounds.height > 0
    })
    const next = marked.length ? marked : Array.from(panel.children).filter((el): el is HTMLElement => el instanceof HTMLElement)
    // Prime new groups before restoring a previously animated fallback wrapper.
    next.forEach((el, index) => {
      if (!groups.has(el)) {
        const y = phase === 'enter' ? 28 + index % 3 * 6 : 0
        const opacity = phase === 'enter' ? 0 : 1
        const styles = ownedStyles(el)
        styles.set('translate', `0 ${y}px`); styles.set('opacity', String(opacity)); styles.set('will-change', 'translate, opacity')
        groups.set(el, { styles, y, opacity, fromY: y, fromOpacity: opacity })
      }
    })
    active.filter(el => !next.includes(el)).forEach(el => groups.get(el)?.styles.restore())
    active = next
  }
  const observer = new MutationObserver(() => { if (phase === 'enter') syncGroups() })
  observer.observe(panel, { childList: true, subtree: true })
  function finish(which: SheetSequencePhase) {
    if (phase !== which || disposed) return
    cancel?.(); cancel = undefined
    phase = null; closed = which === 'leave'
    setPhase(closed ? 'closed' : 'open')
    if (!closed) {
      panelStyles.restore(); backdropStyles?.restore(); closeStyles?.restore()
      groups.forEach(group => group.styles.restore())
    } else groups.forEach(group => group.styles.restore(['translate', 'opacity']))
    onComplete(which)
  }
  function play(which: SheetSequencePhase, reduce = false) {
    if (disposed) return
    cancel?.(); phase = which; reduced = reduce; closed = false
    syncGroups()
    fromPanelY = panelY
    active.forEach(el => { const group = groups.get(el)!; group.fromY = group.y; group.fromOpacity = group.opacity })
    setPhase(which === 'enter' ? 'container-enter' : 'content-leave')
    const max = sheetSequenceDuration(which, UI_TIMING.PAGE_SHEET_STAGGER_LIMIT + 1, reduced)
    cancel = motionTimer(max, time => {
      if (phase !== which) return
      const pose = sheetSequencePose(which, time, 0, active.length, reduced)
      panelY = mix(fromPanelY, which === 'enter' ? 0 : 100, pose.panel)
      panelStyles.set('transform', `translate3d(0, ${panelY}%, 0)`)
      panelStyles.set('will-change', 'transform')
      backdropStyles?.set('opacity', String(1 - panelY / 100))
      closeStyles?.set('opacity', String(1 - panelY / 100)); closeStyles?.set('transform', `translateY(${-8 * panelY / 100}px)`)
      active.forEach((el, index) => {
        const group = groups.get(el)!, p = sheetSequencePose(which, time, index, active.length, reduced).content
        group.y = mix(group.fromY, which === 'enter' ? 0 : 28 + index % 3 * 6, p)
        group.opacity = mix(group.fromOpacity, which === 'enter' ? 1 : 0, p)
        group.styles.set('translate', `0 ${group.y}px`); group.styles.set('opacity', String(group.opacity))
      })
      const contentStart = UI_TIMING.PAGE_SHEET_ENTER
      const panelStart = active.length ? UI_TIMING.PAGE_SHEET_CONTENT_LEAVE + lastDelay(active.length) : 0
      if (which === 'enter' && time >= contentStart) setPhase('content-enter')
      if (which === 'leave' && time >= panelStart) setPhase('container-leave')
      if (time >= sheetSequenceDuration(which, active.length, reduced)) finish(which)
    }, () => finish(which))
  }
  return {
    play,
    dispose() {
      disposed = true; cancel?.(); observer.disconnect()
      // A closed panel must not flash back to its CSS open pose during Vue removal.
      const keep = closed ? ['transform', 'translate', 'opacity'] : []
      panelStyles.restore(keep); backdropStyles?.restore(keep); closeStyles?.restore(keep)
      groups.forEach(group => group.styles.restore(keep))
    },
  }
}
