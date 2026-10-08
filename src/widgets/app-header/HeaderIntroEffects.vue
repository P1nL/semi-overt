<script setup lang="ts">
import { computed, useId } from 'vue'
import { useHomeIntro, HOME_INTRO, INTRO_MOTION, progress, out, categoryEntryPose, categoryVisualBounds, seedSeparationProgress } from '@/features/home-intro'
import { getHeaderSeedFrame } from './model/headerSeed'
import { BUTTON_BURST_RAYS, buttonBurstRay } from '@/shared/utils/buttonBurst'
const intro = useHomeIntro()!
const emissionId = 'intro-seed-emission-' + useId().replace(/:/g, '-')
const gradientId = emissionId + '-color'
const t = computed(() => intro.time.value)
const home = computed(() => intro.rects.value.home)
const tools = computed(() => intro.rects.value.tools)
const category = computed(() => intro.rects.value.category)
const spark = computed(() => progress(t.value, HOME_INTRO.home, INTRO_MOTION.spark))
const rays = BUTTON_BURST_RAYS
const seed = computed(() => {
  const c = category.value, n = tools.value
  if (!c || !n) return null
  const h = home.value
  const origin = h ? h.left + h.width / 2 - c.left - c.width / 2 : -56
  const donor = categoryVisualBounds(c, categoryEntryPose(t.value, origin))
  return getHeaderSeedFrame(c, n,
    seedSeparationProgress(t.value),
    progress(t.value, HOME_INTRO.seedDetached, HOME_INTRO.capsule - HOME_INTRO.seedDetached),
    out(progress(t.value, HOME_INTRO.capsule, HOME_INTRO.capsuleReady - HOME_INTRO.capsule)), donor)
})
</script>
<template>
    <svg v-if="intro.active.value && home" class="header-intro-effects" :viewBox="`0 0 ${intro.viewport.value.width} ${intro.viewport.value.height}`" aria-hidden="true">
      <defs>
        <radialGradient :id="gradientId" cx="42%" cy="38%" r="65%">
          <stop offset="0" stop-color="var(--color-intro-seed-light)" />
          <stop offset=".55" stop-color="var(--color-intro-seed-core)" />
          <stop offset="1" stop-color="var(--color-intro-seed-edge)" />
        </radialGradient>
        <filter :id="emissionId" x="-70%" y="-70%" width="240%" height="240%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="emission" />
          <feMerge><feMergeNode in="emission" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g v-if="t >= HOME_INTRO.home && spark < 1" :transform="`translate(${home.left + home.width / 2} ${home.top + home.height / 2})`" :opacity="1 - spark">
        <line v-for="(_, i) in rays" :key="i" v-bind="buttonBurstRay(i, spark)" stroke="var(--color-brand-logo-bg)" stroke-width="2" stroke-linecap="round" />
      </g>
      <g v-if="seed && t > HOME_INTRO.seed && t < HOME_INTRO.capsuleReady" :data-seed-phase="t < HOME_INTRO.seedDetached ? 'separating' : t < HOME_INTRO.capsule ? 'flying' : 'growing'">
        <path v-if="seed.neck" class="header-intro-neck" :d="seed.neck" :opacity="seed.neckOpacity" fill="var(--color-brand-logo-bg)" />
        <rect class="header-intro-seed" :x="seed.x" :y="seed.y" :width="seed.width" :height="seed.height" :rx="seed.height / 2" fill="var(--color-brand-logo-bg)" />
        <rect class="header-intro-seed-emission" :x="seed.x" :y="seed.y" :width="seed.width" :height="seed.height" :rx="seed.height / 2" :fill="`url(#${gradientId})`" :opacity="seed.emissionOpacity" :filter="`url(#${emissionId})`" />
      </g>
    </svg>
</template>
<style scoped>
.header-intro-effects { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; z-index: 39; pointer-events: none; }
</style>
