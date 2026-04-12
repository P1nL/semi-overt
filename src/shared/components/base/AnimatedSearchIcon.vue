<script setup lang="ts">
import searchHoverAnimationUrl from '@/shared/assets/lottie/search-hover-pinch.json?url'

withDefaults(
  defineProps<{
    size?: number | string
    decorative?: boolean
    title?: string
  }>(),
  {
    size: 18,
    decorative: true,
    title: '',
  },
)
</script>

<template>
  <span
    class="animated-search-icon"
    :style="{
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
    }"
    :aria-hidden="decorative ? 'true' : undefined"
    :role="decorative ? undefined : 'img'"
  >
    <lord-icon
      class="animated-search-icon__player current-color"
      :src="searchHoverAnimationUrl"
      trigger="hover"
      state="hover-pinch"
      :title="!decorative && title ? title : undefined"
    />
  </span>
</template>

<style scoped>
.animated-search-icon {
  position: relative;
  display: inline-block;
  line-height: 0;
  color: currentColor;
  vertical-align: middle;
}

.animated-search-icon__player {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 110%;
  height: 110%;
  transform: translate(-50%, -50%);
}

.animated-search-icon__player.current-color {
  --lord-icon-primary: currentColor;
  --lord-icon-secondary: currentColor;
}
</style>
