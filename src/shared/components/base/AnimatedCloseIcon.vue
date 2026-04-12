<script setup lang="ts">
import closeHoverAnimationUrl from '@/shared/assets/lottie/close-hover-cross.json?url'

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
    class="animated-close-icon"
    :style="{
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
    }"
    :aria-hidden="decorative ? 'true' : undefined"
    :role="decorative ? undefined : 'img'"
  >
    <lord-icon
      class="animated-close-icon__player current-color"
      :src="closeHoverAnimationUrl"
      trigger="hover"
      state="hover-cross-3"
      :title="!decorative && title ? title : undefined"
    />
  </span>
</template>

<style scoped>
.animated-close-icon {
  position: relative;
  display: inline-block;
  line-height: 0;
  color: currentColor;
  vertical-align: middle;
}

.animated-close-icon__player {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 200%;
  height: 200%;
  transform: translate(-50%, -50%);
}

.animated-close-icon__player.current-color {
  --lord-icon-primary: currentColor;
  --lord-icon-secondary: currentColor;
}
</style>
