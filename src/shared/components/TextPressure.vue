<script setup lang="ts">
// Vue Bits TextPressure proximity response using the real variable-weight axis.
// Fixed glyph slots keep adjacent content (such as the hero eye) stationary.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { isTitleEffectOccluded } from '@/shared/utils/titleEffectOcclusion'
import { getPressureWeight, isPressureTriggerTarget } from '@/shared/utils/textPressure'
import { textPressureScheduler, type PressureFrame } from '@/shared/utils/textPressureScheduler'

const props = withDefaults(defineProps<{ text: string; peakOffsets?: number[]; containerRef?: HTMLElement | null; pointerRegion?: (point: { x: number; y: number }) => boolean }>(), { peakOffsets: () => [] })
const letters = computed(() => Array.from(props.text))
const rootRef = ref<HTMLElement | null>(null)
const glyphRefs = ref<Array<HTMLElement | null>>([])
let pointer: { x: number; y: number } | null = null
let cursor: { x: number; y: number } | null = null
let weights: number[] = []
let writtenWeights: string[] = []
let measuredWidths: number[] | null = null
let measuredTargets: number[] = []
let smoothing = 0
let moving = false
let lastTime = 0
let geometryDirty = true
let observer: ResizeObserver | undefined
let reducedMotion: MediaQueryList | undefined
let disposed = false
let exitTimer: number | null = null
const POINTER_EXIT_DELAY_MS = 120
const POINTER_DEAD_ZONE_PX = 3

function clearExitTimer() {
  if (exitTimer !== null) window.clearTimeout(exitTimer)
  exitTimer = null
}
function requestExit() {
  // Do not restart the timer for every move outside text: release remains bounded.
  if (!pointer || exitTimer !== null) return
  exitTimer = window.setTimeout(() => { exitTimer = null; reset() }, POINTER_EXIT_DELAY_MS)
}

