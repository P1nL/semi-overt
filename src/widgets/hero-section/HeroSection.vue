<script setup lang="ts">
import { computed } from 'vue'

import type { ArticleCardVm } from '@/entities/article/model/article.types'
import { ArticleCard } from '@/entities/article/ui'

const props = withDefaults(
  defineProps<{
    primary: ArticleCardVm | null
    secondary?: ArticleCardVm[]
    keyword?: string
    searching?: boolean
    title?: string
    description?: string
    revealed?: boolean
  }>(),
  {
    secondary: () => [],
    keyword: '',
    searching: false,
    title: '发现值得细读的文章',
    description: '浏览精选内容，按栏目探索，快速进入真正值得你花时间阅读的作品。',
    revealed: false,
  },
)

const heroSecondary = computed(() => props.secondary.slice(0, 3))
const hasCards = computed(() => !!props.primary || heroSecondary.value.length > 0)
</script>

<template>
  <section class="relative isolate overflow-hidden px-2 py-6 md:px-4 md:py-8 lg:px-6 lg:py-10">
    <div class="relative mb-8 space-y-4 px-2 md:px-4">
      <div class="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">精选内容</div>
      <h1 class="max-w-4xl text-4xl font-semibold tracking-[-0.06em] text-[var(--color-text)] md:text-5xl lg:text-6xl">
        {{ title }}
      </h1>
      <p class="max-w-2xl text-sm leading-7 text-[var(--color-text-muted)] md:text-base">
        {{ description }}
      </p>
    </div>

    <div
      v-if="hasCards"
      class="relative grid gap-4 lg:grid-cols-12 lg:items-stretch"
    >
      <div
        v-if="primary"
        class="hero-reveal lg:col-span-8"
        :class="{ 'hero-reveal--visible': revealed }"
        style="--hero-reveal-delay: 40ms"
      >
        <ArticleCard
          :article="primary"
          fill-height
        />
      </div>

      <div class="space-y-4 lg:col-span-4">
        <div
          v-for="(item, index) in heroSecondary"
          :key="item.id"
          class="hero-reveal"
          :class="{ 'hero-reveal--visible': revealed }"
          :style="{ '--hero-reveal-delay': `${120 + index * 80}ms` }"
        >
          <ArticleCard
            :article="item"
            compact
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-reveal {
  opacity: 0;
  transform: translateY(28px);
}

.hero-reveal--visible {
  animation: hero-rise-in 620ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--hero-reveal-delay, 0ms);
}

@keyframes hero-rise-in {
  0% {
    opacity: 0;
    transform: translateY(28px);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
