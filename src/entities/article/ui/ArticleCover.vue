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
    }>(),
    {
      title: '',
      compact: false,
      fillHeight: false,
      eager: false,
    },
)

const imageLoading = computed<'eager' | 'lazy'>(() => (props.eager ? 'eager' : 'lazy'))
const imageDecoding = computed<'sync' | 'async'>(() => (props.eager ? 'sync' : 'async'))
const imageFetchPriority = computed<'high' | 'auto'>(() => (props.eager ? 'high' : 'auto'))
</script>

<template>
  <div
      class="relative overflow-hidden rounded-[calc(var(--radius-lg)+2px)] shadow-[var(--shadow-xs)]"
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
        class="absolute inset-0 block h-full w-full object-cover object-center"
    />
    <div
        v-else
        class="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.2))] px-4 text-center text-sm font-medium text-[var(--color-text-muted)]"
    >
      {{ title || '暂无封面' }}
    </div>
  </div>
</template>
