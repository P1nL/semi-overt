<!-- src/entities/article/ui/ArticleCover.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { ArticleCoverVm } from '../model/article.types'

const props = withDefaults(
    defineProps<{
      cover: ArticleCoverVm
      title?: string
      compact?: boolean
      fillHeight?: boolean
      eager?: boolean
      fallback?: 'title' | 'emoji'
      emoji?: string
    }>(),
    {
      title: '',
      compact: false,
      fillHeight: false,
      eager: false,
      fallback: 'title',
      emoji: '📖',
    },
)

const imageLoading = computed<'eager' | 'lazy'>(() => (props.eager ? 'eager' : 'lazy'))
const imageDecoding = computed<'sync' | 'async'>(() => (props.eager ? 'sync' : 'async'))
const imageFetchPriority = computed<'high' | 'auto'>(() => (props.eager ? 'high' : 'auto'))
</script>

<template>
  <div
      class="article-cover relative overflow-hidden rounded-[calc(var(--radius-lg)+2px)] shadow-[var(--shadow-xs)]"
      :class="
        compact
          ? 'h-24 w-32 shrink-0'
          : fillHeight
            ? 'h-[clamp(13.6rem,29vw,15rem)] w-full shrink-0'
            : 'aspect-[16/9] w-full'
      "
      :style="{ backgroundColor: cover.color }"
  >
    <img
        v-if="cover.hasImage && cover.src"
        :src="cover.src"
        :alt="cover.alt || title"
        :loading="imageLoading"
        :decoding="imageDecoding"
        :fetchpriority="imageFetchPriority"
        class="article-cover__image absolute inset-0 block h-full w-full object-cover object-center"
    />
    <div
        v-else
        class="article-cover__placeholder flex h-full w-full items-center justify-center px-4 text-center"
        :class="fallback === 'emoji' ? 'article-cover__placeholder--emoji' : 'article-cover__placeholder--title'"
    >
      <span v-if="fallback === 'emoji'" class="article-cover__emoji" aria-hidden="true">{{ emoji }}</span>
      <span v-else>{{ title || '暂无封面' }}</span>
    </div>
  </div>
</template>

<style scoped>
.article-cover__image {
  min-width: 100%;
  min-height: 100%;
  object-fit: cover;
  object-position: center;
}

.article-cover__placeholder--title {
  background: linear-gradient(180deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.2));
  color: var(--color-text-muted);
  font-size: 0.875rem;
  font-weight: 500;
}

.article-cover__placeholder--emoji {
  background: transparent;
}

.article-cover__emoji {
  display: inline-grid;
  place-items: center;
  font-size: clamp(3.25rem, 7vw, 5.4rem);
  line-height: 1;
  filter: drop-shadow(0 10px 18px rgb(15 23 42 / 0.12));
  transform: translateY(-0.04em);
}

@media (prefers-reduced-motion: no-preference) {
  .article-cover__emoji {
    transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .article-cover:hover .article-cover__emoji {
    transform: translateY(-0.08em) scale(1.04) rotate(-2deg);
  }
}
</style>
