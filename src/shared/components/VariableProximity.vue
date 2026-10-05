<script setup lang="ts">
// Adapted from the Vue Bits VariableProximity registry component.
import { computed, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import { stepGlyphCompression } from '@/shared/utils/glyphCompression'

export type FalloffType = 'linear' | 'exponential' | 'gaussian'
const props = withDefaults(defineProps<{
  label: string
  accessibleLabel?: string
  fromFontVariationSettings: string
  toFontVariationSettings: string
  containerRef?: HTMLElement | null
  radius?: number
  falloff?: FalloffType
  className?: string
  style?: CSSProperties
  onClick?: () => void
  staticFontEffect?: boolean
  profile?: 'flat' | 'peak'
}>(), {
  radius: 100,
  falloff: 'linear',
  className: '',
  style: () => ({}),
  staticFontEffect: false,
  profile: 'flat',
})

const rootRef = ref<HTMLElement | null>(null)
const letterRefs = ref<Array<HTMLElement | null>>([])
const words = computed(() => props.label.split(' '))
const lettersBefore = (index: number) => words.value.slice(0, index).reduce((sum, word) => sum + Array.from(word).length, 0)
const settings = computed(() => {
  const parse = (value: string) => new Map(value.split(',').map(part => {
    const match = part.trim().match(/["']?([\w]+)["']?\s+(-?[\d.]+)/)
    return [match?.[1] ?? '', Number(match?.[2] ?? 0)] as const
  }))
  const to = parse(props.toFontVariationSettings)
  return Array.from(parse(props.fromFontVariationSettings), ([axis, from]) => ({ axis, from, to: to.get(axis) ?? from }))
})
let pointer: { x: number; y: number } | null = null
let filteredPointer: { x: number; y: number } | null = null
const POINTER_DEAD_ZONE_PX = 3
const STRENGTH_SMOOTHING_MS = 160
const POINTER_SMOOTHING_MS = 90
const STRENGTH_SETTLE_EPSILON = 0.0005
const GLYPH_COMPRESSION = 0.18
let frame = 0
let strengths: number[] = []
let compressions: number[] = []
type LetterGeometry = { letter: HTMLElement; index: number; width: number; height: number; center: number; left: number; y: number }
let geometry: LetterGeometry[] = []
let geometryDirty = true
let measuredWidth = -1
let resizeObserver: ResizeObserver | undefined
let lastFrameTime = 0
let reducedMotion: MediaQueryList | undefined

function reset() {
  pointer = null
  // Keep the filtered position during release so a quick re-entry does not snap.
  schedule()
}
function onPointerMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
  const bounds = props.containerRef?.getBoundingClientRect()
  const profileTop = props.profile === 'peak' ? Math.min(0, ...geometry.map(item => item.y - item.height / 2)) : 0
  const inside = bounds && event.clientX >= bounds.left && event.clientX <= bounds.right
    && event.clientY >= bounds.top + profileTop && event.clientY <= bounds.bottom
  if (!inside) {
    if (pointer) reset()
    return
  }
  // Ignore sensor/subpixel noise relative to the last accepted position; deliberate
  // movement still accumulates until it exceeds this small spatial threshold.
  if (pointer && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < POINTER_DEAD_ZONE_PX) return
  pointer = { x: event.clientX, y: event.clientY }
  filteredPointer ??= { ...pointer }
  schedule()
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(update)
}
function invalidateGeometry() {
  geometryDirty = true
  schedule()
}
function update(timestamp: number) {
  frame = 0
  let moving = false
  const radius = Math.max(1, props.radius)
  const bounds = (props.containerRef ?? rootRef.value)?.getBoundingClientRect()
  if (!bounds) return
  const elapsed = lastFrameTime ? Math.min(32, timestamp - lastFrameTime) : 1000 / 60
  const smoothing = 1 - Math.exp(-elapsed / STRENGTH_SMOOTHING_MS)
  lastFrameTime = timestamp
  if (geometryDirty || Math.abs(bounds.width - measuredWidth) > 0.01) {
    // Read true layout once, with transforms removed, before writing the next pose.
    // Do not derive resting positions from the previous frame's transformed boxes.
    letterRefs.value.forEach(letter => {
      if (!letter) return
      letter.style.transform = ''
      letter.style.fontVariationSettings = props.fromFontVariationSettings
    })
    geometry = letterRefs.value.flatMap((letter, index) => {
      if (!letter) return []
      const rect = letter.getBoundingClientRect()
      return [{ letter, index, width: rect.width, height: rect.height, center: rect.left + rect.width / 2 - bounds.left,
        left: rect.left - bounds.left, y: rect.top + rect.height / 2 - bounds.top }]
    })
    if (geometry.length) {
      const left = Math.min(...geometry.map(item => item.left))
      const right = Math.max(...geometry.map(item => item.left + item.width))
      geometry.forEach(item => {
        // Use actual glyph positions, not letter indexes: the peak stays centered
        // even when narrow separators sit between wide display letters.
        const progress = right > left ? (item.center - left) / (right - left) : 0.5
        const peak = props.profile === 'peak' ? Math.max(0, 1 - Math.abs(progress * 2 - 1)) : 0
        item.letter.style.setProperty('--letter-peak', peak.toFixed(5))
      })
      geometry.forEach(item => {
        const rect = item.letter.firstElementChild?.getBoundingClientRect()
        if (rect) {
          item.y = rect.top + rect.height / 2 - bounds.top
          item.height = rect.height
        }
      })
    }
    measuredWidth = bounds.width
    geometryDirty = false
  }
  if (pointer && filteredPointer && !reducedMotion?.matches) {
    const pointerSmoothing = 1 - Math.exp(-elapsed / POINTER_SMOOTHING_MS)
    const distance = Math.hypot(pointer.x - filteredPointer.x, pointer.y - filteredPointer.y)
    if (distance < 0.25) filteredPointer = { ...pointer }
    else {
      filteredPointer.x += (pointer.x - filteredPointer.x) * pointerSmoothing
      filteredPointer.y += (pointer.y - filteredPointer.y) * pointerSmoothing
      moving = true
    }
  }
  const measurements = geometry
  measurements.forEach(({ index, center, y }) => {
    let target = 0
    if (pointer && filteredPointer && !reducedMotion?.matches) {
      const distance = Math.hypot(filteredPointer.x - bounds.left - center, filteredPointer.y - bounds.top - y)
      if (distance < radius) {
        const linear = 1 - distance / radius
        // Zero slope at the glyph center and radius boundary avoids a cusp when
        // crossing the center, which is especially visible with strong squeezing.
        const envelope = linear * linear * (3 - 2 * linear)
        target = props.falloff === 'exponential' ? envelope ** 2
          : props.falloff === 'gaussian' ? Math.exp(-2 * (distance / radius) ** 2) * envelope : envelope
      }
    }
    const previous = strengths[index] ?? 0
    const interpolated = previous + (target - previous) * smoothing
    const strength = reducedMotion?.matches || Math.abs(target - interpolated) < STRENGTH_SETTLE_EPSILON
      ? target : interpolated
    moving ||= strength !== target
    strengths[index] = strength
  })

  const groups = new Map<HTMLElement, typeof measurements>()
  measurements.forEach(measurement => {
    const parent = measurement.letter.parentElement
    if (!parent) return
    const group = groups.get(parent) ?? []
    group.push(measurement)
    groups.set(parent, group)
  })
  groups.forEach(group => {
    const wave = reducedMotion?.matches ? { values: group.map(() => 0), settled: true } : stepGlyphCompression(
      group.map(item => strengths[item.index] ?? 0),
      group.map(item => compressions[item.index] ?? 0),
      elapsed,
    )
    moving ||= !wave.settled
    group.forEach(({ letter, index }, position) => {
      const compression = wave.values[position] ?? 0
      compressions[index] = compression
      // Keep every glyph anchored in its original slot. Pressure thins it in place;
      // no cursor reallocation, translation or global width normalization is applied.
      const scale = props.staticFontEffect ? 1 - compression * GLYPH_COMPRESSION : 1
      const variation = props.staticFontEffect ? props.fromFontVariationSettings
        : settings.value.map(({ axis, from, to }) => `'${axis}' ${from + (to - from) * compression}`).join(', ')
      const transform = props.staticFontEffect ? `scaleX(${scale.toFixed(6)})` : ''
      if (letter.style.fontVariationSettings !== variation) letter.style.fontVariationSettings = variation
      if (letter.style.transform !== transform) letter.style.transform = transform
    })
  })

  if (moving) schedule()
  else {
    lastFrameTime = 0
    if (!pointer) filteredPointer = null
  }
}

watch(() => [props.label, props.fromFontVariationSettings, props.toFontVariationSettings, props.radius, props.staticFontEffect, props.profile], () => {
  strengths = []
  compressions = []
  invalidateGeometry()
}, { flush: 'post' })
watch(() => props.containerRef, element => {
  resizeObserver?.disconnect()
  if (element) resizeObserver?.observe(element)
  invalidateGeometry()
}, { flush: 'post' })
onMounted(() => {
  resizeObserver = new ResizeObserver(invalidateGeometry)
  const element = props.containerRef ?? rootRef.value
  if (element) resizeObserver.observe(element)
  invalidateGeometry()
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.addEventListener('change', reset)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerout', onWindowPointerOut)
  window.addEventListener('blur', reset)
  window.addEventListener('resize', invalidateGeometry, { passive: true })
  document.fonts.addEventListener('loadingdone', invalidateGeometry)
})
function onWindowPointerOut(event: PointerEvent) { if (!event.relatedTarget) reset() }
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerout', onWindowPointerOut)
  window.removeEventListener('blur', reset)
  window.removeEventListener('resize', invalidateGeometry)
  document.fonts.removeEventListener('loadingdone', invalidateGeometry)
  reducedMotion?.removeEventListener('change', reset)
})
</script>

