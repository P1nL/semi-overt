<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { ArticleCardVm } from '@/entities/article/model/article.types'

import ArticleParallaxGalleryCard from './ArticleParallaxGalleryCard.vue'

type GalleryTrackItem = {
  article: ArticleCardVm
  key: string
}

const props = defineProps<{
  items: ArticleCardVm[]
}>()

const galleryRef = ref<HTMLElement | null>(null)
const topTrackRef = ref<HTMLElement | null>(null)
const bottomTrackRef = ref<HTMLElement | null>(null)
const hasMounted = ref(false)
const viewportWidth = ref(0)
const prefersReducedMotion = ref(false)
const coarsePointer = ref(false)
const wheelCurrent = ref(0)
const wheelTarget = ref(0)
const wheelVelocity = ref(0)
const topCycleWidth = ref(0)
const bottomCycleWidth = ref(0)

let resizeFrame = 0
let introFrame = 0
let wheelFrame = 0
let resizeObserver: ResizeObserver | null = null
let reduceMotionQuery: MediaQueryList | null = null
let coarsePointerQuery: MediaQueryList | null = null

const topBaseItems = computed(() => {
  if (!props.items.length) return []

  const top = props.items.filter((_, index) => index % 2 === 0)
  return top.length ? top : props.items.slice(0, 1)
})

const bottomBaseItems = computed(() => {
  if (!props.items.length) return []

  const bottom = props.items.filter((_, index) => index % 2 === 1)

  if (bottom.length) return bottom
  if (props.items.length === 1) return props.items

  return props.items.slice(0, Math.min(2, props.items.length)).reverse()
})

const cardWidthEstimate = computed(() => {
  if (viewportWidth.value < 640) return 260
  if (viewportWidth.value < 1024) return 286
  return 320
})

function resolveRepeatCount(baseCount: number): number {
  if (!baseCount) return 1

  const safeViewport = viewportWidth.value || 1280
  const gap = safeViewport < 640 ? 14 : 18
  const visibleTargetWidth = safeViewport * 2.6
  const estimatedBaseWidth = baseCount * (cardWidthEstimate.value + gap)

  return Math.max(3, Math.ceil(visibleTargetWidth / Math.max(estimatedBaseWidth, 1)))
}

const topRepeatCount = computed(() => resolveRepeatCount(topBaseItems.value.length))
const bottomRepeatCount = computed(() => resolveRepeatCount(bottomBaseItems.value.length))

function buildTrackItems(baseItems: ArticleCardVm[], repeatCount: number): GalleryTrackItem[] {
  if (!baseItems.length) return []

  return Array.from({ length: repeatCount }, (_, groupIndex) =>
    baseItems.map((article, itemIndex) => ({
      article,
      key: `group-${groupIndex}-item-${itemIndex}-article-${article.id}`,
    })),
  ).flat()
}

function buildLoopTrackItems(cycleItems: GalleryTrackItem[]): GalleryTrackItem[] {
  if (!cycleItems.length) return []

  return ['lead', 'center', 'trail'].flatMap((segment) =>
    cycleItems.map((item) => ({
      ...item,
      key: `${segment}-${item.key}`,
    })),
  )
}

function normalizeLoopOffset(value: number, cycleWidth: number) {
  if (!cycleWidth) return 0
  return ((value % cycleWidth) + cycleWidth) % cycleWidth
}

const topCycleItems = computed(() => buildTrackItems(topBaseItems.value, topRepeatCount.value))
const bottomCycleItems = computed(() => buildTrackItems(bottomBaseItems.value, bottomRepeatCount.value))
const topTrackItems = computed(() => buildLoopTrackItems(topCycleItems.value))
const bottomTrackItems = computed(() => buildLoopTrackItems(bottomCycleItems.value))

const topSpeed = computed(() => (coarsePointer.value ? 0.2 : 0.4))
const bottomSpeed = computed(() => (coarsePointer.value ? 0.1 : 0.2))

const topTranslate = computed(() => {
  if (!topCycleWidth.value) return 0

  const baseOffset = -topCycleWidth.value
  if (prefersReducedMotion.value) return baseOffset

  const offset = normalizeLoopOffset(wheelCurrent.value * topSpeed.value, topCycleWidth.value)
  return baseOffset - offset
})

const bottomTranslate = computed(() => {
  if (!bottomCycleWidth.value) return -120

  const baseOffset = -120 - bottomCycleWidth.value
  if (prefersReducedMotion.value) return baseOffset

  const offset = normalizeLoopOffset(wheelCurrent.value * bottomSpeed.value, bottomCycleWidth.value)
  return baseOffset + offset
})

