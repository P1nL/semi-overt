<script setup lang="ts">
import disabledAnimationUrl from '@/shared/assets/lottie/auth-disabled.json?url'

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
    class="animated-disabled-icon"
    :style="{
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
    }"
    :aria-hidden="decorative ? 'true' : undefined"
    :role="decorative ? undefined : 'img'"
  >
    <lord-icon
      class="animated-disabled-icon__player current-color"
      :src="disabledAnimationUrl"
      trigger="hover"
      state="hover-disabled"
      :title="!decorative && title ? title : undefined"
    />
  </span>
</template>

<style scoped>
.animated-disabled-icon {
  position: relative;
  display: inline-block;
  line-height: 0;
  color: currentColor;
  vertical-align: middle;
}

.animated-disabled-icon__player {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 142%;
  height: 142%;
  transform: translate(-50%, -50%);
}

.animated-disabled-icon__player.current-color {
  --lord-icon-primary: currentColor;
  --lord-icon-secondary: currentColor;
}
</style>
