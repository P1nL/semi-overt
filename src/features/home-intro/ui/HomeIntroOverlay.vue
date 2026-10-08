<script setup lang="ts">
import { computed } from 'vue'
import SnoopyEye from '@/shared/components/SnoopyEye.vue'
import IntroEyeLoading from './IntroEyeLoading.vue'
import { eyeOpeningEase, eyeOpeningPath } from '@/shared/utils/snoopyEye'
import { coveringRadius, radialRevealEase } from '@/shared/utils/radialReveal'
import { useHomeIntro } from '../model/context'
import { HOME_INTRO, INTRO_MOTION, HOME_INTRO_DURATION_MS, out, progress, toPlaybackTime } from '../model/choreography'

const intro = useHomeIntro()!
const t = computed(() => intro.time.value)
const playbackTime = computed(() => toPlaybackTime(t.value))
const eye = computed(() => intro.rects.value.eye)
const opened = computed(() => eyeOpeningEase(progress(t.value, HOME_INTRO.open, INTRO_MOTION.eyeOpen)))
const opening = computed(() => eyeOpeningPath(opened.value))
const loadingProgress = computed(() => progress(t.value, HOME_INTRO.loading, HOME_INTRO.filled - HOME_INTRO.loading))
const tileSeamFade = computed(() => out(progress(t.value, HOME_INTRO.filled, 240)))
const lidEntry = computed(() => out(progress(t.value, HOME_INTRO.filled, HOME_INTRO.open - HOME_INTRO.filled)))
const blend = computed(() => progress(t.value, HOME_INTRO.open, INTRO_MOTION.eyeBlend))
const eyeStyle = computed(() => eye.value ? {
  left: `${eye.value.left}px`, top: `${eye.value.top}px`, width: `${eye.value.width}px`, height: `${eye.value.height}px`,
} : undefined)
const coverPath = computed(() => {
  const { width: w, height: h } = intro.viewport.value
  const e = eye.value
  if (!e || t.value <= HOME_INTRO.open) return `M0 0H${w}V${h}H0Z`
  const x = e.left + e.width / 2, y = e.top + e.height / 2
  const r = coveringRadius(x, y, w, h) * radialRevealEase(progress(t.value, HOME_INTRO.open, HOME_INTRO.revealed - HOME_INTRO.open))
  return `M0 0H${w}V${h}H0Z M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
})
</script>

<template>
  <Teleport to="body">
    <div v-if="intro.active.value" class="home-intro-overlay" :data-intro-phase="intro.phase.value" :data-intro-time="Math.round(playbackTime)">
      <svg v-if="t < HOME_INTRO.revealed" class="home-intro-cover" :viewBox="`0 0 ${intro.viewport.value.width} ${intro.viewport.value.height}`" preserveAspectRatio="none" aria-hidden="true">
        <path :d="coverPath" fill-rule="evenodd" />
      </svg>
      <div v-if="eye && t < HOME_INTRO.revealed" class="home-intro-eye" :style="eyeStyle" aria-hidden="true">
        <IntroEyeLoading v-if="t < HOME_INTRO.filled + 240" :progress="loadingProgress" />
        <!-- Cover the completed tiles gradually, so only their seams dissolve. -->
        <svg v-if="t >= HOME_INTRO.filled" class="home-intro-eye-disc" :style="{ opacity: tileSeamFade }" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
        <SnoopyEye :autonomous="false" :openness="opened" :disc-opacity="0" :outline-opacity="0" />
        <svg class="home-intro-eye-lines" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48.8" fill="none" stroke-width="1.5" pathLength="1" stroke-dasharray="1" :opacity="1 - blend" :stroke-dashoffset="1 - progress(t, 0, INTRO_MOTION.outline)" transform="rotate(-90 50 50)" />
          <!-- One persistent contour: the traced slit becomes both lids.
               Iris/pupil clipping uses the exact same opening geometry. -->
          <path class="home-intro-eyelids" :d="opening" fill="none" :stroke-width="2.6 + 1.9 * blend" :style="{ stroke: `color-mix(in srgb, var(--color-snoopy-eye-ink) ${blend * 100}%, var(--color-text))`, transform: `scaleX(${lidEntry})`, transformOrigin: '50px 50px' }" />
        </svg>
      </div>
      <button class="home-intro-skip" type="button" @click="intro.skip">跳过动画 <span aria-hidden="true">↗</span></button>
      <div v-if="intro.debug && t >= 0" class="home-intro-debug" :data-intro-geometry="JSON.stringify(intro.rects.value)">
        <label for="intro-time">{{ intro.phase.value }} · {{ Math.round(playbackTime) }}ms</label>
        <input id="intro-time" aria-label="开场动画进度" type="range" min="0" :max="HOME_INTRO_DURATION_MS - 1" step="1" :value="playbackTime" @input="intro.seek(Number(($event.target as HTMLInputElement).value))" />
        <button type="button" @click="intro.play">播放</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.home-intro-overlay { position: fixed; inset: 0; z-index: 200; pointer-events: none; }
.home-intro-cover { position: absolute; inset: 0; width: 100%; height: 100%; fill: var(--color-splash-cover); }
.home-intro-eye { position: absolute; }
.home-intro-eye-disc { position: absolute; inset: 0; width: 100%; height: 100%; fill: var(--color-snoopy-eye-disc); }
.home-intro-eye > :deep(.snoopy-eye) { position: relative; }
.home-intro-eye-lines { position: absolute; inset: 0; width: 100%; height: 100%; stroke: var(--color-text); stroke-linecap: round; }
.home-intro-skip { position: absolute; right: max(24px, env(safe-area-inset-right)); bottom: max(24px, env(safe-area-inset-bottom)); pointer-events: auto; min-height: 44px; padding: 0 12px; color: var(--color-text-muted); font-size: 12px; letter-spacing: .08em; cursor: pointer; }
.home-intro-skip:focus-visible, .home-intro-debug button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
.home-intro-debug { position: absolute; left: 16px; bottom: 16px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 12px; max-width: calc(100vw - 120px); background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); pointer-events: auto; font-size: 12px; }
.home-intro-debug input { width: min(320px, 45vw); }
</style>