<template>
  <span ref="rootRef" :class="['variable-proximity', className, { 'variable-proximity--peak': profile === 'peak', 'variable-proximity--static': staticFontEffect }]" :style="style" @click="onClick">
    <span v-for="(word, wordIndex) in words" :key="wordIndex" class="variable-proximity-word" aria-hidden="true">
      <span
        v-for="(letter, index) in Array.from(word)"
        :key="index"
        :ref="element => { letterRefs[lettersBefore(wordIndex) + index] = element as HTMLElement | null }"
        class="variable-proximity-letter"
        :style="{ fontVariationSettings: fromFontVariationSettings }"
      ><span class="variable-proximity-glyph"><slot name="glyph" :letter="letter" :index="lettersBefore(wordIndex) + index">{{ letter }}</slot></span></span><span v-if="wordIndex < words.length - 1">&nbsp;</span>
    </span>
    <span class="sr-only">{{ accessibleLabel ?? label }}</span>
  </span>
</template>

<style scoped>
.variable-proximity { font-family: inherit; }
.variable-proximity-word { display: inline-block; white-space: nowrap; }
.variable-proximity-glyph { display: inline-block; }
.variable-proximity--peak .variable-proximity-glyph {
  transform: translateY(calc(-1 * var(--letter-peak, 0) * var(--variable-proximity-peak-lift, 0.6em)));
}
/* Static display fonts keep a stable glyph raster; only transforms animate. */
.variable-proximity--static .variable-proximity-letter {
  -webkit-text-stroke-width: 0;
  will-change: transform;
}
.variable-proximity-letter { display: inline-block; transform-origin: center 60%; backface-visibility: hidden; }
</style>
