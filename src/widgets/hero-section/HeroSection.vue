<script setup lang="ts">
import { computed } from 'vue'

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
    title: '一切存在于半公开•空间🪨',
    description: '',
    revealed: false,
    animateReveal: true,
  },
)

const HOME_SHOWCASE_PREVIEW_COUNT = 11

const heroItems = computed(() => {
  const list: ArticleCardVm[] = []

  if (props.primary) {
    list.push(props.primary)
  }

  return list.concat(props.secondary.slice(0, HOME_SHOWCASE_PREVIEW_COUNT - 1))
})

const showcaseItems = computed(() => {
  const items = heroItems.value

  if (!import.meta.env.DEV || items.length === 0 || items.length >= HOME_SHOWCASE_PREVIEW_COUNT) {
    return items
  }

  return Array.from(
    { length: HOME_SHOWCASE_PREVIEW_COUNT },
    (_, index) => items[index % items.length],
  )
})

const hasCards = computed(() => showcaseItems.value.length > 0)
</script>

<template>
  <section class="hero-section relative isolate overflow-visible pt-6 md:pt-8 lg:pt-10">
    <div class="page-container hero-section__intro relative mb-3 space-y-4 md:mb-4">
      <h1 class="max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-[var(--color-text)] md:text-5xl lg:text-[3.5rem]">
        {{ title }}
      </h1>
      <p class="max-w-2xl text-sm leading-[1.65] text-[var(--color-text-muted)] md:text-[1rem]">
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
        :revealed="revealed"
        :animate-reveal="animateReveal"
        :delay-base="40"
        :max-visible="HOME_SHOWCASE_PREVIEW_COUNT"
      />
    </div>
  </section>
</template>

<style scoped>
@media (min-width: 1024px) {
  .hero-section {
    --hero-rail-visible-height: clamp(15rem, 17vw, 19rem);
    min-block-size: max(20rem, calc(100svh + var(--hero-rail-visible-height) - 0rem));
    padding-bottom: 0;
  }

  .hero-section__intro {
    margin-bottom: 0;
  }

  .hero-section__rail {
    position: sticky;
    top: calc(100svh - var(--hero-rail-visible-height));
    z-index: 1;
  }
}
</style>
