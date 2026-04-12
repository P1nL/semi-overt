<script setup lang="ts">
import uploadFileAnimationUrl from '@/shared/assets/lottie/upload-file.json?url'

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
    class="animated-upload-file-icon"
    :style="{
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
    }"
    :aria-hidden="decorative ? 'true' : undefined"
    :role="decorative ? undefined : 'img'"
  >
    <lord-icon
      class="animated-upload-file-icon__player current-color"
      :src="uploadFileAnimationUrl"
      trigger="hover"
      state="hover-file-1"
      :title="!decorative && title ? title : undefined"
    />
  </span>
</template>

<style scoped>
.animated-upload-file-icon {
  position: relative;
  display: inline-block;
  line-height: 0;
  color: currentColor;
  vertical-align: middle;
}

.animated-upload-file-icon__player {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 138%;
  height: 138%;
  transform: translate(-50%, -50%);
}

.animated-upload-file-icon__player.current-color {
  --lord-icon-primary: currentColor;
  --lord-icon-secondary: currentColor;
}
</style>
