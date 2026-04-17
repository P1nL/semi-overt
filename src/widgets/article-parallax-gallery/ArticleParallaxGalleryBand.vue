<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'

import type { ArticleCardVm } from '@/entities/article'
import ArticleParallaxGalleryCard from './ArticleParallaxGalleryCard.vue'
import { useGalleryWheelMotion } from './useGalleryWheelMotion'

interface GalleryBandItem {
  article: ArticleCardVm
  key: string
}

interface GalleryRenderItem extends GalleryBandItem {
  loopKey: string
}

const props = withDefaults(
  defineProps<{
    items: GalleryBandItem[]
    bandIndex: number
  }>(),
  {},
)

const sectionRef = ref<HTMLElement | null>(null)
const topTrackRef = ref<HTMLElement | null>(null)
const bottomTrackRef = ref<HTMLElement | null>(null)
const prefersReducedMotion = ref(false)
const viewportWidth = ref(0)
const topCycleWidth = ref(0)
const bottomCycleWidth = ref(0)
const pointerActive = ref(false)
const pointerX = ref(0)
const pointerY = ref(0)
const hoveredLoopKey = ref<string | null>(null)

let resizeFrame = 0
let reduceMotionQuery: MediaQueryList | null = null
let topTrackSetter: ((value: number) => void) | null = null
let bottomTrackSetter: ((value: number) => void) | null = null
let topItemWaveSetters: Array<(value: number) => void> = []
let bottomItemWaveSetters: Array<(value: number) => void> = []
let offsetTickScheduled = false

function splitTrackItems(items: GalleryBandItem[], takeEven: boolean) {
  const filtered = items.filter((_, index) => (takeEven ? index % 2 === 0 : index % 2 === 1))
  return filtered.length ? filtered : items.slice(0, Math.min(2, items.length))
}

function buildCycleItems(items: GalleryBandItem[], repeatCount: number): GalleryRenderItem[] {
  if (!items.length) return []

  return Array.from({ length: repeatCount }, (_, repeatIndex) =>
    items.map((item, itemIndex) => ({
      ...item,
      loopKey: `${item.key}-cycle-${repeatIndex}-${itemIndex}`,
    })),
  ).flat()
}

function buildLoopItems(items: GalleryRenderItem[]): GalleryRenderItem[] {
  if (!items.length) return []

  return ['lead', 'center', 'trail'].flatMap((segment) =>
    items.map((item) => ({
      ...item,
      loopKey: `${segment}-${item.loopKey}`,
    })),
  )
}

const cardWidthEstimate = computed(() => {
  if (viewportWidth.value < 640) return 288
  if (viewportWidth.value < 1024) return 336
  return 380
})

function resolveRepeatCount(baseCount: number) {
  if (!baseCount) return 1

  const safeViewport = viewportWidth.value || 1280
  const gap = safeViewport < 640 ? 16 : 20
  const visibleTargetWidth = safeViewport * 2.4
  const estimatedBaseWidth = baseCount * (cardWidthEstimate.value + gap)

  return Math.max(2, Math.ceil(visibleTargetWidth / Math.max(estimatedBaseWidth, 1)))
}

function normalizeLoopOffset(value: number, cycleWidth: number) {
  if (!cycleWidth) return 0
  return ((value % cycleWidth) + cycleWidth) % cycleWidth
}

const shouldSwapTracks = computed(() => props.bandIndex % 2 === 1)
const topBaseItems = computed(() => splitTrackItems(props.items, !shouldSwapTracks.value))
const bottomBaseItems = computed(() => splitTrackItems(props.items, shouldSwapTracks.value))
const topRepeatCount = computed(() => resolveRepeatCount(topBaseItems.value.length))
const bottomRepeatCount = computed(() => resolveRepeatCount(bottomBaseItems.value.length))
const topCycleItems = computed(() => buildCycleItems(topBaseItems.value, topRepeatCount.value))
const bottomCycleItems = computed(() => buildCycleItems(bottomBaseItems.value, bottomRepeatCount.value))
const topTrackItems = computed(() => buildLoopItems(topCycleItems.value))
const bottomTrackItems = computed(() => buildLoopItems(bottomCycleItems.value))

function syncReducedMotion() {
  prefersReducedMotion.value = Boolean(reduceMotionQuery?.matches)
}

function syncViewportWidth() {
  viewportWidth.value = window.innerWidth
}

function measureTrackCycleWidth(track: HTMLElement | null, cycleItemCount: number) {
  if (!track || !cycleItemCount) return 0

  const items = Array.from(track.children).slice(0, cycleItemCount) as HTMLElement[]
  if (!items.length) return 0

  const trackStyle = window.getComputedStyle(track)
  const resolvedGap = Number.parseFloat(trackStyle.columnGap || trackStyle.gap || '0') || 0

  return items.reduce((sum, item) => sum + item.getBoundingClientRect().width, 0) + resolvedGap * Math.max(items.length - 1, 0)
}

