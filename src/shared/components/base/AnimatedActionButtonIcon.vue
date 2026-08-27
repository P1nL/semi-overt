<script setup lang="ts">
import actionButtonAnimationUrl from '@/shared/assets/lottie/action-button.json?url'

withDefaults(
  defineProps<{
    size?: number | string
    color?: string
    decorative?: boolean
    title?: string
  }>(),
  {
    size: 18,
    color: 'currentColor',
    decorative: true,
    title: '',
  },
)
</script>

<template>
  <span
    class="animated-action-button-icon"
    :style="{
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
      color,
    }"
    :aria-hidden="decorative ? 'true' : undefined"
    :role="decorative ? undefined : 'img'"
  >
    <lord-icon
      class="animated-action-button-icon__player current-color"
      :src="actionButtonAnimationUrl"
      trigger="hover"
      state="hover-pinch"
      :title="!decorative && title ? title : undefined"
    />
  </span>
</template>

<style scoped>
.animated-action-button-icon {
  position: relative;
  display: inline-block;
  line-height: 0;
  color: currentColor;
  vertical-align: middle;
}

.animated-action-button-icon__player {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 138%;
  height: 138%;
  transform: translate(-50%, -50%);
}

.animated-action-button-icon__player.current-color {
  --lord-icon-primary: currentColor;
  --lord-icon-secondary: currentColor;
}
</style>
