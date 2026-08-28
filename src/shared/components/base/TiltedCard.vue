<script setup lang="ts">
import gsap from 'gsap'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    rotateAmplitude?: number
    scaleOnHover?: number
    perspective?: string
    disabled?: boolean
  }>(),
  {
    rotateAmplitude: 6,
    scaleOnHover: 1.012,
    perspective: '1200px',
    disabled: false,
  },
)

const stageRef = useTemplateRef<HTMLElement>('stageRef')
const surfaceRef = useTemplateRef<HTMLElement>('surfaceRef')
const prefersReducedMotion = ref(true)
const hasFinePointer = ref(false)
const isInteracting = ref(false)

let reducedMotionQuery: MediaQueryList | null = null
let finePointerQuery: MediaQueryList | null = null
let resizeObserver: ResizeObserver | null = null
let stageBounds: DOMRect | null = null
let interactionCleanupTimer: number | null = null
let rotateXTo: ReturnType<typeof gsap.quickTo> | null = null
let rotateYTo: ReturnType<typeof gsap.quickTo> | null = null
let scaleTo: ReturnType<typeof gsap.quickTo> | null = null

const canTilt = computed(
  () => !props.disabled && !prefersReducedMotion.value && hasFinePointer.value,
)

const stageStyle = computed(() => ({
  '--tilted-card-perspective': props.perspective,
}))

function syncMotionPreferences() {
  prefersReducedMotion.value = reducedMotionQuery?.matches ?? true
  hasFinePointer.value = finePointerQuery?.matches ?? false
}

function clearInteractionCleanupTimer() {
  if (interactionCleanupTimer === null) return
  window.clearTimeout(interactionCleanupTimer)
  interactionCleanupTimer = null
}

function ensureMotionSetters() {
  const surface = surfaceRef.value
  if (!surface || rotateXTo || rotateYTo || scaleTo) return

  gsap.set(surface, {
    force3D: true,
    rotationX: 0,
    rotationY: 0,
    scale: 1,
    transformOrigin: 'center center',
  })

  rotateXTo = gsap.quickTo(surface, 'rotationX', {
    duration: 0.34,
    ease: 'power3.out',
  })
  rotateYTo = gsap.quickTo(surface, 'rotationY', {
    duration: 0.34,
    ease: 'power3.out',
  })
  scaleTo = gsap.quickTo(surface, 'scale', {
    duration: 0.3,
    ease: 'power3.out',
  })
}

function clearMotionSetters() {
  rotateXTo = null
  rotateYTo = null
  scaleTo = null
}

function updateStageBounds() {
  stageBounds = stageRef.value?.getBoundingClientRect() ?? null
}

function resetTilt(immediate = false) {
  clearInteractionCleanupTimer()
  stageBounds = null

  const surface = surfaceRef.value
  if (!surface) {
    isInteracting.value = false
    return
  }

  if (immediate) {
    gsap.killTweensOf(surface)
    gsap.set(surface, {
      rotationX: 0,
      rotationY: 0,
      scale: 1,
    })
    clearMotionSetters()
    isInteracting.value = false
    return
  }

  ensureMotionSetters()
  rotateXTo?.(0)
  rotateYTo?.(0)
  scaleTo?.(1)

  interactionCleanupTimer = window.setTimeout(() => {
    interactionCleanupTimer = null
    isInteracting.value = false
  }, 380)
}

function handlePointerEnter(event: PointerEvent) {
  if (!canTilt.value || event.pointerType === 'touch') return

  clearInteractionCleanupTimer()
  ensureMotionSetters()
  updateStageBounds()
  isInteracting.value = true
  scaleTo?.(props.scaleOnHover)
}

function handlePointerMove(event: PointerEvent) {
  if (!canTilt.value || event.pointerType === 'touch') return

  if (!stageBounds) {
    updateStageBounds()
  }

  const bounds = stageBounds
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return

  const normalizedX = Math.min(
    1,
    Math.max(-1, (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2)),
  )
  const normalizedY = Math.min(
    1,
    Math.max(-1, (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2)),
  )

  rotateXTo?.(normalizedY * -props.rotateAmplitude)
  rotateYTo?.(normalizedX * props.rotateAmplitude)
}

onMounted(() => {
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
  syncMotionPreferences()

  reducedMotionQuery.addEventListener('change', syncMotionPreferences)
  finePointerQuery.addEventListener('change', syncMotionPreferences)

  if (stageRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      stageBounds = null
    })
    resizeObserver.observe(stageRef.value)
  }

  if (canTilt.value) {
    ensureMotionSetters()
  }
})

onBeforeUnmount(() => {
  clearInteractionCleanupTimer()
  reducedMotionQuery?.removeEventListener('change', syncMotionPreferences)
  finePointerQuery?.removeEventListener('change', syncMotionPreferences)
  resizeObserver?.disconnect()
  resizeObserver = null

  if (surfaceRef.value) {
    gsap.killTweensOf(surfaceRef.value)
  }

  clearMotionSetters()
})

watch(canTilt, (enabled) => {
  if (!enabled) {
    resetTilt(true)
    return
  }

  ensureMotionSetters()
})
</script>

<template>
  <figure
    ref="stageRef"
    class="tilted-card"
    :class="{
      'tilted-card--active': isInteracting,
      'tilted-card--static': !canTilt,
    }"
    :style="stageStyle"
    @pointerenter="handlePointerEnter"
    @pointermove="handlePointerMove"
    @pointerleave="resetTilt()"
    @pointercancel="resetTilt()"
  >
    <div ref="surfaceRef" class="tilted-card__surface">
      <slot />
    </div>
  </figure>
</template>

<style scoped>
.tilted-card {
  position: relative;
  width: 100%;
  margin: 0;
  perspective: var(--tilted-card-perspective);
  transform-style: preserve-3d;
}

.tilted-card__surface {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  backface-visibility: hidden;
  transform-style: preserve-3d;
  will-change: auto;
}

.tilted-card--active .tilted-card__surface {
  will-change: transform;
}

.tilted-card--static .tilted-card__surface {
  transform: none !important;
  will-change: auto;
}

@media (prefers-reduced-motion: reduce) {
  .tilted-card__surface {
    transform: none !important;
    will-change: auto;
  }
}
</style>