async function measureTracks() {
  await nextTick()
  topCycleWidth.value = measureTrackCycleWidth(topTrackRef.value, topCycleItems.value.length)
  bottomCycleWidth.value = measureTrackCycleWidth(bottomTrackRef.value, bottomCycleItems.value.length)
}

function syncTrackSetters() {
  topTrackSetter = topTrackRef.value
    ? (gsap.quickSetter(topTrackRef.value, 'x', 'px') as (value: number) => void)
    : null
  bottomTrackSetter = bottomTrackRef.value
    ? (gsap.quickSetter(bottomTrackRef.value, 'x', 'px') as (value: number) => void)
    : null
}

function createWaveSetters(track: HTMLElement | null) {
  if (!track) return []

  return Array.from(track.children).map((item) => {
    const element = item as HTMLElement
    gsap.set(element, { y: 0, force3D: true })
    return gsap.quickTo(element, 'y', {
      duration: 0.42,
      ease: 'power3.out',
      overwrite: 'auto',
    }) as (value: number) => void
  })
}

function syncWaveSetters() {
  topItemWaveSetters = createWaveSetters(topTrackRef.value)
  bottomItemWaveSetters = createWaveSetters(bottomTrackRef.value)
}

function resetWaveOffsets() {
  topItemWaveSetters.forEach((setY) => {
    setY(0)
  })
  bottomItemWaveSetters.forEach((setY) => {
    setY(0)
  })
}

function resolveWaveLiftByIndex(indexDistance: number, radius: number, maxLift: number) {
  if (radius <= 0 || indexDistance >= radius) return 0

  const normalized = 1 - indexDistance / radius
  const eased = normalized * normalized * (3 - 2 * normalized)
  return -maxLift * eased
}

function findHoveredIndex(track: HTMLElement | null, key: string | null): number {
  if (!track || !key) return -1

  const items = track.children
  for (let i = 0; i < items.length; i++) {
    if ((items[i] as HTMLElement).dataset.loopKey === key) return i
  }
  return -1
}

function updateWaveOffsets() {
  if (!pointerActive.value || prefersReducedMotion.value) {
    resetWaveOffsets()
    return
  }

  const key = hoveredLoopKey.value
  const maxLift = viewportWidth.value < 768 ? 8 : 10
  const waveRadius = 3.5

  const applyWave = (track: HTMLElement | null, setters: Array<(value: number) => void>) => {
    if (!track || !setters.length) return

    const anchorIndex = findHoveredIndex(track, key)

    if (anchorIndex < 0) {
      setters.forEach((setY) => { setY(0) })
      return
    }

    setters.forEach((setY, i) => {
      const indexDistance = Math.abs(i - anchorIndex)
      const lift = resolveWaveLiftByIndex(indexDistance, waveRadius, maxLift)
      setY(lift)
    })
  }

  applyWave(topTrackRef.value, topItemWaveSetters)
  applyWave(bottomTrackRef.value, bottomItemWaveSetters)
}

function updateOffsets() {
  gsap.ticker.remove(updateOffsets)
  offsetTickScheduled = false

  if (!sectionRef.value || typeof window === 'undefined') return

  if (prefersReducedMotion.value) {
    topTrackSetter?.(0)
    bottomTrackSetter?.(0)
    resetWaveOffsets()
    return
  }

  const rect = sectionRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight || 1
  const bandCenter = rect.top + rect.height / 2
  const viewportCenter = viewportHeight / 2
  const normalized = Math.max(-1, Math.min(1, (viewportCenter - bandCenter) / viewportHeight))
  const drift = props.bandIndex % 2 === 0 ? 1 : -1
  const wheelDrift = wheelPosition.value * drift
  const topRawOffset = normalized * 52 * drift + wheelDrift
  const bottomRawOffset = normalized * 34 * drift + wheelDrift * 0.82

  const topOffset = topCycleWidth.value
    ? -topCycleWidth.value - normalizeLoopOffset(topRawOffset, topCycleWidth.value)
    : topRawOffset

  const bottomOffset = bottomCycleWidth.value
    ? -120 - bottomCycleWidth.value + normalizeLoopOffset(bottomRawOffset, bottomCycleWidth.value)
    : -bottomRawOffset

  topTrackSetter?.(topOffset)
  bottomTrackSetter?.(bottomOffset)
  syncHoveredArticleFromPointer()
  updateWaveOffsets()
}

function queueOffsets() {
  if (offsetTickScheduled) return
  offsetTickScheduled = true
  gsap.ticker.add(updateOffsets)
}

function cancelQueuedOffsets() {
  if (!offsetTickScheduled) return
  gsap.ticker.remove(updateOffsets)
  offsetTickScheduled = false
}

function queueMeasure() {
  if (resizeFrame) {
    window.cancelAnimationFrame(resizeFrame)
  }

  resizeFrame = window.requestAnimationFrame(async () => {
    resizeFrame = 0
    syncViewportWidth()
    await measureTracks()
    syncTrackSetters()
    syncWaveSetters()
    queueOffsets()
  })
}

