<script setup lang="ts">
import { ref } from 'vue'
import type { Element as LordIconElement } from '@lordicon/element'
import attributionAnimationUrl from '@/shared/assets/lottie/login-attribution.json?url'

withDefaults(
  defineProps<{
    size?: number | string
    decorative?: boolean
    title?: string
    trigger?: 'hover' | 'in' | 'loop'
  }>(),
  {
    size: 24,
    decorative: true,
    title: '',
    trigger: 'hover',
  },
)
const playerRef = ref<LordIconElement | null>(null)
let playWhenReady = false

function playHoverAnimation() {
  const player = playerRef.value?.playerInstance
  if (!player?.isReady) {
    playWhenReady = true
    return
  }
  playWhenReady = false
  if (!player.isPlaying) player.playFromBeginning()
}

function onPlayerReady() {
  if (playWhenReady) playHoverAnimation()
}

defineExpose({ playHoverAnimation })
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
      ref="playerRef"
      @ready="onPlayerReady"
      class="animated-attribution-icon__player current-color"
      :src="attributionAnimationUrl"
      :trigger="trigger"
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
