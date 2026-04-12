<script setup lang="ts">
import attributionAnimationUrl from '@/shared/assets/lottie/login-attribution.json?url'

withDefaults(
  defineProps<{
    size?: number | string
    decorative?: boolean
    title?: string
  }>(),
  {
    size: 24,
    decorative: true,
    title: '',
  },
)
</script>

<template>
  <span
    class="animated-attribution-icon"
    :style="{
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
    }"
    :aria-hidden="decorative ? 'true' : undefined"
    :role="decorative ? undefined : 'img'"
  >
    <lord-icon
      class="animated-attribution-icon__player current-color"
      :src="attributionAnimationUrl"
      trigger="hover"
      state="hover-attribution"
      :title="!decorative && title ? title : undefined"
    />
  </span>
</template>

<style scoped>
.animated-attribution-icon {
  position: relative;
  display: inline-block;
  line-height: 0;
  color: currentColor;
  vertical-align: middle;
}

.animated-attribution-icon__player {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 130%;
  height: 130%;
  transform: translate(-50%, -50%);
}

.animated-attribution-icon__player.current-color {
  --lord-icon-primary: currentColor;
  --lord-icon-secondary: currentColor;
}
</style>