const topTrackStyle = computed(() => ({
  '--gallery-track-offset': `${topTranslate.value}px`,
}))

const bottomTrackStyle = computed(() => ({
  '--gallery-track-offset': `${bottomTranslate.value}px`,
}))

function syncViewportState() {
  viewportWidth.value = window.innerWidth
  prefersReducedMotion.value = Boolean(reduceMotionQuery?.matches)
  coarsePointer.value = Boolean(coarsePointerQuery?.matches)
}

async function measureTracks() {
  await nextTick()

  topCycleWidth.value = measureTrackCycleWidth(topTrackRef.value, topCycleItems.value.length)
  bottomCycleWidth.value = measureTrackCycleWidth(bottomTrackRef.value, bottomCycleItems.value.length)
}

function measureTrackCycleWidth(track: HTMLElement | null, cycleItemCount: number) {
  if (!track || !cycleItemCount) return 0

  const items = Array.from(track.children).slice(0, cycleItemCount) as HTMLElement[]
  if (!items.length) return 0

  const trackStyle = window.getComputedStyle(track)
  const resolvedGap = Number.parseFloat(trackStyle.columnGap || trackStyle.gap || '0') || 0

  return items.reduce((sum, item) => sum + item.getBoundingClientRect().width, 0) + resolvedGap * Math.max(items.length - 1, 0)
}

function stopWheelAnimation() {
  if (wheelFrame) {
    window.cancelAnimationFrame(wheelFrame)
    wheelFrame = 0
  }
}

function normalizeWheelRange() {
  const cycle = Math.max(topCycleWidth.value / Math.max(topSpeed.value, 0.001), bottomCycleWidth.value / Math.max(bottomSpeed.value, 0.001), 1)

  if (Math.abs(wheelCurrent.value) > cycle * 40 || Math.abs(wheelTarget.value) > cycle * 40) {
    wheelCurrent.value %= cycle
    wheelTarget.value %= cycle
  }
}

function animateWheelParallax() {
  stopWheelAnimation()

  const tick = () => {
    if (Math.abs(wheelVelocity.value) > 0.02) {
      wheelTarget.value += wheelVelocity.value
      wheelVelocity.value *= 0.92
    }

    const delta = wheelTarget.value - wheelCurrent.value

    if (Math.abs(delta) < 0.45 && Math.abs(wheelVelocity.value) < 0.02) {
      wheelCurrent.value = wheelTarget.value
      wheelVelocity.value = 0
      wheelFrame = 0
      normalizeWheelRange()
      return
    }

    wheelCurrent.value += delta * 0.16
    wheelFrame = window.requestAnimationFrame(tick)
  }

  wheelFrame = window.requestAnimationFrame(tick)
}

function onGalleryWheel(event: WheelEvent) {
  if (!props.items.length) return
  if (prefersReducedMotion.value) return

  const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
  if (!dominantDelta) return

  event.preventDefault()
  wheelTarget.value += dominantDelta
  wheelVelocity.value += dominantDelta * 0.16
  wheelVelocity.value = Math.max(Math.min(wheelVelocity.value, 42), -42)
  animateWheelParallax()
}

function queueMeasure() {
  if (resizeFrame) {
    window.cancelAnimationFrame(resizeFrame)
  }

  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = 0
    syncViewportState()
    void measureTracks()
  })
}

function handleMediaChange() {
  syncViewportState()
  if (prefersReducedMotion.value) {
    hasMounted.value = true
    wheelCurrent.value = 0
    wheelTarget.value = 0
    wheelVelocity.value = 0
    stopWheelAnimation()
  }

  queueMeasure()
}

onMounted(async () => {
  reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  coarsePointerQuery = window.matchMedia('(pointer: coarse)')

  syncViewportState()

  reduceMotionQuery.addEventListener('change', handleMediaChange)
  coarsePointerQuery.addEventListener('change', handleMediaChange)
  window.addEventListener('resize', queueMeasure, { passive: true })

  resizeObserver = new ResizeObserver(() => {
    queueMeasure()
  })

  if (galleryRef.value) {
    resizeObserver.observe(galleryRef.value)
  }

  await measureTracks()

  if (prefersReducedMotion.value) {
    hasMounted.value = true
    return
  }

  introFrame = window.requestAnimationFrame(() => {
    introFrame = window.requestAnimationFrame(() => {
      hasMounted.value = true
    })
  })
})

