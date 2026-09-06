import { computed, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'

type DockItem = {
  slot: HTMLElement
  button: HTMLElement
  baseSize: number
  maxScale: number
  scale: number
  velocity: number
}

type DockBounds = { left: number; right: number; top: number; bottom: number }

/** Distance-driven spring sizes. Slot widths reflow; the toolbar height stays fixed. */
export function useDockMagnification(
  root: Ref<HTMLElement | null>,
  enabled: Readonly<Ref<boolean>>,
  interactionOpen: Readonly<Ref<boolean>>,
) {
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine) and (min-width: 768px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const active = computed(() => enabled.value && finePointer.value && !reducedMotion.value)
  let items: DockItem[] = []
  let dirty = true
  let pointer: { x: number; y: number } | null = null
  let focused: HTMLElement | null = null
  let pressed = false
  let bounds: DockBounds | null = null
  let clickHold: DockBounds | null = null
  let frame = 0
  let lastTime = 0
  let mutations: MutationObserver | undefined
  let host: HTMLElement | null = null
  const selector = '[data-header-dock-item]'

  function contains(point: { x: number; y: number }, region: DockBounds | null) {
    return region !== null && point.x >= region.left && point.x <= region.right
      && point.y >= region.top && point.y <= region.bottom
  }

  function liftFor(item: DockItem) {
    return -6 * Math.max(0, (item.scale - 1) / (item.maxScale - 1))
  }

  function clearStyle(item: DockItem) {
    item.slot.style.removeProperty('--header-dock-width')
    item.slot.style.removeProperty('--header-dock-scale')
    item.slot.style.removeProperty('--header-dock-lift')
  }

  function stopFrame() {
    cancelAnimationFrame(frame)
    frame = 0
    lastTime = 0
    if (host) host.dataset.headerDockRunning = 'false'
  }

  function reset() {
    stopFrame()
    for (const item of items) clearStyle(item)
    items = []
    dirty = true
    pointer = null
    focused = null
    pressed = false
    bounds = null
    clickHold = null
  }

  function returnToRest() {
    // Search expansion is an explicit exception to click-to-hold. Keep current
    // values and let the same spring return them, rather than clearing styles.
    clickHold = null
    pointer = null
    focused = null
    for (const item of items) item.velocity = 0
    requestTick()
  }

  function collectItems() {
    const previous = new Map(items.map(item => [item.slot, item]))
    items = Array.from(host?.querySelectorAll<HTMLElement>(selector) ?? []).flatMap(slot => {
      const button = slot.querySelector<HTMLElement>('[data-header-dock-button]')
      if (!button || !button.getClientRects().length) return []
      const previousItem = previous.get(slot)
      previous.delete(slot)
      const requestedScale = Number(slot.dataset.headerDockMaxScale ?? 1.3)
      return [{
        slot,
        button,
        baseSize: parseFloat(getComputedStyle(button).width),
        maxScale: Number.isFinite(requestedScale) && requestedScale > 1 && requestedScale <= 2 ? requestedScale : 1.3,
        scale: previousItem?.scale ?? 1,
        velocity: previousItem?.velocity ?? 0,
      }]
    })
    for (const item of previous.values()) clearStyle(item)
    dirty = false
  }

  function tick(time: number) {
    frame = 0
    if (!active.value || pressed || clickHold) return
    if (dirty) collectItems()
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.032) : 1 / 60
    lastTime = time

    // Read every position first, then write every width. Pointer events do no layout reads.
    const rects = items.map(item => item.button.getBoundingClientRect())
    // Retain the resting hit band when a button lifts away from a stationary pointer.
    const hitBands = rects.map((rect, index) => {
      const item = items[index]!
      const restingCenter = rect.y + rect.height / 2 - liftFor(item)
      return {
        top: Math.min(rect.top, restingCenter - item.baseSize / 2),
        bottom: Math.max(rect.bottom, restingCenter + item.baseSize / 2),
      }
    })
    const focusedIndex = items.findIndex(item => item.button === focused)
    const focusedRect = focusedIndex >= 0 ? rects[focusedIndex] : undefined
    // Allow a small horizontal approach zone without expanding the vertical hit region.
    // Keep the small gaps inside the group active so moving between neighbors is continuous.
    const horizontalEntryPadding = 12
    bounds = rects.length ? {
      left: Math.min(...rects.map(rect => rect.left)) - horizontalEntryPadding,
      right: Math.max(...rects.map(rect => rect.right)) + horizontalEntryPadding,
      top: Math.min(...hitBands.map(band => band.top)),
      bottom: Math.max(...hitBands.map(band => band.bottom)),
    } : null
    const insideDock = pointer && contains(pointer, bounds) && !interactionOpen.value
    const source = interactionOpen.value ? null : focusedRect
      ? { x: focusedRect.x + focusedRect.width / 2, y: focusedRect.y + focusedRect.height / 2 }
      : insideDock ? pointer : null
    let moving = false

    items.forEach((item, index) => {
      const rect = rects[index]!
      const distance = source ? Math.abs(source.x - (rect.x + rect.width / 2)) : Infinity
      const inRow = source && Math.abs(source.y - (rect.y + rect.height / 2)) < item.baseSize
      const proximity = inRow ? Math.min(distance / (item.baseSize * 3.2), 1) : 1
      const target = 1 + (item.maxScale - 1) * (1 + Math.cos(Math.PI * proximity)) / 2
      // Near-critical spring: softer lift/return, with bounded substeps after tab stalls.
      const steps = Math.ceil(dt / (1 / 120))
      const step = dt / steps
      for (let i = 0; i < steps; i++) {
        item.velocity += ((target - item.scale) * 180 - item.velocity * 26) * step
        item.scale = Math.max(0.94, Math.min(item.maxScale, item.scale + item.velocity * step))
      }
      if (Math.abs(target - item.scale) < 0.0005 && Math.abs(item.velocity) < 0.003) {
        item.scale = target
        item.velocity = 0
      } else {
        moving = true
      }
    })

    for (const item of items) {
      item.slot.style.setProperty('--header-dock-width', (item.baseSize * item.scale).toFixed(3) + 'px')
      item.slot.style.setProperty('--header-dock-scale', item.scale.toFixed(4))
      item.slot.style.setProperty('--header-dock-lift', liftFor(item).toFixed(3) + 'px')
    }
    if (host) host.dataset.headerDockRunning = String(moving)
    if (moving) requestTick()
    else lastTime = 0
  }

  function requestTick() {
    if (!frame && active.value && !pressed && !clickHold) frame = requestAnimationFrame(tick)
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || !active.value) return
    const next = { x: event.clientX, y: event.clientY }
    // Track physical coordinates even over a dialog/backdrop. DOM pointerleave can
    // fire when a popup opens under a stationary mouse and must not cancel hover.
    if (clickHold) {
      if (contains(next, clickHold)) return
      clickHold = null
      for (const item of items) item.velocity = 0
    }
    pointer = interactionOpen.value ? null : next
    focused = null
    // Do not measure the navigation on every unrelated page mousemove.
    if (!bounds || contains(next, bounds) || items.some(item => Math.abs(item.scale - 1) > 0.0001)) requestTick()
  }

  function onDocumentPointerOut(event: PointerEvent) {
    // A modal making the header inert can also emit pointerout with no relatedTarget.
    // Only treat an actual viewport exit as leaving; popup-induced events stay held.
    if (event.relatedTarget !== null || (event.clientX > 0 && event.clientX < window.innerWidth
      && event.clientY > 0 && event.clientY < window.innerHeight)) return
    clickHold = null
    pointer = null
    requestTick()
  }

  function onPointerDown(event: PointerEvent) {
    if (!active.value || event.button !== 0 || !(event.target instanceof Element)
      || !event.target.closest('[data-header-dock-button]')) return
    // Freeze geometry while clicking/long-pressing so the hit target cannot move away.
    pressed = true
    clickHold = bounds ? { ...bounds } : null
    for (const item of items) item.velocity = 0
    stopFrame()
  }

  function onPointerUp() {
    if (!pressed) return
    pressed = false
    requestTick()
  }

  function onFocusIn(event: FocusEvent) {
    if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-header-dock-button]:focus-visible')) return
    focused = event.target
    pointer = null
    requestTick()
  }

  function onFocusOut() {
    focused = null
    requestTick()
  }

  function onResize() {
    reset()
  }

  const stopWatching = watch(active, value => {
    if (host) host.dataset.headerDockEnabled = String(value)
    reset()
  })

  const stopWatchingInteraction = watch(interactionOpen, open => {
    // Opening a search/menu is not leaving the dock: preserve the clicked pose.
    // Once the pointer actually leaves, return softly and don't react behind a popup.
    if (open) {
      focused = null
      if (!clickHold) pointer = null
    }
    requestTick()
  })

  onMounted(() => {
    host = root.value
    if (!host) return
    host.dataset.headerDockEnabled = String(active.value)
    window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true })
    document.addEventListener('pointerout', onDocumentPointerOut)
    host.addEventListener('pointerdown', onPointerDown, true)
    host.addEventListener('focusin', onFocusIn)
    host.addEventListener('focusout', onFocusOut)
    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('pointercancel', onPointerUp, true)
    window.addEventListener('blur', reset)
    window.addEventListener('resize', onResize)
    mutations = new MutationObserver(records => {
      const relevant = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node =>
        node instanceof Element && (node.matches(selector + ', [data-header-dock-button]')
          || node.querySelector(selector + ', [data-header-dock-button]')),
      ))
      if (relevant) {
        dirty = true
        requestTick()
      }
    })
    mutations.observe(host, { childList: true, subtree: true })
  })

  onBeforeUnmount(() => {
    stopWatching()
    stopWatchingInteraction()
    reset()
    mutations?.disconnect()
    window.removeEventListener('pointermove', onPointerMove, true)
    document.removeEventListener('pointerout', onDocumentPointerOut)
    host?.removeEventListener('pointerdown', onPointerDown, true)
    host?.removeEventListener('focusin', onFocusIn)
    host?.removeEventListener('focusout', onFocusOut)
    window.removeEventListener('pointerup', onPointerUp, true)
    window.removeEventListener('pointercancel', onPointerUp, true)
    window.removeEventListener('blur', reset)
    window.removeEventListener('resize', onResize)
  })

  return { returnToRest }
}
