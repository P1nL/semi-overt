<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

import { cn } from '@/shared/utils/cn'
import Spinner from './Spinner.vue'

type GooeyActionButtonVariant = 'auth' | 'primary'

const props = withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    variant?: GooeyActionButtonVariant
    width?: string
    height?: string
    ariaLabel?: string
    loadingLabel?: string
  }>(),
  {
    type: 'button',
    loading: false,
    disabled: false,
    variant: 'auth',
    width: 'auto',
    height: '3rem',
    ariaLabel: '',
    loadingLabel: '正在处理',
  },
)

const emit = defineEmits<{
  click: [MouseEvent]
  effectComplete: []
}>()

const PARTICLE_EFFECT_DURATION_MS = 1500
const PARTICLE_STAGGER_WINDOW_MS = 420
const PARTICLE_MIN_TRAVEL_MS = 560
const PARTICLE_FINISH_BUFFER_MS = 80
const PARTICLE_COUNT = 30
const PARTICLE_VERTICAL_DISTANCE = 90
const PARTICLE_HORIZONTAL_OUTSET = 20
const PARTICLE_ENTRY_DEPTH = 10
const COLORS = [1, 2, 3, 1, 2, 3, 1, 4] as const
const filterId = `gooey-action-${useId().replace(/:/g, '')}`

const buttonRef = ref<HTMLButtonElement | null>(null)
const filterRef = ref<HTMLSpanElement | null>(null)
const buttonSize = ref({ width: 288, height: 56, borderRadius: 12 })
const timers = new Set<number>()
let resizeObserver: ResizeObserver | null = null

const isDisabled = computed(() => props.disabled || props.loading)
const buttonClass = computed(() =>
  cn(
    'gooey-action-button',
    props.variant === 'auth' ? 'gooey-action-button--auth' : 'gooey-action-button--primary',
  ),
)

function noise(amount = 1) {
  return amount / 2 - Math.random() * amount
}

function getParticlePoint(radiusX: number, radiusY: number, angle: number): [number, number] {
  return [radiusX * Math.cos(angle), radiusY * Math.sin(angle)]
}

function getEvenlySpacedEllipseAngles(
  radiusX: number,
  radiusY: number,
  totalPoints: number,
): number[] {
  const sampleCount = Math.max(totalPoints * 16, 320)
  const cumulativeDistances = [0]
  let totalDistance = 0
  let previousX = radiusX
  let previousY = 0

  for (let sample = 1; sample <= sampleCount; sample += 1) {
    const angle = (sample / sampleCount) * Math.PI * 2
    const x = radiusX * Math.cos(angle)
    const y = radiusY * Math.sin(angle)

    totalDistance += Math.hypot(x - previousX, y - previousY)
    cumulativeDistances.push(totalDistance)
    previousX = x
    previousY = y
  }

  let sampleIndex = 1
  return Array.from({ length: totalPoints }, (_, index) => {
    const targetDistance = (index / totalPoints) * totalDistance

    while (
      sampleIndex < cumulativeDistances.length - 1
      && cumulativeDistances[sampleIndex] < targetDistance
    ) {
      sampleIndex += 1
    }

    const segmentStart = cumulativeDistances[sampleIndex - 1] ?? 0
    const segmentEnd = cumulativeDistances[sampleIndex] ?? segmentStart
    const segmentLength = segmentEnd - segmentStart
    const interpolation = segmentLength > 0
      ? (targetDistance - segmentStart) / segmentLength
      : 0

    return ((sampleIndex - 1 + interpolation) / sampleCount) * Math.PI * 2
  })
}

