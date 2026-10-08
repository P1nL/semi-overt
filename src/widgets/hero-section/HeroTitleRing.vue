<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TextPressure from '@/shared/components/TextPressure.vue'
import ScrambleText from '@/shared/components/ScrambleText.vue'
import SnoopyEye from '@/shared/components/SnoopyEye.vue'
import HeroTesseract from './HeroTesseract.vue'
import IntroGlyph from './IntroGlyph.vue'
import { useIntroTarget, HOME_INTRO, INTRO_MOTION, glyphStart, introEmoji, gazeAt } from '@/features/home-intro'
import HeroCubeGlyph from './HeroCubeGlyph.vue'
import { useAnimationVisibility } from '@/shared/composables/useAnimationVisibility'
import { createFrameLimiter } from '@/shared/utils/animationFrame'
import { usePageMotion } from '@/shared/composables/usePageMotion'
import { advanceTitleOrbit, createTitleOrbit, getTitleOrbitPose, getTitleOrbitHitDistance } from './model/titleOrbit'

const props = defineProps<{ title: string; containerRef: HTMLElement | null }>()
const pageMotion = usePageMotion()
const motionFrozen = computed(() => !!pageMotion && pageMotion.phase.value !== 'idle')
const glyphs = computed(() => createTitleOrbit(props.title))
const root = ref<HTMLElement | null>(null)
const intro = useIntroTarget('eye', () => root.value?.querySelector('.hero-orbit-front-eye .snoopy-eye'))
const introActive = computed(() => intro?.active.value ?? false)
const introTime = computed(() => intro?.time.value ?? HOME_INTRO.end)
const halfCount = computed(() => glyphs.value.length / 2)
const eyeIndex = computed(() => Math.max(0, glyphs.value.slice(0, halfCount.value).findIndex(glyph => glyph.eye)))
function starts(index: number) { return glyphStart(index % halfCount.value, halfCount.value, eyeIndex.value, index >= halfCount.value) }
function glyphVisible(index: number) {
  if (!introActive.value) return true
  const glyph = glyphs.value[index]!
  return glyph.eyeStyle === 'snoopy' && glyph.eye ? introTime.value >= HOME_INTRO.revealed : introTime.value >= starts(index)
}
function scramblingIntro(index: number) {
  const glyph = glyphs.value[index]!
  return !(glyph.eye && glyph.eyeStyle === 'letter') && introActive.value && index >= halfCount.value && introTime.value < starts(index) + INTRO_MOTION.emoji
}
function cubeEntryProgress(index: number) {
  if (!introActive.value) return 1
  return Math.max(0, Math.min(1, (introTime.value - starts(index)) / INTRO_MOTION.emoji))
}
const { visible, reducedMotion } = useAnimationVisibility(root)
const limiter = createFrameLimiter(60)
const elements = ref<Array<HTMLElement | null>>([])
let width = 0
let phase = 0
let frame = 0
let mounted = false
let observer: ResizeObserver | undefined
let stopStarted = -Infinity
const slowing = () => pageMotion?.phase.value === 'leave' && performance.now() - stopStarted < 500

let hitCache: { x: number; y: number; effect: string | null } | null = null

function matchesRegion(point: { x: number; y: number }, effect: 'pressure' | 'scramble') {
  if (!hitCache || hitCache.x !== point.x || hitCache.y !== point.y) {
    const distances = (['pressure', 'scramble'] as const).map(group => {
      const rects = glyphs.value.flatMap((glyph, index) => {
        const element = elements.value[index]
        return glyph.effect === group && element ? [element.getBoundingClientRect()] : []
      })
      return { effect: group, distance: getTitleOrbitHitDistance(point, rects) }
    }).sort((a, b) => a.distance - b.distance)
    const closest = distances[0]
    hitCache = { ...point, effect: closest && Number.isFinite(closest.distance) ? closest.effect : null }
  }
  return hitCache.effect === effect
}
const pressureRegion = (point: { x: number; y: number }) => matchesRegion(point, 'pressure')

