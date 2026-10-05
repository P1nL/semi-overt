<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { HEADER_DOCK_LAYOUT_EVENT } from '@/shared/utils/headerDockLayout'
import { advanceDraftBungee, BUNGEE_EQUILIBRIUM, createDraftBungee, DRAFT_STAR_PATH, draftBungeeVisual, getDraftContentOpacity, type DraftBungeeState } from '../model/draftBungee'
import { getDraftPanelPlacement, getDraftStarPath } from '../model/draftStarMorph'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ open?: boolean; placement?: 'bottom' | 'left' }>()
const overlay = ref<SVGSVGElement | null>(null)
const cord = ref<SVGPathElement | null>(null)
const star = ref<SVGGElement | null>(null)
const shape = ref<SVGPathElement | null>(null)
const shield = ref<HTMLElement | null>(null)
const properties = ['transform', 'transform-origin', 'opacity', 'pointer-events', 'will-change', 'backdrop-filter', '-webkit-backdrop-filter', 'background', 'border-color', 'box-shadow', 'visibility']
type SavedStyle = [string, string, string][]
const saveStyle = (element: HTMLElement, names = properties): SavedStyle => names.map(name => [name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)])
function restoreStyle(element: HTMLElement, saved: SavedStyle) {
  for (const [name, value, priority] of saved) {
    if (value) element.style.setProperty(name, value, priority)
    else element.style.removeProperty(name)
  }
}
type Scene = { node: HTMLElement; saved: SavedStyle; children: { node: HTMLElement; saved: SavedStyle }[]; sourceX: number; sourceY: number; width: number; height: number; radius: number; dropLength: number; directionX: number; directionY: number; originY: number; nativeSurface: boolean }
type Run = { scene: Scene; state: DraftBungeeState; opening: boolean; done: () => void; last: number | null }
let scene: Scene | null = null
let run: Run | null = null
let interrupted: DraftBungeeState | undefined
let frame = 0
let media: MediaQueryList | undefined
let disposed = false
let sizeObserver: ResizeObserver | undefined
let contentObserver: MutationObserver | undefined
const placements = new Map<HTMLElement, SavedStyle>()
type Anchor = { node: HTMLElement; trigger: HTMLElement; surface: HTMLElement | null; host: HTMLElement | null; width: number }
let anchor: Anchor | null = null

function stopAnchorTracking() {
  anchor?.host?.removeEventListener(HEADER_DOCK_LAYOUT_EVENT, syncAnchor)
  anchor = null
}
function trackAnchor(node: HTMLElement, trigger: HTMLElement | undefined, surface: HTMLElement | null, width: number) {
  if (!trigger) { stopAnchorTracking(); return }
  const host = trigger.closest<HTMLElement>('[data-header-dock-enabled]')
  if (anchor?.host !== host || anchor?.node !== node) {
    stopAnchorTracking()
    host?.addEventListener(HEADER_DOCK_LAYOUT_EVENT, syncAnchor)
  }
  anchor = { node, trigger, surface, host, width }
}
function syncAnchor() {
  const current = anchor
  if (!current || disposed) return
  if (props.placement === 'left') {
    if (scene?.node === current.node) measure(current.node)
    else place(current.node)
    return
  }
  // One read batch per changed dock frame. Do not reset placement, panel size,
  // spring state, morph progress or the staggered content timeline here.
  const button = current.trigger.getBoundingClientRect()
  const edge = current.surface?.getBoundingClientRect()
  const bounds = current.node.getBoundingClientRect()
  const left = current.node.offsetLeft
  const margin = Number.parseFloat(current.node.style.marginTop) || 0
  const x = button.left + button.width / 2
  const y = edge?.bottom ?? button.bottom
  const dx = x - (bounds.left + bounds.width / 2)
  const dy = y + 12 - bounds.top
  if (Math.abs(dx) > 0.01) current.node.style.left = `${left + dx}px`
  if (Math.abs(dy) > 0.01) current.node.style.marginTop = `${margin + dy}px`
  placeShield({ left: bounds.left + dx, top: bounds.top + dy, width: bounds.width, height: bounds.height })
  if (scene?.node === current.node) {
    scene.sourceX = x
    scene.sourceY = y
  }
  if (overlay.value) {
    overlay.value.style.left = `${x - (current.width + 32) / 2}px`
    overlay.value.style.top = `${y - 16}px`
  }
}