function schedule() {
  if (!disposed) textPressureScheduler.request(update)
}
function invalidate() { geometryDirty = true; schedule() }
function move(event: PointerEvent) {
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
  if (reducedMotion?.matches) return
  const container = props.containerRef ?? rootRef.value
  if (!container) return
  // Orbit titles supply a continuous group region; standalone text keeps its
  // existing glyph/eye hit test rather than activating the whole heading.
  const target = event.target instanceof Element ? event.target : null
  const point = { x: event.clientX, y: event.clientY }
  // Do not measure the orbit while the pointer is over cards or other UI.
  // Descendant glyphs and heading whitespace still use the continuous region.
  if (props.pointerRegion && (!target || !container.contains(target))) {
    requestExit()
    return
  }
  if (isTitleEffectOccluded(event, document)) {
    reset()
    return
  }
  if (!(props.pointerRegion ? props.pointerRegion(point) : isPressureTriggerTarget(target, container, point))) {
    requestExit()
    return
  }
  clearExitTimer()
  // Ignore sensor/subpixel noise without delaying intentional pointer movement.
  if (pointer && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < POINTER_DEAD_ZONE_PX) return
  pointer = { x: event.clientX, y: event.clientY }
  cursor ??= { ...pointer }
  schedule()
}
function reset() { clearExitTimer(); pointer = null; schedule() }
function leave(event: PointerEvent) { if (!event.relatedTarget) reset() }
function prepare() {
  if (disposed || !rootRef.value || !geometryDirty) return
  // Font/size calibration is rare and happens for all instances before any reads.
  glyphRefs.value.forEach((glyph, index) => {
    if (!glyph) return
    if (writtenWeights[index] !== '900.00') glyph.style.fontVariationSettings = "'wght' 900.00"
    writtenWeights[index] = '900.00'
  })
}
function measure(time: number, frame: PressureFrame) {
  moving = false
  measuredWidths = null
  measuredTargets = []
  const root = rootRef.value
  if (disposed || !root) return
  const elapsed = lastTime ? Math.min(64, time - lastTime) : 1000 / 60
  lastTime = time
  smoothing = 1 - Math.exp(-elapsed / 150)
  if (geometryDirty) {
    measuredWidths = glyphRefs.value.map(glyph => glyph?.offsetWidth ?? 1)
    geometryDirty = false
  }
  if (pointer && cursor && !reducedMotion?.matches) {
    cursor.x += (pointer.x - cursor.x) * smoothing
    cursor.y += (pointer.y - cursor.y) * smoothing
    moving = Math.hypot(pointer.x - cursor.x, pointer.y - cursor.y) > 0.1
  }
  // The shared frame cache reads the common heading radius only once per batch.
  const radius = pointer && cursor && !reducedMotion?.matches
    ? Math.max(1, frame.rect(props.containerRef ?? root).width / 2)
    : 1
  measuredTargets = glyphRefs.value.map(glyph => {
    if (!glyph?.parentElement || !pointer || !cursor || reducedMotion?.matches) return getPressureWeight(0, radius, false)
    const slot = frame.rect(glyph.parentElement)
    const rect = frame.rect(glyph)
    const distance = Math.hypot(cursor.x - (slot.left + slot.width / 2), cursor.y - (rect.top + rect.height / 2))
    return getPressureWeight(distance, radius, true)
  })
}
function mutate() {
  if (disposed || !rootRef.value) return false
  glyphRefs.value.forEach((glyph, index) => {
    if (!glyph) return
    if (measuredWidths && glyph.parentElement) {
      const grow = String(measuredWidths[index])
      if (glyph.parentElement.style.flexGrow !== grow) glyph.parentElement.style.flexGrow = grow
    }
    const target = measuredTargets[index] ?? 900
    const current = weights[index] ?? 900
    const next = current + (target - current) * smoothing
    const weight = reducedMotion?.matches || Math.abs(next - target) < 0.4 ? target : next
    weights[index] = weight
    moving ||= weight !== target
    const formatted = weight.toFixed(2)
    if (writtenWeights[index] !== formatted) {
      glyph.style.fontVariationSettings = "'wght' " + formatted
      writtenWeights[index] = formatted
    }
  })
  if (!moving) { lastTime = 0; if (!pointer) cursor = null }
  return moving
}
const update = { prepare, measure, mutate }
watch(() => props.text, () => { weights = []; writtenWeights = []; glyphRefs.value.length = letters.value.length; invalidate() }, { flush: 'post' })
onMounted(() => {
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.addEventListener('change', reset)
  observer = new ResizeObserver(invalidate)
  if (rootRef.value) observer.observe(rootRef.value)
  window.addEventListener('pointermove', move, { passive: true })
  window.addEventListener('pointerout', leave)
  window.addEventListener('blur', reset)
  document.fonts.addEventListener('loadingdone', invalidate)
  void document.fonts.ready.then(() => { if (!disposed) invalidate() })
  invalidate()
})
onBeforeUnmount(() => {
  disposed = true
  clearExitTimer()
  textPressureScheduler.cancel(update)
  observer?.disconnect()
  reducedMotion?.removeEventListener('change', reset)
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerout', leave)
  window.removeEventListener('blur', reset)
  document.fonts.removeEventListener('loadingdone', invalidate)
})
</script>

<template>
  <span ref="rootRef" class="text-pressure" aria-hidden="true">
    <span v-for="(letter, index) in letters" :key="index" class="text-pressure-slot">
      <span
        :ref="element => { glyphRefs[index] = element as HTMLElement | null }"
        class="text-pressure-glyph"
        :style="{ '--letter-peak': peakOffsets[index] ?? 0 }"
      >{{ letter === ' ' ? '\u00a0' : letter }}</span>
    </span>
  </span>
</template>

<style scoped>
.text-pressure { display: flex; min-width: 0; font-family: var(--font-pressure); font-synthesis: none; }
.text-pressure-slot { flex: 1 1 0; min-width: 0; text-align: center; }
.text-pressure-glyph {
  display: inline-block;
  transform: translateY(calc(-1 * var(--letter-peak, 0) * var(--hero-title-peak-lift, 0em)));
  font-variation-settings: 'wght' 900;
  transform-origin: center;
}
</style>
