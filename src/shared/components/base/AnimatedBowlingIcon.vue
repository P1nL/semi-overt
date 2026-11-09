<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import bowlingAnimationUrl from '@/shared/assets/lottie/ball-bowling-hover-pinch.json?url'

const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
</script>

<template>
  <lord-icon
    class="animated-bowling-icon"
    :src="bowlingAnimationUrl"
    :trigger="reducedMotion ? undefined : 'hover'"
    state="hover-pinch"
    aria-hidden="true"
  />
</template>

<style scoped>
.animated-bowling-icon {
  display: block;
  inline-size: 1.75rem;
  block-size: 1.75rem;
  --lord-icon-primary: currentColor;
  --lord-icon-secondary: currentColor;
}
</style>
