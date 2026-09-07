<script setup lang="ts">
import { onBeforeUnmount, useId } from 'vue'
import { liquidSurfaceFrame } from '@/shared/utils/liquidPanelGeometry'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ variant?: 'drop' | 'search'; anchor?: 'center' | 'right' }>(), { variant: 'drop', anchor: 'center' })
const enabled = import.meta.env.VITE_NAV_LIQUID_MOTION !== 'false'
  && !(import.meta.env.DEV && new URLSearchParams(location.search).get('navMotion') === 'legacy')
const clipId = `liquid-surface-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
const interrupted = new WeakMap<HTMLElement, number>()
type Run = { driver: Animation; frame: number; progress: number; dispose: () => void }
const running = new Map<HTMLElement, Run>()
type Placement = { update: () => void; sourceX: () => number; release: () => void }
const placements = new Map<HTMLElement, Placement>()

function placeBelowHeader(node: HTMLElement) {
  const existing = placements.get(node)
  if (existing) { existing.update(); return existing }
  const header = node.closest<HTMLElement>('[data-panel-origin-surface]')
  if (!header || getComputedStyle(header).pointerEvents === 'none') return null
  const trigger = [...document.querySelectorAll<HTMLElement>('[aria-controls]')]
    .find(item => item.getAttribute('aria-controls') === node.id)
  const oldMargin = node.style.getPropertyValue('margin-top')
  const priority = node.style.getPropertyPriority('margin-top')
  let headerWidth = 0, sourceRatio = 0.5
  const update = () => {
    const bounds = node.getBoundingClientRect(), edge = header.getBoundingClientRect()
    if (!bounds.height || !edge.width) return
    if (Math.abs(edge.width-headerWidth)>0.5) {
      const button = trigger?.getBoundingClientRect()
      sourceRatio = button ? (button.left+button.width/2-edge.left)/edge.width : 0.5
      headerWidth = edge.width
    }
    const scale = bounds.height/Math.max(1,node.offsetHeight)
    const delta = edge.bottom + 12*scale - bounds.top
    if (Math.abs(delta)>0.1) {
      const margin = Number.parseFloat(getComputedStyle(node).marginTop)||0
      node.style.setProperty('margin-top', String(margin+delta/scale)+'px')
    }
  }
  const observer = new ResizeObserver(update)
  observer.observe(header)
  window.addEventListener('resize', update, { passive: true })
  const placement: Placement = { update, sourceX: () => {
    const bounds=header.getBoundingClientRect()
    return bounds.left+sourceRatio*bounds.width
  }, release: () => {
    observer.disconnect()
    window.removeEventListener('resize', update)
    if (oldMargin) node.style.setProperty('margin-top',oldMargin,priority)
    else node.style.removeProperty('margin-top')
  } }
  placements.set(node,placement)
  update()
  return placement
}
function releasePlacement(el: Element) {
  const node=el as HTMLElement
  placements.get(node)?.release()
  placements.delete(node)
}

function cancel(el: Element) {
  const node = el as HTMLElement, run = running.get(node)
  if (!run) return
  run.driver.onfinish = null
  run.driver.cancel()
  cancelAnimationFrame(run.frame)
  run.dispose()
  running.delete(node)
}
function rememberAndCancel(el: Element) {
  const node = el as HTMLElement, run = running.get(node)
  if (run) interrupted.set(node, run.progress)
  cancel(el)
}

function play(el: Element, done: () => void, entering: boolean) {
  const node = el as HTMLElement
  const start = interrupted.get(node) ?? (entering ? 0 : 1), end = entering ? 1 : 0
  interrupted.delete(node)
  cancel(node)
  node.inert = !entering
  const placement = placeBelowHeader(node)
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !node.animate) { done(); return }

  const style = getComputedStyle(node)
  const radius = Number.parseFloat(style.borderTopLeftRadius) || 20
  const material = { background: style.background, backdropFilter: style.backdropFilter }
  const properties = ['background', 'backdrop-filter', '-webkit-backdrop-filter', 'box-shadow', 'border-color', 'overflow', 'isolation']
  const originals = properties.map(name => [name, node.style.getPropertyValue(name), node.style.getPropertyPriority(name)] as const)
  const restoreSurface = () => originals.forEach(([name, value, priority]) => {
    if (value) node.style.setProperty(name, value, priority)
    else node.style.removeProperty(name)
  })
  const children = [...node.children].filter((child): child is HTMLElement => child instanceof HTMLElement)
    .map(child => ({ child, opacity: child.style.opacity, transform: child.style.transform }))
  const ns = 'http://www.w3.org/2000/svg'
  const defs = document.createElementNS(ns, 'svg')
  defs.setAttribute('aria-hidden', 'true')
  defs.setAttribute('width', '0')
  defs.setAttribute('height', '0')
  defs.style.position = 'absolute'
  const clip = document.createElementNS(ns, 'clipPath')
  clip.id = clipId
  clip.setAttribute('clipPathUnits', 'objectBoundingBox')
  const path = document.createElementNS(ns, 'path')
  clip.append(path)
  defs.append(clip)
  const surface = document.createElement('div')
  surface.className = 'liquid-panel-visual-surface'
  surface.setAttribute('aria-hidden', 'true')
  Object.assign(surface.style, {
    position: 'absolute', left: '0', width: '100%', pointerEvents: 'none', zIndex: '-1',
    background: material.background, backdropFilter: material.backdropFilter,
    clipPath: `url(#${clipId})`,
  })
  node.append(defs, surface)
  const trigger = node.id ? [...document.querySelectorAll<HTMLElement>('[aria-controls]')]
    .find(item => item.getAttribute('aria-controls') === node.id) : null
  const originSurface = node.closest<HTMLElement>('[data-panel-origin-surface]')
  const slow = import.meta.env.DEV && new URLSearchParams(location.search).get('motionSpeed') === 'slow' ? 3 : 1
  const duration = Math.max(100, (entering ? 540 : 420) * Math.abs(end-start)) * slow
  // WAAPI supplies a pauseable timeline; only the decorative surface is shaped.
  const driver = surface.animate([{ opacity: 1 }, { opacity: 1 }], { duration, fill: 'both' })
  let nativeSurface = true
  const run: Run = { driver, frame: 0, progress: start, dispose: () => {
    restoreSurface()
    children.forEach(({ child, opacity, transform }) => { child.style.opacity = opacity; child.style.transform = transform })
    surface.remove()
    defs.remove()
    delete node.dataset.liquidProgress
    delete node.dataset.liquidOriginX
    delete node.dataset.liquidOriginY
  } }
  const render = (progress: number) => {
    run.progress = progress
    // Offset dimensions describe the local CSS box; objectBoundingBox keeps the
    // contour aligned even with individual translate, browser zoom or resizing.
    placement?.update()
    const w = node.offsetWidth, h = node.offsetHeight, bounds = node.getBoundingClientRect()
    const triggerBounds = trigger?.getBoundingClientRect()
    const scaleX = bounds.width / Math.max(1, w), scaleY = bounds.height / Math.max(1, h)
    const anchor = placement ? (placement.sourceX()-bounds.left)/scaleX : triggerBounds ? (triggerBounds.left + triggerBounds.width/2 - bounds.left) / scaleX
      : props.anchor === 'right' ? w-24 : w/2
    const headerBounds = originSurface?.getBoundingClientRect()
    // In ZEN the header has no visual surface; fall back to the panel's own top.
    const headerVisible = originSurface && getComputedStyle(originSurface).pointerEvents !== 'none'
    const sourceY = !headerVisible || !headerBounds ? bounds.top : headerBounds.bottom
    const gap = (bounds.top-sourceY)/scaleY
    const shape = liquidSurfaceFrame(w, h, anchor, progress, gap, props.variant, radius)
    node.dataset.liquidProgress = progress.toFixed(4)
    node.dataset.liquidOriginX = String(bounds.left + shape.origin.x*scaleX)
    node.dataset.liquidOriginY = String(bounds.top + shape.origin.y*scaleY)
    path.setAttribute('d', shape.path)
    surface.style.top = `${-Math.max(0,gap)}px`
    surface.style.height = `calc(100% + ${Math.max(0,gap)}px)`
    surface.style.visibility = shape.fullSurface ? 'hidden' : 'visible'
    if (nativeSurface !== shape.fullSurface) {
      nativeSurface = shape.fullSurface
      if (nativeSurface) restoreSurface()
      else {
        node.style.background = 'transparent'
        node.style.backdropFilter = 'none'
        node.style.setProperty('-webkit-backdrop-filter', 'none')
        node.style.boxShadow = 'none'
        node.style.borderColor = 'transparent'
        node.style.overflow = 'visible'
        node.style.isolation = 'isolate'
      }
    }
    children.forEach(({ child, transform }) => {
      child.style.opacity = String(shape.contentOpacity)
      child.style.transform = shape.contentOpacity === 1 ? transform : `translateY(${(1-shape.contentOpacity)*4}px)`
    })
  }
  const tick = () => {
    if (running.get(node) !== run) return
    const time = Math.max(0, Math.min(1, Number(driver.currentTime ?? 0)/duration))
    const eased = time*time*(3-2*time)
    render(start + (end-start)*eased)
    run.frame = requestAnimationFrame(tick)
  }
  running.set(node, run)
  render(start)
  run.frame = requestAnimationFrame(tick)
  driver.onfinish = () => {
    if (running.get(node) !== run) return
    cancel(node)
    done()
  }
}
const hooks = enabled ? {
  onEnter: (el: Element, done: () => void) => play(el, done, true),
  onLeave: (el: Element, done: () => void) => play(el, done, false),
  onEnterCancelled: rememberAndCancel,
  onLeaveCancelled: rememberAndCancel,
  onAfterLeave: releasePlacement,
} : {}
onBeforeUnmount(() => {
  for (const node of running.keys()) cancel(node)
  for (const node of placements.keys()) releasePlacement(node)
})
</script>

<template>
  <Transition v-bind="{ ...$attrs, ...hooks }" :css="!enabled">
    <slot />
  </Transition>
</template>
