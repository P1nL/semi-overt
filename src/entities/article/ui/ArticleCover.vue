<!-- src/entities/article/ui/ArticleCover.vue -->
<script setup lang="ts">
import type { ArticleCoverVm } from '../model/article.types'

withDefaults(
    defineProps<{
      cover: ArticleCoverVm
      title?: string
      compact?: boolean
      fillHeight?: boolean
    }>(),
    {
      title: '',
      compact: false,
      fillHeight: false,
    },
)
</script>

<template>
  <div
      class="relative overflow-hidden rounded-[calc(var(--radius-lg)+2px)] shadow-[var(--shadow-xs)]"
      :class="
        compact
          ? 'h-24 w-32 shrink-0'
          : fillHeight
            ? 'min-h-[18rem] w-full flex-1'
            : 'aspect-[16/9] w-full'
      "
      :style="{ backgroundColor: cover.color }"
  >
    <img
        v-if="cover.hasImage && cover.src"
        :src="cover.src"
        :alt="cover.alt || title"
        class="h-full w-full object-cover"
    />
    <div
        v-else
        class="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.2))] px-4 text-center text-sm font-medium text-[var(--color-text-muted)]"
    >
      {{ title || '暂无封面' }}
    </div>
  </div>
</template>