function getRoundedRectBoundaryPoint(
  halfWidth: number,
  halfHeight: number,
  borderRadius: number,
  angle: number,
): [number, number] {
  const directionX = Math.cos(angle)
  const directionY = Math.sin(angle)
  const absoluteX = Math.abs(directionX)
  const absoluteY = Math.abs(directionY)
  const radius = Math.min(Math.max(borderRadius, 0), halfWidth, halfHeight)
  const epsilon = 0.0001

  if (absoluteX > epsilon) {
    const verticalDistance = halfWidth / absoluteX
    if (absoluteY * verticalDistance <= halfHeight - radius) {
      return [directionX * verticalDistance, directionY * verticalDistance]
    }
  }

  if (absoluteY > epsilon) {
    const horizontalDistance = halfHeight / absoluteY
    if (absoluteX * horizontalDistance <= halfWidth - radius) {
      return [directionX * horizontalDistance, directionY * horizontalDistance]
    }
  }

  const cornerCenterX = Math.sign(directionX || 1) * (halfWidth - radius)
  const cornerCenterY = Math.sign(directionY || 1) * (halfHeight - radius)
  const projection = directionX * cornerCenterX + directionY * cornerCenterY
  const discriminant = Math.max(
    0,
    projection * projection
    - (cornerCenterX * cornerCenterX + cornerCenterY * cornerCenterY - radius * radius),
  )
  const distance = projection + Math.sqrt(discriminant)

  return [directionX * distance, directionY * distance]
}

function schedule(callback: () => void, delay: number) {
  const timer = window.setTimeout(() => {
    timers.delete(timer)
    callback()
  }, Math.max(0, delay))

  timers.add(timer)
}

function clearEffect() {
  timers.forEach((timer) => window.clearTimeout(timer))
  timers.clear()

  const element = filterRef.value
  if (!element) return

  element.classList.remove('active')
  element
    .querySelectorAll('.gooey-action-button__particle, .gooey-action-button__anchor')
    .forEach((particle) => particle.remove())
}

function createParticle(time: number, angle: number) {
  const halfWidth = Math.max(buttonSize.value.width / 2, 24)
  const halfHeight = Math.max(buttonSize.value.height / 2, 18)
  const particleAngle = angle + noise(2) * (Math.PI / 180)
  const directionX = Math.cos(particleAngle)
  const directionY = Math.sin(particleAngle)
  const contact = getRoundedRectBoundaryPoint(
    halfWidth,
    halfHeight,
    buttonSize.value.borderRadius,
    particleAngle,
  )

  return {
    start: getParticlePoint(
      halfWidth + PARTICLE_HORIZONTAL_OUTSET,
      PARTICLE_VERTICAL_DISTANCE,
      particleAngle,
    ),
    contact,
    end: [
      contact[0] - directionX * PARTICLE_ENTRY_DEPTH,
      contact[1] - directionY * PARTICLE_ENTRY_DEPTH,
    ] as [number, number],
    time,
    scale: 1 + noise(0.2),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }
}

