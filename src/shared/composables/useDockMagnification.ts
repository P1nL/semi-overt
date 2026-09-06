import { computed, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'

type DockItem = {
  slot: HTMLElement
  button: HTMLElement
  baseSize: number
  scale: number
  velocity: number
}

/** Distance-driven spring sizes. Slot widths reflow; the toolbar height stays fixed. */
export function useDockMagnification(root: Ref<HTMLElement | null>, enabled: Readonly<Ref<boolean>>) {
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine) and (min-width: 768px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const active = computed(() => enabled.value && finePointer.value && !reducedMotion.value)
  let items: DockItem[] = []
  let dirty = true
  let pointer: { x: number; y: number } | null = null
  let focused: HTMLElement | null = null
  let pressed = false
  let frame = 0
  let lastTime = 0
  let mutations: MutationObserver | undefined
  let host: HTMLElement | null = null
  const selector = '[data-header-dock-item]'

  function liftFor(scale: number) {
    return -6 * Math.max(0, (scale - 1) / 0.3)
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
  }

  function collectItems() {
    const previous = new Map(items.map(item => [item.slot, item]))
    items = Array.from(host?.querySelectorAll<HTMLElement>(selector) ?? []).flatMap(slot => {
      const button = slot.querySelector<HTMLElement>('[data-header-dock-button]')
      if (!button || !button.getClientRects().length) return []
      const previousItem = previous.get(slot)
      previous.delete(slot)
      return [{
        slot,
        button,
        baseSize: parseFloat(getComputedStyle(button).width),
        scale: previousItem?.scale ?? 1,
        velocity: previousItem?.velocity ?? 0,
      }]
    })
    for (const item of previous.values()) clearStyle(item)
    dirty = false
  }

  function tick(time: number) {
    frame = 0
    if (!active.value || pressed) return
    if (dirty) collectItems()
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.032) : 1 / 60
    lastTime = time

    // Read every position first, then write every width. Pointer events do no layout reads.
    const rects = items.map(item => item.button.getBoundingClientRect())
    // Retain the resting hit band when a button lifts away from a stationary pointer.
    const hitBands = rects.map((rect, index) => {
      const item = items[index]!
      const restingCenter = rect.y + rect.height / 2 - liftFor(item.scale)
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
    const insideDock = pointer && rects.length > 0
      && pointer.x >= Math.min(...rects.map(rect => rect.left)) - horizontalEntryPadding
      && pointer.x <= Math.max(...rects.map(rect => rect.right)) + horizontalEntryPadding
      && pointer.y >= Math.min(...hitBands.map(band => band.top))
      && pointer.y <= Math.max(...hitBands.map(band => band.bottom))
    const source = focusedRect
      ? { x: focusedRect.x + focusedRect.width / 2, y: focusedRect.y + focusedRect.height / 2 }
      : insideDock ? pointer : null
    let moving = false

    items.forEach((item, index) => {
      const rect = rects[index]!
      const distance = source ? Math.abs(source.x - (rect.x + rect.width / 2)) : Infinity
      const inRow = source && Math.abs(source.y - (rect.y + rect.height / 2)) < item.baseSize
      const proximity = inRow ? Math.min(distance / (item.baseSize * 3.2), 1) : 1
      const target = 1 + 0.3 * (1 + Math.cos(Math.PI * proximity)) / 2
      // Near-critical spring: softer lift/return, with bounded substeps after tab stalls.
      const steps = Math.ceil(dt / (1 / 120))
      const step = dt / steps
      for (let i = 0; i < steps; i++) {
        item.velocity += ((target - item.scale) * 180 - item.velocity * 26) * step
        item.scale = Math.max(0.94, Math.min(1.3, item.scale + item.velocity * step))
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
      item.slot.style.setProperty('--header-dock-lift', liftFor(item.scale).toFixed(3) + 'px')
    }
    if (host) host.dataset.headerDockRunning = String(moving)
    if (moving) requestTick()
    else lastTime = 0
  }

  function requestTick() {
    if (!frame && active.value && !pressed) frame = requestAnimationFrame(tick)
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || !active.value) return
    pointer = { x: event.clientX, y: event.clientY }
    focused = null
    requestTick()
  }

  function onPointerLeave() {
    pointer = null
    requestTick()
  }

  function onPointerDown(event: PointerEvent) {
    if (!(event.target instanceof Element) || !event.target.closest('[data-header-dock-button]')) return
    // Freeze geometry while clicking/long-pressing so the hit target cannot move away.
    pressed = true
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

  onMounted(() => {
    host = root.value
    if (!host) return
    host.dataset.headerDockEnabled = String(active.value)
    host.addEventListener('pointermove', onPointerMove)
    host.addEventListener('pointerleave', onPointerLeave)
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
    reset()
    mutations?.disconnect()
    host?.removeEventListener('pointermove', onPointerMove)
    host?.removeEventListener('pointerleave', onPointerLeave)
    host?.removeEventListener('pointerdown', onPointerDown, true)
    host?.removeEventListener('focusin', onFocusIn)
    host?.removeEventListener('focusout', onFocusOut)
    window.removeEventListener('pointerup', onPointerUp, true)
    window.removeEventListener('pointercancel', onPointerUp, true)
    window.removeEventListener('blur', reset)
    window.removeEventListener('resize', onResize)
  })
}
