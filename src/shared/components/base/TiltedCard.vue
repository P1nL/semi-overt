<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { Motion } from 'motion-v'

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
const rotateX = ref(0)
const rotateY = ref(0)
const scale = ref(1)
const prefersReducedMotion = ref(true)
const hasFinePointer = ref(false)

let reducedMotionQuery: MediaQueryList | null = null
let finePointerQuery: MediaQueryList | null = null

const canTilt = computed(
  () => !props.disabled && !prefersReducedMotion.value && hasFinePointer.value,
)

const springTransition = {
  type: 'spring' as const,
  damping: 30,
  stiffness: 100,
  mass: 1.5,
}

const stageStyle = computed(() => ({
  '--tilted-card-perspective': props.perspective,
}))

function syncMotionPreferences() {
  prefersReducedMotion.value = reducedMotionQuery?.matches ?? true
  hasFinePointer.value = finePointerQuery?.matches ?? false
}

function resetTilt() {
  rotateX.value = 0
  rotateY.value = 0
  scale.value = 1
}

function handlePointerEnter(event: PointerEvent) {
  if (!canTilt.value || event.pointerType === 'touch') return
  scale.value = props.scaleOnHover
}

function handlePointerMove(event: PointerEvent) {
  if (!canTilt.value || event.pointerType === 'touch' || !stageRef.value) return

  const rect = stageRef.value.getBoundingClientRect()
  const normalizedX = Math.min(1, Math.max(-1, (event.clientX - rect.left - rect.width / 2) / (rect.width / 2)))
  const normalizedY = Math.min(1, Math.max(-1, (event.clientY - rect.top - rect.height / 2) / (rect.height / 2)))

  rotateX.value = normalizedY * -props.rotateAmplitude
  rotateY.value = normalizedX * props.rotateAmplitude
}

onMounted(() => {
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
  syncMotionPreferences()
  reducedMotionQuery.addEventListener('change', syncMotionPreferences)
  finePointerQuery.addEventListener('change', syncMotionPreferences)
})

onBeforeUnmount(() => {
  reducedMotionQuery?.removeEventListener('change', syncMotionPreferences)
  finePointerQuery?.removeEventListener('change', syncMotionPreferences)
})

watch(canTilt, (enabled) => {
  if (!enabled) resetTilt()
})
</script>

<template>
  <figure
    ref="stageRef"
    class="tilted-card"
    :class="{ 'tilted-card--static': !canTilt }"
    :style="stageStyle"
    @pointerenter="handlePointerEnter"
    @pointermove="handlePointerMove"
    @pointerleave="resetTilt"
    @pointercancel="resetTilt"
  >
    <Motion
      tag="div"
      class="tilted-card__surface"
      :animate="{
        rotateX,
        rotateY,
        scale,
      }"
      :transition="springTransition"
    >
      <slot />
    </Motion>
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
  transform-style: preserve-3d;
  will-change: transform;
}

.tilted-card--static .tilted-card__surface {
  will-change: auto;
}

@media (prefers-reduced-motion: reduce) {
  .tilted-card__surface {
    transform: none !important;
    will-change: auto;
  }
}
</style>
