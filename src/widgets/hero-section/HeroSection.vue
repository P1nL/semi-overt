<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import VariableProximity from '@/shared/components/VariableProximity.vue'

import type { ArticleCardVm } from '@/entities/article'
import HomeShowcaseRail from '@/widgets/home-showcase/HomeShowcaseRail.vue'
import { createHomePreviewArticles } from './model/homePreview'

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

const introRef = ref<HTMLElement | null>(null)
const measureRef = ref<HTMLElement | null>(null)
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

const HOME_SHOWCASE_PREVIEW_COUNT = 11
// 临时开关：生产构建始终关闭，预览文章不会替换真实数据。
const previewEnabled = import.meta.env.DEV
const previewArticles = previewEnabled ? createHomePreviewArticles() : []

const heroItems = computed(() => {
  const list: ArticleCardVm[] = []

  if (props.primary) {
    list.push(props.primary)
  }

  return list.concat(props.secondary.slice(0, HOME_SHOWCASE_PREVIEW_COUNT - 1))
})

const showcaseItems = computed(() => {
  const items = heroItems.value

  if (!previewEnabled || items.length >= HOME_SHOWCASE_PREVIEW_COUNT) return items
  return [...items, ...previewArticles].slice(0, HOME_SHOWCASE_PREVIEW_COUNT)
})

const hasCards = computed(() => showcaseItems.value.length > 0)
</script>

<template>
  <section class="hero-section relative isolate overflow-visible pt-6 md:pt-8 lg:pt-10">
    <div ref="introRef" class="page-container hero-section__intro relative mb-3 space-y-4 md:mb-4">
      <h1 class="hero-section__title text-[var(--color-text)]" :style="titleSize ? { fontSize: `${titleSize}px` } : undefined">
        <span ref="measureRef" class="hero-title-measure" aria-hidden="true"><span v-for="(letter, index) in Array.from(title)" :key="index">{{ letter }}</span></span>
        <VariableProximity
          :label="title"
          from-font-variation-settings="'wght' 900"
          to-font-variation-settings="'wght' 1000"
          :container-ref="introRef"
          :radius="180"
          falloff="exponential"
          static-font-effect
        />
      </h1>
      <p v-if="description" class="mx-auto max-w-2xl text-center text-sm leading-[1.65] text-[var(--color-text-muted)] md:text-[1rem]">
        {{ description }}
      </p>
    </div>

    <div
      v-if="hasCards"
      class="hero-section__rail"
    >
      <HomeShowcaseRail
        :items="showcaseItems"
        category-label="day"
        featured
        :revealed="revealed || previewEnabled"
        :animate-reveal="animateReveal"
        :delay-base="40"
        :max-visible="HOME_SHOWCASE_PREVIEW_COUNT"
      />
    </div>
  </section>
</template>

<style scoped>
.hero-section__intro {
  margin-top: calc(clamp(3rem, 18svh, 14rem) - 20px);
}
.hero-section__title {
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
