<script setup lang="ts">
// Adapted from the Vue Bits VariableProximity registry component.
import { computed, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'

export type FalloffType = 'linear' | 'exponential' | 'gaussian'
const props = withDefaults(defineProps<{
  label: string
  fromFontVariationSettings: string
  toFontVariationSettings: string
  containerRef?: HTMLElement | null
  radius?: number
  falloff?: FalloffType
  className?: string
  style?: CSSProperties
  onClick?: () => void
  staticFontEffect?: boolean
}>(), {
  radius: 100,
  falloff: 'linear',
  className: '',
  style: () => ({}),
  staticFontEffect: false,
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
const POINTER_DEAD_ZONE_PX = 1.5
let frame = 0
let strengths: number[] = []
type LetterGeometry = { letter: HTMLElement; index: number; width: number; center: number; left: number; y: number }
let geometry: LetterGeometry[] = []
let geometryDirty = true
let measuredWidth = -1
let resizeObserver: ResizeObserver | undefined
let lastFrameTime = 0
let reducedMotion: MediaQueryList | undefined

function reset() {
  pointer = null
  filteredPointer = null
  schedule()
}
function onPointerMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
  const bounds = props.containerRef?.getBoundingClientRect()
  const inside = bounds && event.clientX >= bounds.left && event.clientX <= bounds.right
    && event.clientY >= bounds.top && event.clientY <= bounds.bottom
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
  const smoothing = 1 - Math.exp(-elapsed / 110)
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
      return [{ letter, index, width: rect.width, center: rect.left + rect.width / 2 - bounds.left,
        left: rect.left - bounds.left, y: rect.top + rect.height / 2 - bounds.top }]
    })
    measuredWidth = bounds.width
    geometryDirty = false
  }
  if (pointer && filteredPointer && !reducedMotion?.matches) {
    const pointerSmoothing = 1 - Math.exp(-elapsed / 65)
    const distance = Math.hypot(pointer.x - filteredPointer.x, pointer.y - filteredPointer.y)
    if (distance < 0.05) filteredPointer = { ...pointer }
    else {
      filteredPointer.x += (pointer.x - filteredPointer.x) * pointerSmoothing
      filteredPointer.y += (pointer.y - filteredPointer.y) * pointerSmoothing
      moving = true
    }
  }
  const measurements = geometry
  measurements.forEach(({ index, center, y }) => {
    let target = 0
    if (filteredPointer && !reducedMotion?.matches) {
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
    const strength = reducedMotion?.matches || Math.abs(target - previous) < 0.00005
      ? target : previous + (target - previous) * smoothing
    moving ||= Math.abs(target - strength) >= 0.00005
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
    const totalWidth = group.reduce((sum, item) => sum + item.width, 0)
    const expandedWidth = group.reduce((sum, item) => sum + item.width * (1 + (strengths[item.index] ?? 0) * 0.8), 0)
    // Reallocate a fixed width budget: the active glyph expands, neighbors squeeze
    // and shift, but the whole word remains centered within the original bounds.
    const normalization = expandedWidth > 0 ? totalWidth / expandedWidth : 1
    let cursor = group[0]!.left
    group.forEach((item, position) => {
      const { letter, index, width, center } = item
      const strength = strengths[index] ?? 0
      const scale = props.staticFontEffect ? (1 + strength * 0.8) * normalization : 1
      const nextWidth = width * scale
      const shift = props.staticFontEffect ? cursor + nextWidth / 2 - center : 0
      // Avoid continuously rewriting unsupported variation axes on the static font.
      const variation = props.staticFontEffect ? props.fromFontVariationSettings
        : settings.value.map(({ axis, from, to }) => `'${axis}' ${from + (to - from) * strength}`).join(', ')
      const transform = props.staticFontEffect ? `translate3d(${shift.toFixed(4)}px, 0, 0) scaleX(${scale.toFixed(6)})` : ''
      const stroke = props.staticFontEffect ? `${(strength * 0.055).toFixed(6)}em` : ''
      const strokeColor = props.staticFontEffect ? 'currentColor' : ''
      if (letter.style.fontVariationSettings !== variation) letter.style.fontVariationSettings = variation
      if (letter.style.transform !== transform) letter.style.transform = transform
      if (letter.style.webkitTextStrokeWidth !== stroke) letter.style.webkitTextStrokeWidth = stroke
      if (letter.style.webkitTextStrokeColor !== strokeColor) letter.style.webkitTextStrokeColor = strokeColor
      const next = group[position + 1]
      const gap = next ? next.left - (item.left + width) : 0
      cursor += nextWidth + gap
    })
  })
  if (moving) schedule()
  else lastFrameTime = 0
}

watch(() => [props.label, props.fromFontVariationSettings, props.toFontVariationSettings, props.radius, props.staticFontEffect], () => {
  strengths = []
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
  <span ref="rootRef" :class="['variable-proximity', className]" :style="style" @click="onClick">
    <span v-for="(word, wordIndex) in words" :key="wordIndex" class="variable-proximity-word" aria-hidden="true">
      <span
        v-for="(letter, index) in Array.from(word)"
        :key="index"
        :ref="element => { letterRefs[lettersBefore(wordIndex) + index] = element as HTMLElement | null }"
        class="variable-proximity-letter"
        :style="{ fontVariationSettings: fromFontVariationSettings }"
      >{{ letter }}</span><span v-if="wordIndex < words.length - 1">&nbsp;</span>
    </span>
    <span class="sr-only">{{ label }}</span>
  </span>
</template>

<style scoped>
.variable-proximity { font-family: inherit; }
.variable-proximity-word { display: inline-block; white-space: nowrap; }
.variable-proximity-letter { display: inline-block; transform-origin: center 60%; backface-visibility: hidden; }
</style>