function stopFrame() { cancelAnimationFrame(frame); frame = 0 }
function hideDecoration() { if (overlay.value) overlay.value.style.visibility = 'hidden' }
function hideShield() { if (shield.value) shield.value.style.visibility = 'hidden' }
function placeShield(bounds: { left: number; top: number; width: number; height: number }) {
  if (!shield.value) return
  Object.assign(shield.value.style, {
    left: `${bounds.left}px`, top: `${bounds.top}px`,
    width: `${bounds.width}px`, height: `${bounds.height}px`,
  })
}
function restoreScene() {
  if (!scene) return
  restoreStyle(scene.node, scene.saved)
  for (const child of scene.children) restoreStyle(child.node, child.saved)
  scene = null
}
function releasePlacement(element: Element) {
  const node = element as HTMLElement
  const saved = placements.get(node)
  if (anchor?.node === node) stopAnchorTracking()
  if (saved) restoreStyle(node, saved)
  placements.delete(node)
}
function cancel() {
  stopFrame()
  if (run) interrupted = { ...run.state }
  run = null
}
function complete() {
  const finished = run
  if (!finished) return
  stopFrame()
  run = null
  interrupted = undefined
  hideDecoration()
  hideShield()
  sizeObserver?.disconnect()
  contentObserver?.disconnect()
  finished.scene.node.inert = !finished.opening
  // Vue v-show applies display:none before the original styles are restored.
  finished.done()
  restoreScene()
}
function collectChildren(current: Scene) {
  const marked = [...current.node.querySelectorAll<HTMLElement>('[data-draft-reveal]')]
  const nodes = marked.length ? marked : [...current.node.children].filter((child): child is HTMLElement => child instanceof HTMLElement)
  const previous = current.children
  current.children = nodes.map(node => previous.find(child => child.node === node) ?? { node, saved: saveStyle(node, ['opacity', 'transform']) })
  for (const child of previous) if (!nodes.includes(child.node)) restoreStyle(child.node, child.saved)
}
function place(node: HTMLElement) {
  if (!placements.has(node)) placements.set(node, saveStyle(node, ['margin-top', 'left', 'right', 'width', 'max-height']))
  restoreStyle(node, placements.get(node)!)
  const trigger = [...document.querySelectorAll<HTMLElement>('[aria-controls]')].find(element => element.getAttribute('aria-controls') === node.id)
  const surface = node.closest<HTMLElement>('[data-panel-origin-surface]')
  const button = trigger?.getBoundingClientRect()
  const edge = surface && getComputedStyle(surface).pointerEvents !== 'none' ? surface.getBoundingClientRect() : null
  let bounds = node.getBoundingClientRect()
  const leftward = props.placement === 'left' && !!button
  const sourceX = button ? button.left + (leftward ? 0 : button.width / 2) : bounds.left + bounds.width / 2
  const sourceY = leftward ? button.top + button.height / 2 : edge?.bottom ?? button?.bottom ?? bounds.top - 12
  const placement = getDraftPanelPlacement(sourceX, bounds.width, window.innerWidth, leftward ? 'left' : 'bottom')
  node.style.width = `${placement.width}px`
  // Preserve panel height; only the viewport limits its scrollable content.
  const availableHeight = window.innerHeight - (leftward ? 0 : sourceY) - 24
  node.style.maxHeight = `min(34rem, ${Math.max(1, availableHeight)}px)`
  bounds = node.getBoundingClientRect()
  const left = node.offsetLeft + placement.left - bounds.left
  node.style.right = 'auto'
  node.style.left = `${left}px`
  const margin = Number.parseFloat(getComputedStyle(node).marginTop) || 0
  const top = leftward
    ? Math.max(12, Math.min(sourceY - bounds.height / 2, window.innerHeight - bounds.height - 12))
    : sourceY + 12
  node.style.marginTop = `${margin + top - bounds.top}px`
  bounds = node.getBoundingClientRect()
  trackAnchor(node, trigger, edge ? surface : null, bounds.width)
  return { sourceX, sourceY, bounds }
}
function measure(node: HTMLElement): Scene {
  if (!scene || scene.node !== node) {
    restoreScene()
    scene = { node, saved: saveStyle(node), children: [], sourceX: 0, sourceY: 0, width: 0, height: 0, radius: 28, dropLength: 0, directionX: 0, directionY: 1, originY: 0.5, nativeSurface: true }
  }
  node.style.transform = 'none'
  const { sourceX, sourceY, bounds } = place(node)
  placeShield(bounds)
  // The star stays level with the icon even when the panel shifts to fit the viewport.
  const originY = props.placement === 'left' ? (sourceY - bounds.top) / Math.max(1, bounds.height) : 0.5
  const dx = bounds.left + bounds.width / 2 - sourceX
  const dy = props.placement === 'left' ? 0 : bounds.top + bounds.height * originY - sourceY
  const dropLength = Math.hypot(dx, dy)
  Object.assign(scene, { sourceX, sourceY, width: bounds.width, height: bounds.height, radius: Number.parseFloat(getComputedStyle(node).borderTopLeftRadius) || 28, dropLength, directionX: dx / Math.max(1, dropLength), directionY: dy / Math.max(1, dropLength), originY })
  collectChildren(scene)
  node.style.transformOrigin = '50% 50%'
  if (overlay.value) {
    const width = bounds.width + 32
    const height = Math.max(220, scene.dropLength + bounds.height / 2 + 48)
    overlay.value.setAttribute('viewBox', `${-width / 2} -16 ${width} ${height}`)
    overlay.value.style.width = `${width}px`
    overlay.value.style.height = `${height}px`
    overlay.value.style.left = `${sourceX - width / 2}px`
    overlay.value.style.top = `${sourceY - 16}px`
    if (props.placement === 'left') {
      // Include the source and asymmetric panel, with room for spring overshoot.
      const left = Math.min(sourceX, bounds.left) - 64
      const top = Math.min(sourceY, bounds.top) - 64
      const right = Math.max(sourceX, bounds.right) + 64
      const bottom = Math.max(sourceY, bounds.bottom) + 64
      overlay.value.setAttribute('viewBox', `${left - sourceX} ${top - sourceY} ${right - left} ${bottom - top}`)
      Object.assign(overlay.value.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` })
    }
  }
  return scene
}
function refreshGeometry() {
  if (!run) return
  const current = measure(run.scene.node)
  run.state.equilibrium = current.dropLength
  if (run.state.openness > 0) run.state.y = current.dropLength
  paint(run)
}
function onResize() {
  if (run) refreshGeometry()
  else for (const node of placements.keys()) place(node)
}
function paint(active: Run) {
  const { state, opening, scene: current } = active
  const visual = draftBungeeVisual(state, opening)
  const node = current.node
  const nativeSurface = ['reveal', 'open', 'conceal'].includes(state.phase)
  if (current.nativeSurface !== nativeSurface) {
    current.nativeSurface = nativeSurface
    if (nativeSurface) syncAnchor()
    if (nativeSurface) restoreStyle(node, current.saved.filter(([name]) => ['background', 'border-color', 'box-shadow', 'backdrop-filter', '-webkit-backdrop-filter'].includes(name)))
    else {
      node.style.background = 'transparent'
      node.style.borderColor = 'transparent'
      node.style.boxShadow = 'none'
      node.style.backdropFilter = 'none'
      node.style.setProperty('-webkit-backdrop-filter', 'none')
    }
  }
  node.style.transform = 'none'
  node.style.opacity = '1'
  node.style.visibility = nativeSurface ? 'visible' : 'hidden'
  node.style.pointerEvents = nativeSurface ? 'auto' : 'none'
  // Until handoff, the inert/hidden panel cannot intercept pointer events.
  // Reserve its final hit area even while only the falling star is painted.
  if (shield.value) shield.value.style.visibility = 'visible'
  current.children.forEach((child, index) => {
    const opacity = getDraftContentOpacity(visual.contentOpacity, index)
    child.node.style.opacity = String(opacity)
    child.node.style.transform = `translateY(${8 * (1 - opacity)}px)`
  })
  if (overlay.value) overlay.value.style.visibility = nativeSurface ? 'hidden' : 'visible'
  if (cord.value) {
    const length = Math.max(0, state.y - 13)
    cord.value.setAttribute('d', `M 0 0 L ${current.directionX * length} ${current.directionY * length}`)
    cord.value.style.opacity = String(visual.lineOpacity * Math.min(1, state.y / 12))
  }
  if (star.value) {
    star.value.setAttribute('transform', `translate(${current.directionX * state.y} ${current.directionY * state.y}) scale(${visual.starScale})`)
    star.value.style.opacity = String(visual.starOpacity)
  }
  if (shape.value) {
    shape.value.setAttribute('d', getDraftStarPath(current.width, current.height, state.openness, current.radius, current.originY))
    shape.value.setAttribute('stroke-width', String(0.56 + 0.44 * state.openness))
    shape.value.style.fill = `color-mix(in srgb, var(--color-draft-star-fill) ${(1 - state.openness) * 100}%, var(--color-draft-panel-bg))`
    shape.value.style.stroke = `color-mix(in srgb, var(--color-draft-star-stroke) ${(1 - state.openness) * 100}%, var(--color-draft-panel-border))`
  }
}
function tick(time: number) {
  frame = 0
  const active = run
  if (!active || disposed) return
  const elapsed = active.last === null ? 0 : time - active.last
  active.last = time
  advanceDraftBungee(active.state, elapsed)
  paint(active)
  if (active.state.phase === 'open' || active.state.phase === 'closed') { complete(); return }
  frame = requestAnimationFrame(tick)
}
function play(element: Element, done: () => void, opening: boolean) {
  const node = element as HTMLElement
  cancel()
  // Auth/header remounts can deliver hooks for an unopened or detached panel.
  // Do not measure zero-layout anchors or start a phantom star return.
  if ((opening && props.open === false)
    || (!opening && !scene && !placements.has(node))
    || node.isConnected === false
    || (typeof node.getClientRects === 'function' && !node.getClientRects().length)) {
    interrupted = undefined
    hideDecoration()
    hideShield()
    node.inert = true
    done()
    restoreScene()
    releasePlacement(node)
    return
  }
  if (disposed || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    interrupted = undefined
    if (!disposed) place(node)
    hideDecoration()
    hideShield()
    node.inert = !opening
    done()
    restoreScene()
    return
  }
  const current = measure(node)
  const state = createDraftBungee(opening, interrupted, current.dropLength)
  interrupted = undefined
  run = { scene: current, state, opening, done, last: null }
  node.inert = true
  paint(run)
  sizeObserver?.observe(node)
  contentObserver?.observe(node, { childList: true, subtree: true })
  frame = requestAnimationFrame(tick)
}
const enter = (node: Element, done: () => void) => play(node, done, true)
const leave = (node: Element, done: () => void) => play(node, done, false)
function onVisibility() { if (document.hidden) complete() }
function onMotionChange() { if (media?.matches) complete() }
onMounted(() => {
  media = matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', onMotionChange)
  document.addEventListener('visibilitychange', onVisibility)
  sizeObserver = new ResizeObserver(refreshGeometry)
  contentObserver = new MutationObserver(refreshGeometry)
  if (run) {
    sizeObserver.observe(run.scene.node)
    contentObserver.observe(run.scene.node, { childList: true, subtree: true })
  }
  window.addEventListener('resize', onResize, { passive: true })
})
onBeforeUnmount(() => {
  disposed = true
  stopAnchorTracking()
  cancel()
  interrupted = undefined
  sizeObserver?.disconnect()
  contentObserver?.disconnect()
  restoreScene()
  hideDecoration()
  hideShield()
  for (const node of placements.keys()) releasePlacement(node)
  media?.removeEventListener('change', onMotionChange)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <Teleport to="body">
    <div ref="shield" class="draft-bungee-shield" data-title-effect-occluder data-draft-interaction-shield aria-hidden="true" @wheel.prevent />
    <svg ref="overlay" class="draft-bungee-decoration" viewBox="-100 -16 200 220" width="200" height="220" aria-hidden="true" focusable="false">
      <path ref="cord" class="draft-bungee-cord" fill="none" stroke-width="2" stroke-linecap="round" />
      <g ref="star"><path ref="shape" data-title-effect-occluder :d="DRAFT_STAR_PATH" class="draft-bungee-star" stroke-width="2" /></g>
    </svg>
  </Teleport>
  <Transition v-bind="$attrs" :css="false" @enter="enter" @leave="leave" @enter-cancelled="cancel" @leave-cancelled="cancel" @after-leave="releasePlacement">
    <slot />
  </Transition>
</template>

<style scoped>
.draft-bungee-shield {
  position: fixed;
  z-index: 50;
  visibility: hidden;
  pointer-events: auto;
  border-radius: var(--radius-xl);
  background: transparent;
}
.draft-bungee-decoration {
  position: fixed;
  z-index: 51;
  width: 200px;
  height: 220px;
  max-width: none;
  max-height: none;
  overflow: visible;
  pointer-events: none;
  visibility: hidden;
}
.draft-bungee-cord { stroke: var(--color-brand-logo-bg); }
.draft-bungee-star { pointer-events: visiblePainted; fill: var(--color-draft-star-fill); stroke: var(--color-draft-star-stroke); }
@media (forced-colors: active) {
  .draft-bungee-cord { stroke: CanvasText; }
  .draft-bungee-star { pointer-events: visiblePainted; fill: CanvasText; stroke: Canvas; }
}
</style>
