<script setup lang="ts">
import folderAnimationUrl from '@/shared/assets/lottie/header-folder.json?url'

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
    class="animated-folder-icon"
    :style="{
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
    }"
    :aria-hidden="decorative ? 'true' : undefined"
    :role="decorative ? undefined : 'img'"
  >
    <lord-icon
      class="animated-folder-icon__player current-color"
      :src="folderAnimationUrl"
      trigger="hover"
      state="hover-pinch"
      :title="!decorative && title ? title : undefined"
    />
  </span>
</template>

<style scoped>
.animated-folder-icon {
  position: relative;
  display: inline-block;
  line-height: 0;
  color: currentColor;
  vertical-align: middle;
}

.animated-folder-icon__player {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 136%;
  height: 136%;
  transform: translate(-50%, -50%);
}

.animated-folder-icon__player.current-color {
  --lord-icon-primary: currentColor;
  --lord-icon-secondary: currentColor;
}
</style>