watch(
  () => [props.items.length, topCycleItems.value.length, bottomCycleItems.value.length],
  () => {
    queueMeasure()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  if (resizeFrame) {
    window.cancelAnimationFrame(resizeFrame)
  }
  if (introFrame) {
    window.cancelAnimationFrame(introFrame)
  }
  stopWheelAnimation()

  window.removeEventListener('resize', queueMeasure)
  resizeObserver?.disconnect()

  reduceMotionQuery?.removeEventListener('change', handleMediaChange)
  coarsePointerQuery?.removeEventListener('change', handleMediaChange)
})
</script>

<template>
  <section
    ref="galleryRef"
    class="article-parallax-gallery"
    aria-label="文章画廊"
    @wheel="onGalleryWheel"
  >
    <div class="article-parallax-gallery__row">
      <div class="article-parallax-gallery__viewport">
        <div
          class="article-parallax-gallery__stage article-parallax-gallery__stage--top"
          :class="{ 'article-parallax-gallery__stage--mounted': hasMounted }"
        >
          <div
            ref="topTrackRef"
            class="article-parallax-gallery__track"
            :style="topTrackStyle"
          >
            <div
              v-for="item in topTrackItems"
              :key="item.key"
              class="article-parallax-gallery__item"
            >
              <div class="article-parallax-gallery__item-shell">
                <ArticleParallaxGalleryCard :article="item.article" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="article-parallax-gallery__row">
      <div class="article-parallax-gallery__viewport">
        <div
          class="article-parallax-gallery__stage article-parallax-gallery__stage--bottom"
          :class="{ 'article-parallax-gallery__stage--mounted': hasMounted }"
        >
          <div
            ref="bottomTrackRef"
            class="article-parallax-gallery__track"
            :style="bottomTrackStyle"
          >
            <div
              v-for="item in bottomTrackItems"
              :key="item.key"
              class="article-parallax-gallery__item"
            >
              <div class="article-parallax-gallery__item-shell">
                <ArticleParallaxGalleryCard :article="item.article" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.article-parallax-gallery {
  --gallery-row-height: 24rem;
  --gallery-row-gap: 1rem;
  --gallery-card-width: 20.25rem;
  --gallery-card-gap: 0.9rem;
  --gallery-hover-lift: 0.75rem;
  position: relative;
  width: 100vw;
  height: calc((var(--gallery-row-height) + var(--gallery-hover-lift)) * 2 + var(--gallery-row-gap));
  margin-left: calc(50% - 50vw);
  overflow: hidden;
  isolation: isolate;
}

.article-parallax-gallery__row {
  position: relative;
  height: calc(var(--gallery-row-height) + var(--gallery-hover-lift));
  padding-top: var(--gallery-hover-lift);
  box-sizing: border-box;
  overflow: visible;
}

.article-parallax-gallery__row + .article-parallax-gallery__row {
  margin-top: var(--gallery-row-gap);
}

.article-parallax-gallery__viewport {
  height: 100%;
  overflow: visible;
  clip-path: inset(calc(-1 * var(--gallery-hover-lift)) 0 0 0);
}

.article-parallax-gallery__stage {
  opacity: 0;
  height: 100%;
  width: max-content;
  transform: translate3d(var(--gallery-entry-shift, 0px), 0, 0);
  transition:
    transform 800ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 800ms cubic-bezier(0.22, 1, 0.36, 1);
}

.article-parallax-gallery__stage--top {
  --gallery-entry-shift: 88px;
}

.article-parallax-gallery__stage--bottom {
  --gallery-entry-shift: -88px;
}

.article-parallax-gallery__stage--mounted {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

.article-parallax-gallery__track {
  display: flex;
  gap: var(--gallery-card-gap);
  width: max-content;
  transform: translate3d(var(--gallery-track-offset, 0px), 0, 0);
  will-change: transform;
}

.article-parallax-gallery__item {
  width: var(--gallery-card-width);
  height: var(--gallery-row-height);
  flex: 0 0 auto;
  overflow: visible;
  transition:
    opacity 220ms ease,
    filter 220ms ease;
}

.article-parallax-gallery__item-shell {
  height: 100%;
  transform-origin: center center;
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 260ms ease,
    box-shadow 260ms ease;
  will-change: transform;
}

@media (min-width: 768px) {
  .article-parallax-gallery {
    --gallery-row-height: 24.5rem;
    --gallery-card-width: 20.75rem;
    --gallery-card-gap: 1rem;
  }
}

@media (min-width: 1280px) {
  .article-parallax-gallery {
    --gallery-row-height: 25rem;
    --gallery-card-width: 21.25rem;
    --gallery-card-gap: 1.15rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .article-parallax-gallery__track,
  .article-parallax-gallery__stage,
  .article-parallax-gallery__item,
  .article-parallax-gallery__item-shell {
    transition: none;
  }
}
</style>
