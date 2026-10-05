export type PageScrollPosition = { left: number; top: number }
export type PageScrollRequest = Partial<PageScrollPosition> & { hash?: string; behavior?: ScrollBehavior }

let container: HTMLElement | null = null
let pending: PageScrollRequest | null = null
let transitioning = false

export function getPageScrollPosition(): PageScrollPosition {
  return { left: container?.scrollLeft ?? 0, top: container?.scrollTop ?? 0 }
}

export function scrollPageTo(position: PageScrollRequest) {
  if (!container) return
  let top = position.top ?? 0
  if (position.hash) {
    let id = position.hash.slice(1)
    try { id = decodeURIComponent(id) } catch { /* Keep malformed hashes harmless. */ }
    const anchor = document.getElementById(id)
    if (anchor && container.contains(anchor)) {
      top = anchor.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 88
    }
  }
  const behavior = position.behavior === 'smooth' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto' : position.behavior ?? 'auto'
  container.scrollTo({ left: position.left ?? 0, top: Math.max(0, top), behavior })
}

function flushPageScroll() {
  if (!container || transitioning || !pending) return
  const request = pending
  pending = null
  scrollPageTo(request)
}

export function setPageScrollContainer(element: HTMLElement | null) {
  container = element
  flushPageScroll()
}

export function requestPageScroll(request: PageScrollRequest) {
  pending = request
  flushPageScroll()
}

export function beginPageScrollTransition() {
  transitioning = true
}

export function finishPageScrollTransition() {
  transitioning = false
  flushPageScroll()
}

export function cancelPageScrollTransition() {
  transitioning = false
  pending = null
}
