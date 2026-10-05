<script setup lang="ts">
// Adapted from Natalia's Snoopy eye demo; see assets/snoopy-eye/LICENSE.txt.
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { gsap } from 'gsap'
import { createSnoopyEyeTarget, eyeOpeningPath } from '@/shared/utils/snoopyEye'

const props = withDefaults(defineProps<{
  autonomous?: boolean; openness?: number; gazeY?: number
  discOpacity?: number; outlineOpacity?: number
}>(), { autonomous: true, openness: 1, gazeY: 0, discOpacity: 1, outlineOpacity: 1 })
const clipId = 'eye-opening-' + useId().replace(/:/g, '-')
const opening = computed(() => eyeOpeningPath(props.openness))
const controlledGaze = computed(() => props.autonomous ? undefined : { transform: `translateY(${props.gazeY * 12}px)` })
const controlledIris = computed(() => props.autonomous ? undefined : { transform: `translateY(${props.gazeY * 1.25}px)` })
watch(() => props.autonomous, syncMotion)

const irisRef = ref<SVGEllipseElement | null>(null)
const pupilRef = ref<SVGEllipseElement | null>(null)
let reducedMotion: MediaQueryList | undefined
let timer: number | null = null
let mounted = false

function clearTimer() {
  if (timer !== null) window.clearTimeout(timer)
  timer = null
}
function canMove() {
  return props.autonomous && mounted && !reducedMotion?.matches && document.visibilityState === 'visible'
}
function stopTweens() {
  if (irisRef.value) gsap.killTweensOf(irisRef.value)
  if (pupilRef.value) gsap.killTweensOf(pupilRef.value)
}
function moveEye() {
  timer = null
  if (!canMove() || !irisRef.value || !pupilRef.value) return
  const target = createSnoopyEyeTarget()
  const timing = { duration: target.duration, ease: 'power1.out', overwrite: 'auto' as const }
  gsap.to(irisRef.value, { ...target.iris, ...timing })
  gsap.to(pupilRef.value, { ...target.pupil, ...timing })
  timer = window.setTimeout(moveEye, Math.round(target.duration * 1000) + target.pause)
}
function syncMotion() {
  clearTimer()
  stopTweens()
  if (canMove()) timer = window.setTimeout(moveEye, 700)
  else {
    if (irisRef.value) gsap.set(irisRef.value, { xPercent: 0, yPercent: 0 })
    if (pupilRef.value) gsap.set(pupilRef.value, { xPercent: 0, yPercent: 0 })
  }
}

onMounted(() => {
  mounted = true
  if (pupilRef.value) gsap.set(pupilRef.value, { transformOrigin: '50% 50%' })
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.addEventListener('change', syncMotion)
  document.addEventListener('visibilitychange', syncMotion)
  syncMotion()
})
onBeforeUnmount(() => {
  mounted = false
  clearTimer()
  reducedMotion?.removeEventListener('change', syncMotion)
  document.removeEventListener('visibilitychange', syncMotion)
  stopTweens()
})
</script>

<template>
  <svg class="snoopy-eye" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <defs><clipPath :id="clipId"><path :d="opening" /></clipPath></defs>
    <ellipse class="snoopy-eye-disc" cx="50" cy="50" fill="var(--color-snoopy-eye-disc)" :opacity="props.discOpacity" stroke-width="0" rx="50" ry="50" />
    <path fill="var(--color-snoopy-eye-white)" stroke-width="0" :d="opening" />
    <g :clip-path="props.openness < 1 || !props.autonomous ? `url(#${clipId})` : undefined"><g :style="controlledIris">
    <ellipse ref="irisRef" cx="50" cy="50" fill="var(--color-snoopy-eye-iris)" stroke-width="0" rx="25" ry="25" />
    </g><g :style="controlledGaze">
    <ellipse ref="pupilRef" cx="50" cy="50" fill="var(--color-snoopy-eye-ink)" stroke-width="0" rx="8" ry="8" />
    </g></g>
    <path class="snoopy-eye-outline" fill="none" stroke="var(--color-snoopy-eye-ink)" :opacity="props.outlineOpacity" stroke-width="4.5" :d="opening" />
  </svg>
</template>

<style scoped>
.snoopy-eye { display: block; width: 100%; height: auto; aspect-ratio: 1; }
</style>