function onPointerEnter(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return

  pointerActive.value = true
  pointerX.value = event.clientX
  pointerY.value = event.clientY
  queueOffsets()
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return

  pointerActive.value = true
  pointerX.value = event.clientX
  pointerY.value = event.clientY
  queueOffsets()
}

function onPointerLeave() {
  pointerActive.value = false
  hoveredLoopKey.value = null
  resetWaveOffsets()
}

function setHoveredLoopKey(loopKey: string | null) {
  hoveredLoopKey.value = loopKey
}

function syncHoveredArticleFromPointer() {
  if (!pointerActive.value || !sectionRef.value) {
    return
  }

  const hoveredElement = document.elementFromPoint(pointerX.value, pointerY.value)

  if (!(hoveredElement instanceof HTMLElement)) {
    return
  }

  if (!sectionRef.value.contains(hoveredElement)) {
    return
  }

  const hoveredItem = hoveredElement.closest<HTMLElement>('.article-parallax-band__item')

  if (!hoveredItem) {
    return
  }

  hoveredLoopKey.value = hoveredItem.dataset.loopKey ?? hoveredLoopKey.value
}

const { wheelPosition, onWheel: onBandWheel } = useGalleryWheelMotion({
  prefersReducedMotion,
  topCycleWidth,
  bottomCycleWidth,
  onUpdate: queueOffsets,
  velocityGain: 0.035,
  maxVelocity: 11,
  friction: 0.93,
  stopThreshold: 0.03,
  normalizationRange: 24,
})

onMounted(() => {
  if (typeof window === 'undefined') return

  reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncViewportWidth()
  syncReducedMotion()
  reduceMotionQuery.addEventListener('change', syncReducedMotion)
  window.addEventListener('scroll', queueOffsets, { passive: true })
  window.addEventListener('resize', queueMeasure, { passive: true })
  queueMeasure()
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
  cancelQueuedOffsets()

  window.removeEventListener('scroll', queueOffsets)
  window.removeEventListener('resize', queueMeasure)
  reduceMotionQuery?.removeEventListener('change', syncReducedMotion)
})
</script>

<template>
  <section
    ref="sectionRef"
    class="article-parallax-band"
    @wheel="onBandWheel"
    @pointerenter="onPointerEnter"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
  >
    <div class="article-parallax-band__row">
        <div class="article-parallax-band__viewport">
        <div ref="topTrackRef" class="article-parallax-band__track">
          <div
            v-for="item in topTrackItems"
            :key="item.loopKey"
            class="article-parallax-band__item"
            :data-loop-key="item.loopKey"
            @pointerenter="setHoveredLoopKey(item.loopKey)"
          >
            <ArticleParallaxGalleryCard
              :article="item.article"
              :is-hovered="hoveredLoopKey === item.loopKey"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="article-parallax-band__row article-parallax-band__row--bottom">
      <div class="article-parallax-band__viewport">
        <div ref="bottomTrackRef" class="article-parallax-band__track">
          <div
            v-for="item in bottomTrackItems"
            :key="item.loopKey"
            class="article-parallax-band__item"
            :data-loop-key="item.loopKey"
            @pointerenter="setHoveredLoopKey(item.loopKey)"
          >
            <ArticleParallaxGalleryCard
              :article="item.article"
              :is-hovered="hoveredLoopKey === item.loopKey"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.article-parallax-band {
  --gallery-band-row-height: 24rem;
  --gallery-band-gap: 1rem;
  --gallery-band-card-width: clamp(16.8rem, 28vw, 21rem);
  --gallery-band-card-gap: clamp(0.9rem, 1.4vw, 1.2rem);
  --gallery-band-hover-buffer: 0.9rem;
  width: 100vw;
  margin-left: calc(50% - 50vw);
}

.article-parallax-band__row {
  position: relative;
  height: calc(var(--gallery-band-row-height) + var(--gallery-band-hover-buffer));
  overflow: visible;
}

.article-parallax-band__row + .article-parallax-band__row {
  margin-top: var(--gallery-band-gap);
}

.article-parallax-band__row--bottom {
  opacity: 0.97;
}

.article-parallax-band__viewport {
  height: 100%;
  padding-top: var(--gallery-band-hover-buffer);
  box-sizing: border-box;
  overflow: hidden;
  clip-path: inset(calc(-1 * var(--gallery-band-hover-buffer)) 0 0 0);
}

.article-parallax-band__track {
  display: flex;
  gap: var(--gallery-band-card-gap);
  width: max-content;
  padding-inline: clamp(1rem, 2.8vw, 2.25rem);
  transform: translate3d(var(--gallery-band-offset, 0px), 0, 0);
}

.article-parallax-band__item {
  width: var(--gallery-band-card-width);
  min-width: var(--gallery-band-card-width);
  height: var(--gallery-band-row-height);
  flex: 0 0 auto;
}

@media (max-width: 767px) {
  .article-parallax-band {
    --gallery-band-row-height: 21rem;
    --gallery-band-card-width: min(82vw, 18rem);
    --gallery-band-hover-buffer: 0.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .article-parallax-band__track {
    transition: none;
  }
}
</style>
