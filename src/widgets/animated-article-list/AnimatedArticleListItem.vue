<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

const props = defineProps<{
  index: number
}>()

const rootRef = ref<HTMLElement | null>(null)
const visible = ref(false)

useIntersectionObserver(
  rootRef,
  ([entry]) => {
    visible.value = Boolean(entry?.isIntersecting)
  },
  {
    threshold: 0.16,
    rootMargin: '72px 0px -4% 0px',
  },
)
</script>

<template>
  <div
    ref="rootRef"
    class="animated-article-list-item"
    :class="visible && 'animated-article-list-item--visible'"
    :style="{ '--animated-list-delay': `${Math.min(index, 6) * 45}ms` }"
  >
    <slot />
  </div>
</template>

<style scoped>
.animated-article-list-item {
  position: relative;
  min-width: 0;
  opacity: 0;
  filter: blur(4px);
  transform: translate3d(0, 18px, 0) scale(0.94);
  transform-origin: center;
  transition:
    opacity 300ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 360ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: 0ms;
  will-change: transform, opacity, filter;
}

.animated-article-list-item--visible {
  opacity: 1;
  filter: blur(0);
  transform: translate3d(0, 0, 0) scale(1);
  transition-delay: var(--animated-list-delay);
}

.animated-article-list-item--visible:hover,
.animated-article-list-item--visible:focus-within {
  z-index: 1;
  transform: translate3d(0, -2px, 0) scale(1.008);
  transition-delay: 0ms;
}

@media (prefers-reduced-motion: reduce) {
  .animated-article-list-item,
  .animated-article-list-item--visible,
  .animated-article-list-item--visible:hover,
  .animated-article-list-item--visible:focus-within {
    opacity: 1;
    filter: none;
    transform: none;
    transition: none;
  }
}
</style>
