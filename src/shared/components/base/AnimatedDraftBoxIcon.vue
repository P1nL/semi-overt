<script setup lang="ts">
import draftBoxAnimationUrl from '@/shared/assets/lottie/draft-box-hover-article.json?url'

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
    class="animated-draft-box-icon"
    :style="{
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
    }"
    :aria-hidden="decorative ? 'true' : undefined"
    :role="decorative ? undefined : 'img'"
  >
    <lord-icon
      class="animated-draft-box-icon__player current-color"
      :src="draftBoxAnimationUrl"
      trigger="hover"
      state="hover-article"
      :title="!decorative && title ? title : undefined"
    />
  </span>
</template>

<style scoped>
.animated-draft-box-icon {
  position: relative;
  display: inline-block;
  line-height: 0;
  color: currentColor;
  vertical-align: middle;
}

.animated-draft-box-icon__player {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 100%;
  height: 100%;
  transform: translate(-50%, -50%);
}

.animated-draft-box-icon__player.current-color {
  --lord-icon-primary: currentColor;
  --lord-icon-secondary: currentColor;
}
</style>