function makeParticles(element: HTMLElement) {
  element.classList.remove('active')

  const halfWidth = Math.max(buttonSize.value.width / 2, 24)
  const ellipseAngles = getEvenlySpacedEllipseAngles(
    halfWidth + PARTICLE_HORIZONTAL_OUTSET,
    PARTICLE_VERTICAL_DISTANCE,
    PARTICLE_COUNT,
  )
  const delaySlots = Array.from({ length: PARTICLE_COUNT }, (_, index) =>
    Math.round((index / Math.max(PARTICLE_COUNT - 1, 1)) * PARTICLE_STAGGER_WINDOW_MS),
  )

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const delayIndex = Math.floor(Math.random() * delaySlots.length)
    const delay = delaySlots.splice(delayIndex, 1)[0] ?? 0
    const maximumTravelTime = Math.max(
      PARTICLE_MIN_TRAVEL_MS,
      PARTICLE_EFFECT_DURATION_MS - delay - PARTICLE_FINISH_BUFFER_MS,
    )
    const time = Math.round(
      PARTICLE_MIN_TRAVEL_MS
      + Math.random() * (maximumTravelTime - PARTICLE_MIN_TRAVEL_MS),
    )
    const particleData = createParticle(time, ellipseAngles[index] ?? 0)

    schedule(() => {
      if (!props.loading || filterRef.value !== element) return

      const particle = document.createElement('span')
      const point = document.createElement('span')
      const anchor = document.createElement('span')
      const color = `var(--gooey-color-${particleData.color}, white)`

      particle.classList.add('gooey-action-button__particle')
      particle.style.setProperty('--start-x', `${particleData.start[0]}px`)
      particle.style.setProperty('--start-y', `${particleData.start[1]}px`)
      particle.style.setProperty('--contact-x', `${particleData.contact[0]}px`)
      particle.style.setProperty('--contact-y', `${particleData.contact[1]}px`)
      particle.style.setProperty('--end-x', `${particleData.end[0]}px`)
      particle.style.setProperty('--end-y', `${particleData.end[1]}px`)
      particle.style.setProperty('--time', `${particleData.time}ms`)
      particle.style.setProperty('--scale', `${particleData.scale}`)
      particle.style.setProperty('--scale-quarter', `${particleData.scale * 0.25}`)
      particle.style.setProperty('--color', color)

      anchor.classList.add('gooey-action-button__anchor')
      anchor.style.setProperty('--contact-x', `${particleData.contact[0]}px`)
      anchor.style.setProperty('--contact-y', `${particleData.contact[1]}px`)
      anchor.style.setProperty('--time', `${particleData.time}ms`)
      anchor.style.setProperty('--color', color)

      point.classList.add('gooey-action-button__point')
      particle.appendChild(point)
      element.append(anchor, particle)

      schedule(() => {
        particle.remove()
        anchor.remove()
      }, particleData.time)
    }, delay)
  }

  element.classList.add('active')
  schedule(() => {
    if (filterRef.value !== element) return

    element
      .querySelectorAll('.gooey-action-button__particle, .gooey-action-button__anchor')
      .forEach((particle) => particle.remove())
    emit('effectComplete')
  }, PARTICLE_EFFECT_DURATION_MS)
}

async function launchEffect() {
  clearEffect()
  await nextTick()

  if (!props.loading || !filterRef.value) return

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    emit('effectComplete')
    return
  }

  const element = filterRef.value
  void element.offsetWidth
  makeParticles(element)
}

function handleClick(event: MouseEvent) {
  if (isDisabled.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  emit('click', event)
}

onMounted(() => {
  if (buttonRef.value) {
    const updateButtonSize = () => {
      if (!buttonRef.value) return

      const rect = buttonRef.value.getBoundingClientRect()
      const styles = window.getComputedStyle(buttonRef.value)
      const borderRadius = Number.parseFloat(styles.borderTopLeftRadius) || 0
      buttonSize.value = { width: rect.width, height: rect.height, borderRadius }
    }

    resizeObserver = new ResizeObserver(updateButtonSize)
    resizeObserver.observe(buttonRef.value)
    updateButtonSize()
  }

  if (props.loading) {
    void launchEffect()
  }
})

watch(
  () => props.loading,
  (loading) => {
    if (loading) {
      void launchEffect()
      return
    }

    clearEffect()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  clearEffect()
})
</script>

<template>
  <button
    ref="buttonRef"
    :type="type"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
    :aria-label="ariaLabel || undefined"
    :class="buttonClass"
    :style="{
      '--gooey-action-width': width,
      '--gooey-action-height': height,
    }"
    @click="handleClick"
  >
    <svg v-if="loading" class="gooey-action-button__filter-definition" aria-hidden="true">
      <defs>
        <filter
          :id="filterId"
          x="-180%"
          y="-300%"
          width="460%"
          height="700%"
          color-interpolation-filters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" result="composite" />
          <feBlend in="goo" in2="composite" />
        </filter>
      </defs>
    </svg>

    <span
      v-if="loading"
      ref="filterRef"
      class="gooey-action-button__effect gooey-action-button__filter"
      :style="{ filter: `url(#${filterId})` }"
      aria-hidden="true"
    />

    <span v-if="loading" class="gooey-action-button__loading-indicator">
      <Spinner size="md" :label="loadingLabel" />
    </span>

    <span v-else class="gooey-action-button__content">
      <slot />
    </span>

    <span v-if="loading" class="sr-only">{{ loadingLabel }}</span>
  </button>
</template>

