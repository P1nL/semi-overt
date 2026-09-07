<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { interpolateThemeIcon, themeIconPath, themeIconPose, type ThemeIconMode } from '@/features/theme-switch/model/themeIconGeometry'

const props = withDefaults(defineProps<{ mode: ThemeIconMode; duration?: number }>(), { duration: 220 })
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const pose = shallowRef(themeIconPose(props.mode))
const hidden = ref(false)
const morphing = ref(false)
const outline = computed(() => themeIconPath(pose.value.outline))
const rayReveal = computed(() => Math.max(0, (pose.value.sun - 0.35) / 0.65))
const clipId = 'theme-icon-contour-' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
const meridians = [{ radius: 3.2, phase: '0s' }, { radius: 6.5, phase: '-4s' }, { radius: 9, phase: '-8s' }]
const rays = Array.from({ length: 8 }, (_, i) => i * 45)
let frame = 0

function stop() {
  cancelAnimationFrame(frame)
  frame = 0
  morphing.value = false
}

function morph() {
  stop()
  const target = themeIconPose(props.mode)
  if (reducedMotion.value || hidden.value || props.duration <= 0) {
    pose.value = target
    return
  }
  // Retarget from the visible geometry, never from the last completed icon.
  const from = pose.value
  const start = performance.now()
  morphing.value = true
  const tick = (now: number) => {
    const t = Math.min(1, Math.max(0, (now-start) / props.duration))
    const eased = t * t * (3 - 2*t)
    pose.value = interpolateThemeIcon(from, target, eased)
    if (t < 1) frame = requestAnimationFrame(tick)
    else { frame = 0; morphing.value = false }
  }
  frame = requestAnimationFrame(tick)
}
watch([() => props.mode, reducedMotion], morph, { flush: 'sync' })
function syncVisibility() {
  hidden.value = document.hidden
  if (hidden.value) { stop(); pose.value = themeIconPose(props.mode) }
}
onMounted(() => {
  syncVisibility()
  document.addEventListener('visibilitychange', syncVisibility)
})
onBeforeUnmount(() => { stop(); document.removeEventListener('visibilitychange', syncVisibility) })
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false" :data-icon-mode="mode" :data-morphing="morphing">
    <defs><clipPath :id="clipId"><path :d="outline" fill="currentColor" stroke="none" /></clipPath></defs>
    <g class="theme-morph-rays" :opacity="rayReveal" stroke-width="1.9">
      <path v-for="angle in rays" :key="angle" :transform="'rotate(' + angle + ' 12 12)'"
        :d="'M12 ' + (7.9 - 5.2 * rayReveal) + 'V' + (7.9 - 3 * rayReveal)" />
    </g>
    <g :clip-path="'url(#' + clipId + ')'">
    <g :opacity="pose.globe" stroke-width="1.5"
      :transform="'translate(12 12) scale(' + (0.46 + pose.globe * 0.54) + ') rotate(-12) translate(-12 -12)'">
      <path d="M3 12h18M4.2 7.5h15.6M4.2 16.5h15.6" />
      <ellipse v-for="meridian in meridians" :key="meridian.phase" class="zen-globe-meridian"
        cx="12" cy="12" :rx="meridian.radius" ry="9">
        <animate v-if="!reducedMotion && !hidden && pose.globe > 0" attributeName="rx"
          values="9;0;9" keyTimes="0;0.5;1" calcMode="spline"
          keySplines="0.37 0 0.63 1;0.37 0 0.63 1" dur="12s"
          :begin="meridian.phase" repeatCount="indefinite" />
      </ellipse>
    </g>
    </g>
    <path class="theme-morph-outline" :d="outline" :stroke-width="1.9 - pose.globe * 0.4" />
    <g class="theme-morph-stars"
      :class="{ 'theme-morph-stars--playing': mode === 'moon' && !morphing && !hidden && !reducedMotion }"
      :opacity="pose.moon" fill="currentColor" stroke="none"
      :transform="'translate(17 6) scale(' + (0.35 + pose.moon * 0.65) + ') translate(-17 -6)'">
      <path class="theme-morph-star" d="M17 2.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9Z" />
      <path class="theme-morph-star theme-morph-star--small" d="M21 8.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5Z" />
    </g>
  </svg>
</template>

<style scoped>
.theme-morph-star {
  animation: moon-star-glimmer 6s ease-in-out infinite;
  animation-play-state: paused;
}
.theme-morph-star--small { animation-delay: -2.4s; }
.theme-morph-stars--playing .theme-morph-star { animation-play-state: running; }
@keyframes moon-star-glimmer {
  0%, 100% { opacity: 0.35; }
  35%, 55% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .theme-morph-star { animation: none; opacity: 1; }
}
</style>
