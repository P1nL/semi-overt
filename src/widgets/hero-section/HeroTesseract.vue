<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useIntroTarget, HOME_INTRO, out, progress, fromViewportBottom } from '@/features/home-intro'
import { useAnimationVisibility } from '@/shared/composables/useAnimationVisibility'
import { createFrameLimiter } from '@/shared/utils/animationFrame'
import { projectTesseract, tesseractEdges } from './model/tesseract'

const points = shallowRef(projectTesseract(0))
const root = ref<SVGSVGElement | null>(null)
const intro = useIntroTarget('cube', () => root.value)
const entryStyle = computed(() => {
  if (!intro?.active.value) return undefined
  const t = intro.time.value
  const r = intro.rects.value.cube
  const dy = r ? fromViewportBottom(r.top, intro.viewport.value.height) : 0
  const p = out(progress(t, HOME_INTRO.rise, HOME_INTRO.cubeReady - HOME_INTRO.rise))
  return { translate: `0 ${dy * (1 - p)}px`, opacity: t >= HOME_INTRO.rise ? 1 : 0 }
})
const { visible, reducedMotion } = useAnimationVisibility(root)
const limiter = createFrameLimiter(60)
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
let frame = 0
let time = 0
let mounted = false
function tick(now: number) {
  frame = 0
  if (!mounted || !visible.value || reducedMotion.value) return
  const elapsed = limiter.consume(now)
  if (elapsed !== null) {
    time += Math.min(64, elapsed) * 0.00048
    points.value = projectTesseract(time)
  }
  frame = requestAnimationFrame(tick)
}
function sync() {
  cancelAnimationFrame(frame)
  frame = 0
  limiter.reset()
  if (mounted && visible.value && !reducedMotion.value) frame = requestAnimationFrame(tick)
}
watch([visible, reducedMotion], sync)
onMounted(() => {
  mounted = true
  sync()
})
onBeforeUnmount(() => {
  mounted = false
  cancelAnimationFrame(frame)
})
</script>

<template>
  <svg ref="root" class="hero-tesseract" :style="entryStyle" viewBox="0 0 800 800" aria-hidden="true" focusable="false">
    <line v-for="([a, b], index) in tesseractEdges" :key="index"
      :x1="points[a]!.x" :y1="points[a]!.y" :x2="points[b]!.x" :y2="points[b]!.y"
      stroke="currentColor" stroke-linecap="round" vector-effect="non-scaling-stroke"
      :stroke-opacity="clamp(0.62 + (points[a]!.z + points[b]!.z) / 2 * 0.22, 0.25, 1)"
      :stroke-width="0.8 + clamp(0.62 + (points[a]!.z + points[b]!.z) / 2 * 0.22, 0.25, 1) * 1.6" />
    <circle v-for="(point, index) in points" :key="index" :cx="point.x" :cy="point.y"
      :r="clamp(3.5 + point.z * 0.8, 2, 6)" fill="currentColor"
      :fill-opacity="clamp(0.78 + point.z * 0.15, 0.45, 1)" />
  </svg>
</template>

<style scoped>
.hero-tesseract {
  position: absolute;
  left: 50%;
  /* 固定向上补偿文字环的视觉重心，不随旋转逐帧调整。 */
  top: calc(0.38em - 14px);
  width: min(0.9em, 160px);
  height: auto;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  color: var(--color-hero-tesseract);
  pointer-events: none;
  z-index: 0;
}
</style>
