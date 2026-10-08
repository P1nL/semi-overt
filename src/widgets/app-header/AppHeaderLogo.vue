<script setup lang="ts">
import { ref } from 'vue'
import { ROUTE_NAME } from '@/shared/constants/routes'
import { usePupilWander } from '@/shared/composables/usePupilWander'

const { style: pupilStyle } = usePupilWander(ref(true))
</script>

<template>
  <RouterLink
    :to="{ name: ROUTE_NAME.HOME }"
    class="brand-home-link relative inline-flex shrink-0 items-center justify-center rounded-full"
    aria-label="返回首页"
  >
    <span class="brand-letter-eye" aria-hidden="true">
      <span>O</span>
      <span class="brand-pupil" :style="pupilStyle"><span>•</span></span>
    </span>
  </RouterLink>
</template>

<style scoped>
.brand-home-link {
  width: 3.35rem;
  height: 3.35rem;
  background: var(--color-brand-logo-bg);
  color: var(--color-brand-logo-fg);
}
.brand-home-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
}
.brand-letter-eye {
  position: relative;
  display: block;
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 2.75rem;
  line-height: 1;
  font-synthesis: none;
}
.brand-pupil {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  transform: translate(var(--pupil-x, 0em), var(--pupil-y, 0em));
  transition: transform var(--pupil-duration, 0ms) cubic-bezier(0.22, 1, 0.36, 1);
}
.brand-pupil > span { font-size: 0.65em; }
@media (max-width: 767px) {
  .brand-home-link { width: 3.125rem; height: 3.125rem; }
  .brand-letter-eye { font-size: 2.5rem; }
}
@media (prefers-reduced-motion: reduce) {
  .brand-pupil { transition: none; }
}
</style>
