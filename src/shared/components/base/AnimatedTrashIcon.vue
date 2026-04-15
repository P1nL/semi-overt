<script setup lang="ts">
import trashAnimationUrl from '../../../../Lottie/system-regular-39-trash-hover-trash-empty.json?url'

withDefaults(
  defineProps<{
    size?: number | string
    decorative?: boolean
    title?: string
  }>(),
  {
    size: 20,
    decorative: true,
    title: '',
  },
)
</script>

<template>
  <span
    class="animated-trash-icon"
    :style="{
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
    }"
    :aria-hidden="decorative ? 'true' : undefined"
    :role="decorative ? undefined : 'img'"
  >
    <lord-icon
      class="animated-trash-icon__player current-color"
      :src="trashAnimationUrl"
      trigger="hover"
      state="hover-trash-empty"
      :title="!decorative && title ? title : undefined"
    />
  </span>
</template>

<style scoped>
.animated-trash-icon {
  position: relative;
  display: inline-block;
  line-height: 0;
  color: currentColor;
  vertical-align: middle;
}

.animated-trash-icon__player {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 136%;
  height: 136%;
  transform: translate(-50%, -50%);
}

.animated-trash-icon__player.current-color {
  --lord-icon-primary: currentColor;
  --lord-icon-secondary: currentColor;
}
</style>