function paint() {
  hitCache = null
  glyphs.value.forEach((glyph, index) => {
    const element = elements.value[index]
    if (!element) return
    const pose = getTitleOrbitPose(glyph.angle, phase)
    element.style.setProperty('--glyph-orbit-yaw', `${pose.cubeYaw}rad`)
    if (glyph.eye) {
      element.style.setProperty('--cube-orbit-yaw', `${pose.cubeYaw}rad`)
      element.style.setProperty('--eye-orbit-yaw', `${pose.cubeYaw}rad`)
    }
    // All glyphs retain their proportions; radial rotation provides foreshortening.
    const scaleX = pose.scaleY
    element.style.transform = 'translate(' + pose.x * width + 'px, ' + pose.y + 'em) translate(-50%, -50%) scale(' + scaleX + ', ' + pose.scaleY + ')'
    // Emoji and real glyphs share this exact depth plane for the entire intro.
    element.style.opacity = String(pose.opacity)
    element.style.filter = 'blur(' + pose.blur + 'px)'
    element.style.zIndex = String(Math.round(pose.front * 10))
    element.style.pointerEvents = glyph.effect === 'scramble' || pose.front > 0.5 ? 'auto' : 'none'
  })
}
function tick(time: number) {
  frame = 0
  const stopping = slowing()
  if (!mounted || reducedMotion.value || introActive.value || ((!visible.value || motionFrozen.value) && !stopping)) return
  const elapsed = limiter.consume(time)
  if (elapsed !== null) {
    const speed = stopping ? Math.max(0, 1 - (time - stopStarted) / 500) : 1
    phase = advanceTitleOrbit(phase, Math.min(64, elapsed) * speed)
    paint()
  }
  frame = requestAnimationFrame(tick)
}
function sync() {
  cancelAnimationFrame(frame)
  frame = 0
  limiter.reset()
  if (reducedMotion.value) phase = 0
  if (visible.value) paint()
  if (mounted && !reducedMotion.value && !introActive.value && ((visible.value && !motionFrozen.value) || slowing())) frame = requestAnimationFrame(tick)
}
watch([visible, reducedMotion], sync)
watch(introActive, sync)
watch(motionFrozen, sync)
watch(() => pageMotion?.phase.value, value => {
  if (value === 'leave') stopStarted = performance.now()
  sync()
}, { flush: 'sync' })
watch(() => props.title, () => { phase = 0; elements.value.length = glyphs.value.length; paint() }, { flush: 'post' })
onMounted(() => {
  mounted = true
  width = root.value?.clientWidth ?? 0
  paint()
  observer = new ResizeObserver(() => { width = root.value?.clientWidth ?? 0; paint() })
  if (root.value) observer.observe(root.value)
  sync()
})
onBeforeUnmount(() => {
  mounted = false
  cancelAnimationFrame(frame)
  observer?.disconnect()
})
</script>

<template>
  <span ref="root" class="hero-title-orbit" :inert="introActive" aria-hidden="true">
    <HeroTesseract data-page-motion="home-bottom" />
    <span v-for="(glyph, index) in glyphs" :key="index" :ref="element => { elements[index] = element as HTMLElement | null }" class="hero-orbit-glyph" :class="{ 'hero-orbit-letter': !glyph.eye }" :style="{ fontFamily: glyph.fontFamily }">
      <span class="hero-glyph-motion" data-page-motion="glyph">
      <span class="hero-glyph-entry" :style="{ visibility: glyphVisible(index) ? 'visible' : 'hidden' }" :data-intro-glyph="index">
      <span class="hero-glyph-content" :style="scramblingIntro(index) ? { visibility: 'hidden' } : undefined">
      <IntroGlyph v-if="introActive && glyph.effect === 'pressure' && !glyph.eye" :letter="glyph.letter" :elapsed="introTime - starts(index)" />
      <template v-else-if="glyph.eye">
        <HeroCubeGlyph v-if="glyph.eyeStyle === 'letter'" :entry-progress="cubeEntryProgress(index)" />
        <span v-else class="hero-title-eye hero-orbit-front-eye"><SnoopyEye data-intro-anchor="eye" :autonomous="!introActive && visible && !motionFrozen" :gaze-y="introActive ? gazeAt(introTime) : 0" /></span>
      </template>
      <ScrambleText v-else-if="glyph.effect === 'scramble'" :text="glyph.letter" :duration="1.5" :speed="0.16" />
      <TextPressure v-else :text="glyph.letter" :container-ref="containerRef" :pointer-region="pressureRegion" />
      </span>
      <span v-if="scramblingIntro(index)" class="hero-intro-emoji" :data-emoji-slot="index % halfCount" :data-emoji-letter="glyph.letter"><span>{{ introEmoji(index % halfCount, introTime - starts(index)) }}</span></span>
      </span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.hero-glyph-entry { position: relative; display: block; }
.hero-glyph-motion { display: block; transform-origin: center; transform-style: preserve-3d; }
.hero-glyph-content { display: block; }
.hero-intro-emoji { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; font-family: 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif; }
.hero-intro-emoji > span { display: block; font-size: .72em; line-height: 1; }
.hero-title-orbit { position: relative; display: block; height: 1.12em; isolation: isolate; }
.hero-orbit-glyph {
  position: absolute;
  left: 50%;
  top: 0;
  width: 0.85em;
  line-height: 1;
  text-align: center;
  transform-origin: center;
  font-synthesis: none;
}
.hero-orbit-letter { perspective: 4em; }
.hero-orbit-letter > .hero-glyph-motion > .hero-glyph-entry { transform: rotateY(var(--glyph-orbit-yaw, 0rad)) rotateZ(var(--glyph-local-roll, 0deg)); transform-origin: center; }
.hero-orbit-glyph :deep(.text-pressure) { font-family: inherit; }
.hero-orbit-front-eye { display: grid; align-items: center; height: 1em; perspective: 4em; }
.hero-orbit-front-eye :deep(.snoopy-eye) { transform: rotateY(var(--eye-orbit-yaw, 0rad)) rotateZ(var(--glyph-local-roll, 0deg)); transform-origin: center; }
</style>
