<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { useUiStore } from '@/stores/ui'
import {
  CUBE_REST_YAW,
  CUBE_TURN,
  CUBE_TURN_DURATION,
  createCubeLogoGeometry,
} from './model/cubeLogo'

const uiStore = useUiStore()
const reducedMotion = usePreferredReducedMotion()
const HOVER_TURN_DURATION = 2400
const HOVER_RAMP_DURATION = 480

const angle = ref(CUBE_REST_YAW)
const hovering = ref(false)
let frame: number | null = null
const geometry = computed(() => createCubeLogoGeometry(angle.value))

function stopAnimation() {
  if (frame !== null) cancelAnimationFrame(frame)
  frame = null
}

function finishRotation() {
  stopAnimation()
  angle.value = CUBE_REST_YAW
}

function animateTo(target: number, duration: number) {
  stopAnimation()

  const from = angle.value
  const start = performance.now()
  const animate = (now: number) => {
    const progress = Math.min(1, (now - start) / duration)
    const eased = progress * progress * (3 - 2 * progress)
    angle.value = from + (target - from) * eased

    if (progress < 1) {
      frame = requestAnimationFrame(animate)
      return
    }

    finishRotation()
  }

  frame = requestAnimationFrame(animate)
}

function startHoverRotation() {
  hovering.value = true
  stopAnimation()

  if (reducedMotion.value === 'reduce') {
    finishRotation()
    return
  }

  const from = angle.value
  const start = performance.now()
  const animate = (now: number) => {
    const elapsed = now - start
    const travelTime = elapsed < HOVER_RAMP_DURATION
      ? elapsed * elapsed / (2 * HOVER_RAMP_DURATION)
      : elapsed - HOVER_RAMP_DURATION / 2

    angle.value = from + (travelTime / HOVER_TURN_DURATION) * CUBE_TURN
    frame = requestAnimationFrame(animate)
  }

  frame = requestAnimationFrame(animate)
}

function stopHoverRotation() {
  hovering.value = false

  if (reducedMotion.value === 'reduce') {
    finishRotation()
    return
  }

  const turns = Math.round((angle.value - CUBE_REST_YAW) / CUBE_TURN)
  const target = CUBE_REST_YAW + Math.max(0, turns) * CUBE_TURN
  const remaining = Math.abs(target - angle.value)

  if (remaining < 0.001) {
    finishRotation()
    return
  }

  const settleDuration = Math.max(240, Math.min(800, HOVER_TURN_DURATION * remaining / CUBE_TURN))
  animateTo(target, settleDuration)
}

watch(() => uiStore.darkMode, () => {
  if (hovering.value) {
    startHoverRotation()
    return
  }

  if (reducedMotion.value === 'reduce') {
    finishRotation()
    return
  }

  const target = CUBE_REST_YAW
    + (Math.floor((angle.value - CUBE_REST_YAW) / CUBE_TURN) + 1) * CUBE_TURN
  animateTo(target, CUBE_TURN_DURATION)
})

watch(reducedMotion, (value) => {
  if (value === 'reduce') {
    finishRotation()
  } else if (hovering.value) {
    startHoverRotation()
  }
})
onBeforeUnmount(stopAnimation)
</script>

<template>
  <RouterLink
    :to="{ name: ROUTE_NAME.HOME }"
    class="brand-home-link inline-flex items-center rounded-[var(--radius-pill)] px-2 py-1.5 text-[var(--color-text)]"
    aria-label="返回首页"
    @mouseenter="startHoverRotation"
    @mouseleave="stopHoverRotation"
  >
    <svg
      class="brand-cube"
      viewBox="0 0 48 48"
      :data-cube-angle="angle"
      :style="{ '--cube-transition-duration': CUBE_TURN_DURATION + 'ms' }"
      aria-hidden="true"
      focusable="false"
    >
      <path
        v-for="edge in geometry.edges"
        :key="edge.key"
        :d="edge.path"
        fill="none"
        stroke="currentColor"
        :opacity="edge.opacity"
        stroke-width=".65"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <!-- The front-facing opening covers rear edges; its far side fades out. -->
      <path :d="geometry.door.path" fill="currentColor" :opacity="geometry.door.opacity" />
    </svg>
  </RouterLink>
</template>

<style scoped>
.brand-home-link:hover .brand-cube {
  color: var(--color-text);
}

.brand-cube {
  display: block;
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
  color: var(--color-text);
  transition: color var(--cube-transition-duration) ease;
}

@media (prefers-reduced-motion: reduce) {
  .brand-cube { transition: none; }
}
</style>
