<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import HeroTitleRing from './HeroTitleRing.vue'
import { useHomeIntro } from '@/features/home-intro'

import type { ArticleCardVm } from '@/entities/article'
import HomeShowcaseRail from '@/widgets/home-showcase/HomeShowcaseRail.vue'

const props = withDefaults(
  defineProps<{
    primary: ArticleCardVm | null
    secondary?: ArticleCardVm[]
    title?: string
    description?: string
    revealed?: boolean
    animateReveal?: boolean
  }>(),
  {
    secondary: () => [],
    title: 'SEMI•OVERT',
    description: '',
    revealed: false,
    animateReveal: true,
  },
)

const displayTitle = computed(() => {
  const letters = Array.from(props.title)
  const separatorIndex = letters.findIndex((letter, index) => letter === '•' && letters[index + 1] === 'O')
  if (separatorIndex < 0) return { left: props.title, right: '', eye: false }
  return { left: letters.slice(0, separatorIndex).join(''), right: letters.slice(separatorIndex + 2).join(''), eye: true }
})

const introRef = ref<HTMLElement | null>(null)
const measureRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const titleSize = ref<number | null>(null)
let resizeObserver: ResizeObserver | undefined
let fitFrame = 0
let disposed = false
function fitTitle() {
  fitFrame = 0
  const width = introRef.value?.clientWidth ?? 0
  const measuredWidth = measureRef.value?.getBoundingClientRect().width ?? 0
  if (width > 0 && measuredWidth > 0) titleSize.value = (width - 2) / measuredWidth * 100
}
function scheduleFit() {
  if (!fitFrame) fitFrame = requestAnimationFrame(fitTitle)
}
onMounted(() => {
  resizeObserver = new ResizeObserver(scheduleFit)
  if (introRef.value) resizeObserver.observe(introRef.value)
  scheduleFit()
  void document.fonts.ready.then(() => { if (!disposed) scheduleFit() })
  document.fonts.addEventListener('loadingdone', scheduleFit)
})
watch(() => props.title, async () => { await nextTick(); if (!disposed) scheduleFit() })
onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(fitFrame)
  resizeObserver?.disconnect()
  document.fonts.removeEventListener('loadingdone', scheduleFit)
})

const HOME_SHOWCASE_MAX_COUNT = 11

const heroItems = computed(() => {
  const list: ArticleCardVm[] = []

  if (props.primary) {
    list.push(props.primary)
  }

  return list.concat(props.secondary).slice(0, HOME_SHOWCASE_MAX_COUNT)
})

const homeIntro = useHomeIntro()
// Freeze the participating data set during the entrance. If it is empty,
// leave the bottom blank until completion rather than swapping data mid-flight.
const introItems = ref<ArticleCardVm[] | null>(null)
watch(() => homeIntro?.contentLocked.value, locked => {
  if (locked && introItems.value === null) introItems.value = [...heroItems.value]
})
const displayedItems = computed(() => homeIntro?.active.value && introItems.value !== null ? introItems.value : heroItems.value)
</script>

<template>
  <section class="hero-section relative isolate overflow-visible pt-6 md:pt-8 lg:pt-10">
    <div ref="introRef" class="page-container hero-section__intro relative mb-3 space-y-4 md:mb-4">
      <h1 ref="titleRef" class="hero-section__title text-[var(--color-text)]" :style="titleSize ? { fontSize: `${titleSize}px` } : undefined">
        <span ref="measureRef" class="hero-title-measure" aria-hidden="true"><span class="hero-title-pressure-measure">{{ displayTitle.left }}</span><span v-if="displayTitle.eye">O</span><span class="hero-title-pressure-measure">{{ displayTitle.right }}</span></span>
        <HeroTitleRing :title="title" :container-ref="titleRef" />
        <span class="sr-only">{{ title }}</span>
      </h1>
      <p v-if="description" class="mx-auto max-w-2xl text-center text-sm leading-[1.65] text-[var(--color-text-muted)] md:text-[1rem]">
        {{ description }}
      </p>
    </div>

    <div
      v-if="revealed && displayedItems.length"
      class="hero-section__rail"
      data-page-motion="home-bottom"
    >
      <HomeShowcaseRail
        :items="displayedItems"
        category-label="day"
        featured
        fill-decorative
        :revealed="revealed"
        :animate-reveal="animateReveal"
        :delay-base="40"
        :max-visible="HOME_SHOWCASE_MAX_COUNT"
      />
    </div>
  </section>
</template>

<style scoped>
.hero-section__intro {
  margin-top: calc(clamp(3rem, 18svh, 14rem) - 20px);
}
.hero-section__title {
  --hero-title-peak-lift: 0.6em;
  position: relative;
  isolation: isolate;
  font-family: var(--font-display);
  font-weight: 900;
  line-height: 1.12;
  letter-spacing: 0;
  font-size: clamp(2rem, 12vw, 12rem);
  text-align: center;
  white-space: nowrap;
  width: 100%;
  margin: 0;
}
.hero-title-measure {
  position: absolute;
  left: 0;
  top: 0;
  width: max-content;
  font-size: 100px;
  visibility: hidden;
  pointer-events: none;
}
.hero-title-measure > span { display: inline-block; }
.hero-title-pressure-measure {
  font-family: var(--font-pressure);
  font-variation-settings: 'wght' 900;
  font-synthesis: none;
}

@media (max-width: 767px) {
  .hero-section__title { --hero-title-peak-lift: 0.4em; }
}

@media (min-width: 1024px) {
  .hero-section {
    /* Expose roughly half a screen of cards, matching the supplied online composition. */
    --hero-rail-visible-height: 50svh;
    /* Header spacer + HomePage's md:pt-10 + this stage equal one viewport. */
    block-size: calc(100svh - var(--header-height-md) - 2.5rem);
    min-block-size: 0;
    padding-block: 0;
  }

  .hero-section__intro {
    position: absolute;
    left: 50%;
    top: calc(45svh - var(--header-height-md) - 2.5rem - 20px);
    transform: translate(-50%, -50%);
    margin-block: 0;
  }

  .hero-section__rail {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    block-size: var(--hero-rail-visible-height);
    /* Cards intentionally layer over the headline, including during hover expansion. */
    overflow: visible;
    z-index: 1;
  }

}
</style>
