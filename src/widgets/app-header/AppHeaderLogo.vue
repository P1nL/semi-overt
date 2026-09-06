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
const angle = ref(CUBE_REST_YAW)
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

watch(() => uiStore.darkMode, () => {
  stopAnimation()
  if (reducedMotion.value === 'reduce') {
    finishRotation()
    return
  }
  const from = angle.value
  // Continue from the displayed geometry on rapid toggles, never jump to the start.
  const to = CUBE_REST_YAW + (Math.floor((from - CUBE_REST_YAW) / CUBE_TURN) + 1) * CUBE_TURN
  const start = performance.now()
  const animate = (now: number) => {
    const progress = Math.min(1, (now - start) / CUBE_TURN_DURATION)
    const eased = progress * progress * (3 - 2 * progress)
    angle.value = from + (to - from) * eased
    if (progress < 1) frame = requestAnimationFrame(animate)
    else finishRotation()
  }
  frame = requestAnimationFrame(animate)
})

watch(reducedMotion, (value) => {
  if (value === 'reduce') finishRotation()
})
onBeforeUnmount(stopAnimation)
</script>

<template>
  <RouterLink
    :to="{ name: ROUTE_NAME.HOME }"
    class="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-1.5 text-[var(--color-text)]"
    aria-label="返回首页"
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
.brand-cube {
  display: block;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  color: var(--color-text);
  transition: color var(--cube-transition-duration) ease;
}

@media (prefers-reduced-motion: reduce) {
  .brand-cube { transition: none; }
}
</style>