<style>
.gooey-action-button {
  --gooey-action-background: transparent;
  --gooey-color-1: #ff2028;
  --gooey-color-2: #253cff;
  --gooey-color-3: #00e45c;
  --gooey-color-4: #ffe600;

  position: relative;
  isolation: isolate;
  display: inline-flex;
  width: var(--gooey-action-width);
  height: var(--gooey-action-height);
  min-width: 3rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: visible;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  padding-inline: 1.25rem;
  color: var(--gooey-action-color);
  font: inherit;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transform: translate3d(0, 0, 0.01px);
  transition:
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 200ms ease,
    box-shadow 200ms ease,
    opacity 160ms ease;
}

.gooey-action-button::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  background: var(--gooey-action-background);
  pointer-events: none;
  transition: background-color 200ms ease;
}

.gooey-action-button--auth {
  --gooey-action-color: #d8ecff;
  --gooey-action-background: #0d1521;

  background: var(--gooey-action-background);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    0 10px 24px rgb(0 0 0 / 0.2);
}

.gooey-action-button--primary {
  --gooey-action-color: #ffffff;
  --gooey-action-background: var(--color-primary);

  background: var(--gooey-action-background);
  box-shadow: var(--shadow-button);
}

.gooey-action-button:not(:disabled):active {
  transform: translateY(0) scale(0.985);
}

.gooey-action-button:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.gooey-action-button[aria-busy='true'] {
  cursor: wait;
  opacity: 1;
}

.gooey-action-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--color-primary) 72%, white);
  outline-offset: 3px;
}

.gooey-action-button__content,
.gooey-action-button__loading-indicator {
  position: relative;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
}

.gooey-action-button__effect {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  border-radius: inherit;
  opacity: 1;
  pointer-events: none;
}

.gooey-action-button__filter-definition {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}

.gooey-action-button__filter {
  will-change: filter;
}

.gooey-action-button__particle,
.gooey-action-button__point {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-pill);
  opacity: 0;
  transform-origin: center;
}

.gooey-action-button__particle {
  --time: 5s;

  position: absolute;
  z-index: 1;
  top: calc(50% - 8px);
  left: calc(50% - 8px);
  animation: gooey-action-particle var(--time) ease 1;
}

.gooey-action-button__anchor {
  --time: 5s;

  position: absolute;
  z-index: 0;
  top: calc(50% - 3px);
  left: calc(50% - 3px);
  display: block;
  width: 10px;
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--color);
  opacity: 0;
  transform-origin: center;
  animation: gooey-action-anchor var(--time) ease 1;
}

.gooey-action-button__point {
  background: var(--color);
  opacity: 1;
  animation: gooey-action-point var(--time) ease 1;
}

@keyframes gooey-action-particle {
  0% {
    opacity: 1;
    transform: translate(var(--start-x), var(--start-y));
    animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45);
  }

  72% {
    opacity: 1;
    transform: translate(var(--contact-x), var(--contact-y));
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }

  100% {
    opacity: 0;
    transform: translate(var(--end-x), var(--end-y));
  }
}

@keyframes gooey-action-anchor {
  0%,
  48% {
    opacity: 0;
    transform: translate(var(--contact-x), var(--contact-y)) scale(0.2);
  }

  64% {
    opacity: 0.82;
    transform: translate(var(--contact-x), var(--contact-y)) scale(0.72);
  }

  78% {
    opacity: 0.92;
    transform: translate(var(--contact-x), var(--contact-y)) scale(1);
  }

  100% {
    opacity: 0;
    transform: translate(var(--contact-x), var(--contact-y)) scale(0.3);
  }
}

@keyframes gooey-action-point {
  0% {
    opacity: 0;
    transform: scale(0);
    animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45);
  }

  22% {
    transform: scale(var(--scale-quarter));
  }

  36%,
  76% {
    opacity: 1;
    transform: scale(var(--scale));
    animation-timing-function: ease;
  }

  100% {
    opacity: 0;
    transform: scale(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .gooey-action-button {
    transition: none;
  }

  .gooey-action-button__filter {
    filter: none !important;
  }

  .gooey-action-button__particle,
  .gooey-action-button__anchor {
    display: none;
  }
}
</style>
