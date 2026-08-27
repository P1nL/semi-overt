<script setup lang="ts">
import personExitAnimationUrl from '@/shared/assets/lottie/person-exit.json?url'

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
    class="animated-person-exit-icon"
    :style="{
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
    }"
    :aria-hidden="decorative ? 'true' : undefined"
    :role="decorative ? undefined : 'img'"
  >
    <lord-icon
      class="animated-person-exit-icon__player current-color"
      :src="personExitAnimationUrl"
      trigger="hover"
      state="hover-pinch"
      :title="!decorative && title ? title : undefined"
    />
  </span>
</template>

<style scoped>
.animated-person-exit-icon {
  position: relative;
  display: inline-block;
  line-height: 0;
  color: currentColor;
  vertical-align: middle;
}

.animated-person-exit-icon__player {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 138%;
  height: 138%;
  transform: translate(-50%, -50%);
}

.animated-person-exit-icon__player.current-color {
  --lord-icon-primary: currentColor;
  --lord-icon-secondary: currentColor;
}
</style>
